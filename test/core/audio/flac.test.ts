import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { createFlacReader, flacHeader } from '../../../src/core/audio/flac';
import {
    block,
    crc16,
    crc8,
    flacFile,
    flacFrame,
    streamInfo,
} from '../../support/flac-files';
import {
    ascii,
    bytes,
    expectSafeWhenDamaged,
    inPieces,
} from '../../support/sound-files';

/** A payload holding a false sync whose header even passes its CRC-8. */
const DECOY = (() => {
    const header = [0xff, 0xf8, 0x69, 0x08, 0, 99];

    return [1, 2, 3, ...header, crc8(header), 4, 5, 6];
})();

const FRAMES = [
    flacFrame(0, DECOY),
    flacFrame(1, [7, 8, 9]),
    flacFrame(2, [0xff, 0xf8, 10]),
];

/** Each frame the reader gives for `file` pushed in pieces, then the end: its size and samples. */
function framesOf(
    file: Uint8Array,
    cuts: readonly number[] = [],
): [number, number][] {
    const reader = createFlacReader();
    const frames = inPieces(file, cuts, (piece) => reader.push(piece)).flat();

    return [...frames, ...(reader.end?.() ?? [])].map((frame) => [
        frame.data.length,
        frame.samples,
    ]);
}

describe('the test CRCs', () => {
    it('give the published check values of CRC-8 and CRC-16/UMTS', () => {
        const check = ascii('123456789');

        expect(crc8(check)).toBe(0xf4);
        expect(crc16(check)).toBe(0xfee8);
    });
});

describe('flacHeader', () => {
    it('reads the samples of a frame, and waits when the header is cut short', () => {
        const frame = Uint8Array.from(flacFrame(0, []));

        expect(flacHeader(frame, 0)).toBe(100);
        expect(flacHeader(frame.subarray(0, 5), 0)).toBeUndefined();
    });

    it('refuses a header that breaks a rule or its CRC-8', () => {
        // Each breaks one rule yet carries a right CRC-8, so the rule alone refuses it.
        const broken = [
            [0xff, 0xfa, 0x69, 0x08, 0, 99], // not a sync code
            [0xff, 0xf8, 0x09, 0x08, 0], // reserved block size
            [0xff, 0xf8, 0x6f, 0x08, 0, 99], // invalid sample rate
            [0xff, 0xf8, 0x69, 0xb8, 0, 99], // reserved channel layout
            [0xff, 0xf8, 0x69, 0x06, 0, 99], // reserved sample size
            [0xff, 0xf8, 0x69, 0x09, 0, 99], // reserved bit set
            [0xff, 0xf8, 0x69, 0x08, 0x80, 99], // coded number starting as a continuation
            [0xff, 0xf8, 0x69, 0x08, 0xc0, 0x00, 99], // coded number missing its continuation
        ];
        const good = flacFrame(0, []);

        for (const header of broken) {
            expect(
                flacHeader(Uint8Array.from([...header, crc8(header)]), 0),
            ).toBeNull();
        }

        expect(
            flacHeader(Uint8Array.from([...good.slice(0, 6), good[6] ^ 1]), 0),
        ).toBeNull();
    });

    it('reads every block size code', () => {
        const sizes: [number, number[], number][] = [
            [1, [], 192],
            [2, [], 576],
            [5, [], 4608],
            [7, [0x01, 0x00], 257],
            [8, [], 256],
            [15, [], 32768],
        ];

        for (const [code, extra, samples] of sizes) {
            const header = [0xff, 0xf8, (code << 4) | 9, 0x08, 0, ...extra];

            expect(
                flacHeader(Uint8Array.from([...header, crc8(header)]), 0),
            ).toBe(samples);
        }
    });

    it('reads a two-byte coded number and a sample rate written after it', () => {
        const header = [0xff, 0xf9, 0x6d, 0x08, 0xc2, 0x80, 99, 0xac, 0x44];

        expect(flacHeader(Uint8Array.from([...header, crc8(header)]), 0)).toBe(
            100,
        );
    });
});

describe('createFlacReader', () => {
    it('ends each frame where the next one starts, past false syncs, however the bytes are cut', () => {
        const file = flacFile(FRAMES);

        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 30 }), { maxLength: 10 }),
                (cuts) => {
                    expect(framesOf(file, cuts)).toEqual(
                        FRAMES.map((frame) => [frame.length, 100]),
                    );
                },
            ),
        );
    });

    it('sets the decoder up from STREAMINFO, flagged as the last block', () => {
        const reader = createFlacReader();
        reader.push(
            flacFile(FRAMES, {
                total: 0x123456789,
                blocks: [block(1, [0, 0], true)],
            }),
        );

        expect(reader.format).toEqual({
            codec: 'flac',
            sampleRate: 44100,
            channels: 2,
            description: bytes(
                ascii('fLaC'),
                block(0, streamInfo(0x123456789), true),
            ),
            totalSamples: 0x123456789,
        });
    });

    it('skips the other metadata blocks whole', () => {
        // Read as block headers, these zeros would be 1250 empty blocks.
        const picture = block(
            6,
            Array.from({ length: 5000 }, () => 0),
        );
        const padding = block(1, [0, 0, 0], true);
        const file = flacFile(FRAMES, { blocks: [picture, padding] });

        expect(framesOf(file, [100, 4000])).toHaveLength(3);
    });

    it('gives no last frame whose CRC-16 fails', () => {
        const last = flacFrame(2, [1, 2]);
        last[last.length - 1] ^= 1;

        expect(framesOf(flacFile([FRAMES[0], last]))).toEqual([
            [FRAMES[0].length, 100],
        ]);
    });

    it('drops a damaged frame once it outgrows the largest frame, and goes on', () => {
        const damaged = flacFrame(
            0,
            Array.from({ length: 40 }, () => 1),
        );
        damaged[20] ^= 1;
        const rest = [flacFrame(1, [7]), flacFrame(2, [8]), flacFrame(3, [9])];
        const file = flacFile([damaged, ...rest], { largest: 60 });

        expect(framesOf(file)).toEqual(
            rest.map((frame) => [frame.length, 100]),
        );
    });

    it('refuses what is not FLAC, a first block that is not STREAMINFO, a rate of 0 and endless blocks', () => {
        const endless = bytes(
            ascii('fLaC'),
            block(0, streamInfo(0)),
            ...Array.from({ length: 1100 }, () => block(1, [])),
        );
        const refused = [
            bytes(ascii('fLaX'), block(0, streamInfo(0), true)),
            bytes(ascii('fLaC'), block(4, streamInfo(0), true)),
            bytes(ascii('fLaC'), block(0, streamInfo(0, 0, 0), true)),
            endless,
        ];

        for (const file of refused) {
            expect(() => createFlacReader().push(file)).toThrow(TypeError);
        }
    });

    it('refuses a frame that runs past 16 MiB with no header inside', () => {
        const reader = createFlacReader();
        reader.push(flacFile([flacFrame(0, [])]));

        expect(() => reader.push(new Uint8Array(16_777_300))).toThrow(
            TypeError,
        );
    });

    it('never runs away on a damaged file, and throws only TypeError', () => {
        expectSafeWhenDamaged(flacFile(FRAMES), (damaged) => {
            const reader = createFlacReader();
            reader.push(damaged);
            reader.end?.();
        });
    });
});
