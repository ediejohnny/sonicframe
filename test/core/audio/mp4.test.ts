import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { createMp4Reader } from '../../../src/core/audio/mp4';
import { box, esds, m4a, type M4aOptions } from '../../support/mp4-files';
import {
    ascii,
    bytes,
    expectSafeWhenDamaged,
    inPieces,
} from '../../support/sound-files';

const SIZES = [100, 120, 90, 110, 95];

/** Each frame the reader gives for `file` pushed in pieces: its size and the byte that fills it. */
function framesOf(
    file: Uint8Array,
    cuts: readonly number[] = [],
    reader = createMp4Reader(),
): [number, number][] {
    return inPieces(file, cuts, (piece) => reader.push(piece))
        .flat()
        .map((frame) => [frame.data.length, frame.data[0]]);
}

/** The sizes of SIZES with the byte that fills each (frame i is filled with i + 1). */
const EXPECTED: [number, number][] = [
    [100, 1],
    [120, 2],
    [90, 3],
    [110, 4],
    [95, 5],
];

describe('createMp4Reader', () => {
    it('gives each frame where the table says, however the bytes are cut', () => {
        const { file } = m4a({ sizes: SIZES, perChunk: 2, gap: 7 });

        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 400 }), { maxLength: 10 }),
                (cuts) => {
                    expect(framesOf(file, cuts)).toEqual(EXPECTED);
                },
            ),
        );
    });

    it('says the codec, its setup, the rate, the channels and the whole length', () => {
        const reader = createMp4Reader();
        reader.push(m4a({ sizes: SIZES, perChunk: 2 }).file);

        expect(reader.format).toEqual({
            codec: 'mp4a.40.2',
            sampleRate: 44100,
            channels: 2,
            description: Uint8Array.from([0x12, 0x10]),
            totalSamples: 5120,
        });
    });

    it('finds the sound track after a video one', () => {
        expect(
            framesOf(m4a({ sizes: SIZES, perChunk: 3, video: true }).file),
        ).toEqual(EXPECTED);
    });

    it('reads one size for every frame, 64-bit chunk places and a QuickTime version 1 entry', () => {
        const options: M4aOptions = {
            sizes: [64, 64, 64],
            perChunk: 2,
            fixed: true,
            co64: true,
            entryVersion: 1,
        };

        expect(framesOf(m4a(options).file)).toEqual([
            [64, 1],
            [64, 2],
            [64, 3],
        ]);
    });

    it('names an escaped object type, and MP3 inside MP4 with no setup', () => {
        const extended = createMp4Reader();
        extended.push(
            m4a({ sizes: SIZES, perChunk: 2, esds: esds(0x40, [0xf9, 0x40]) })
                .file,
        );
        const mp3 = createMp4Reader();
        mp3.push(m4a({ sizes: SIZES, perChunk: 2, esds: esds(0x6b, []) }).file);

        expect(extended.format?.codec).toBe('mp4a.40.42');
        expect(mp3.format?.codec).toBe('mp3');
        expect(mp3.format?.description).toBeUndefined();
    });

    it('stops at data that comes before the moov, says where the moov is, and reads with that track', () => {
        const { file, moovAt } = m4a({
            sizes: SIZES,
            perChunk: 2,
            moovFirst: false,
        });
        const first = createMp4Reader();

        expect(framesOf(file, [50, 50], first)).toEqual([]);
        expect(first.moovAt).toBe(moovAt);

        const moov = createMp4Reader();
        moov.push(file.subarray(moovAt));

        expect(moov.track).not.toBeNull();
        expect(framesOf(file, [33], createMp4Reader(moov.track))).toEqual(
            EXPECTED,
        );
    });

    it('refuses what it cannot read', () => {
        const refused = [
            m4a({ sizes: SIZES, perChunk: 2, esds: esds(0xa5, []) }).file,
            m4a({ sizes: SIZES, perChunk: 2, entryVersion: 2 }).file,
            bytes(
                box('ftyp', ascii('M4A ')),
                [0, 0, 0, 0],
                ascii('mdat'),
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
            ),
            bytes(
                box('ftyp', ascii('M4A ')),
                [0x04, 0x30, 0, 0],
                ascii('moov'),
                Array.from({ length: 8 }, () => 0),
            ),
            bytes(
                box('ftyp', ascii('M4A ')),
                box('moov', box('mvhd', 0, 0, 0, 0)),
            ),
            bytes(
                [0, 0, 0, 4],
                ascii('free'),
                Array.from({ length: 12 }, () => 0),
            ),
        ];

        for (const file of refused) {
            expect(() => createMp4Reader().push(file)).toThrow(TypeError);
        }
    });

    it('refuses a table that claims more entries than its box holds', () => {
        const { file } = m4a({ sizes: SIZES, perChunk: 2 });
        const at = indexOf(file, 'stsz') + 4 + 8;
        const lying = file.slice();
        lying.set([0, 0x10, 0, 0], at);

        expect(() => createMp4Reader().push(lying)).toThrow(TypeError);
    });

    it('ignores a box that runs past the box holding it', () => {
        const { file } = m4a({ sizes: SIZES, perChunk: 2 });
        const at = indexOf(file, 'trak') - 4;
        const overflowing = file.slice();
        overflowing[at + 3] += 4;

        expect(() => createMp4Reader().push(overflowing)).toThrow(
            /file with sound/,
        );
    });

    it('refuses an object type that is neither AAC nor MP3, even with a setup', () => {
        const file = m4a({ sizes: SIZES, perChunk: 2, esds: esds(0xa5) }).file;

        expect(() => createMp4Reader().push(file)).toThrow(TypeError);
    });

    it('never runs away on a damaged file, and throws only TypeError', () => {
        const { file } = m4a({ sizes: SIZES, perChunk: 2, video: true });

        expectSafeWhenDamaged(file, (damaged) => {
            for (const frame of createMp4Reader().push(damaged)) {
                expect(frame.data.length).toBeGreaterThan(0);
            }
        });
    });
});

/** Where the ASCII `name` first appears in `bytes`. */
function indexOf(data: Uint8Array, name: string): number {
    const codes = ascii(name);

    return data.findIndex((_, at) =>
        codes.every((code, index) => data[at + index] === code),
    );
}
