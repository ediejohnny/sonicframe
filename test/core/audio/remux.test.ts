import { describe, expect, it } from 'vite-plus/test';
import { createFlacReader } from '../../../src/core/audio/flac';
import type { CodedFormat, CodedFrame } from '../../../src/core/audio/frames';
import { createOggReader, xiphHeaders } from '../../../src/core/audio/ogg';
import {
    flacPiece,
    oggCrc,
    oggPiece,
    preSkip,
    remuxable,
    wholePiece,
} from '../../../src/core/audio/remux';
import { flacFrame } from '../../support/flac-files';
import { opusHead, vorbisId } from '../../support/ogg-files';
import { ascii, readAll } from '../../support/sound-files';

/** A frame of `length` bytes filled with `fill`, of `samples` samples. */
function coded(length: number, fill: number, samples: number): CodedFrame {
    return { data: Uint8Array.from({ length }, () => fill), samples };
}

const OPUS: CodedFormat = {
    codec: 'opus',
    sampleRate: 48000,
    channels: 2,
    description: Uint8Array.from(opusHead()),
};

/** Every page of an Ogg file, by its header and segment table. */
function pagesOf(file: Uint8Array): Uint8Array[] {
    const pages: Uint8Array[] = [];
    let at = 0;

    while (at < file.length) {
        const segments = file[at + 26];
        let size = 27 + segments;

        for (let index = 0; index < segments; index++) {
            size += file[at + 27 + index];
        }

        pages.push(file.subarray(at, at + size));
        at += size;
    }

    return pages;
}

describe('oggCrc', () => {
    it('gives the CRC-32 of Ogg: CKSUM without its final inversion', () => {
        // CRC-32/CKSUM checks "123456789" as 0x765E7680; Ogg leaves out the final XOR.
        expect(oggCrc(Uint8Array.from(ascii('123456789')))).toBe(
            (0x765e7680 ^ 0xffffffff) >>> 0,
        );
    });
});

describe('oggPiece', () => {
    it('lays Opus packets on pages the Ogg reader reads back, long ones over many pages', () => {
        const frames = [
            coded(600, 1, 960),
            ...Array.from({ length: 300 }, (_, index) =>
                coded(3, index % 250, 960),
            ),
            coded(255 * 300, 7, 960),
        ];
        const reader = createOggReader();
        const back = reader.push(oggPiece(OPUS, frames));

        expect(back.map((frame) => Array.from(frame.data))).toEqual(
            frames.map((frame) => Array.from(frame.data)),
        );
        expect(reader.format).toEqual(OPUS);
    });

    it('starts the granule at the pre-skip and counts each packet’s samples', () => {
        const back = createOggReader().push(
            oggPiece(OPUS, [coded(10, 1, 960), coded(10, 2, 960)]),
        );

        // Both packets end on one page: the reader puts its samples, from 312, on the last.
        expect(back.map((frame) => frame.samples)).toEqual([0, 312 + 1920]);
    });

    it('writes no granule on a page where no packet ends', () => {
        const pages = pagesOf(oggPiece(OPUS, [coded(255 * 300, 1, 960)]));
        const unended = pages.filter((page) => page[27 + page[26] - 1] === 255);

        expect(unended.length).toBeGreaterThan(0);

        for (const page of unended) {
            expect(Array.from(page.subarray(6, 14))).toEqual(
                Array.from({ length: 8 }, () => 0xff),
            );
        }
    });

    it('marks the first page as the start, the last as the end, and writes each CRC', () => {
        const pages = pagesOf(oggPiece(OPUS, [coded(10, 1, 960)]));

        expect(pages.map((page) => page[5])).toEqual([2, 0, 4]);

        for (const page of pages) {
            const blank = page.slice();
            blank.fill(0, 22, 26);

            expect(
                new DataView(page.buffer, page.byteOffset).getUint32(22, true),
            ).toBe(oggCrc(blank));
        }
    });

    it('lays the three Vorbis headers back out of their Xiph lacing', () => {
        const comment = Uint8Array.from([
            3,
            ...ascii('vorbis'),
            ...Array.from({ length: 300 }, () => 0),
        ]);
        const setup = Uint8Array.from([5, ...ascii('vorbis'), 1, 2, 3]);
        const vorbis: CodedFormat = {
            codec: 'vorbis',
            sampleRate: 44100,
            channels: 1,
            description: xiphHeaders([
                Uint8Array.from(vorbisId()),
                comment,
                setup,
            ]),
        };
        const reader = createOggReader();
        reader.push(oggPiece(vorbis, [coded(5, 9, 1024)]));

        expect(reader.format).toEqual(vorbis);
    });
});

describe('flacPiece', () => {
    it('puts the frames behind the marker and STREAMINFO, the whole length cleared', () => {
        const description = Uint8Array.from([
            ...ascii('fLaC'),
            0x80,
            0,
            0,
            34,
            ...Array.from({ length: 13 }, () => 1),
            0xf3,
            0x12,
            0x34,
            0x56,
            0x78,
            ...Array.from({ length: 16 }, () => 2),
        ]);
        const frames = [flacFrame(0, [1, 2]), flacFrame(1, [3])].map(
            (data) => ({
                data: Uint8Array.from(data),
                samples: 100,
            }),
        );
        const piece = flacPiece(
            { codec: 'flac', sampleRate: 44100, channels: 2, description },
            frames,
        );
        const reader = createFlacReader();
        const back = readAll(reader, piece);

        expect(Array.from(piece.subarray(21, 26))).toEqual([0xf0, 0, 0, 0, 0]);
        expect(back.map((frame) => Array.from(frame.data))).toEqual(
            frames.map((frame) => Array.from(frame.data)),
        );
    });
});

describe('wholePiece, remuxable and preSkip', () => {
    it('joins MP3 and AAC frames as they are', () => {
        const piece = wholePiece(
            { codec: 'mp3', sampleRate: 44100, channels: 2 },
            [coded(2, 1, 0), coded(1, 2, 0)],
        );

        expect(Array.from(piece)).toEqual([1, 1, 2]);
    });

    it('says which codecs are built back, and reads Opus’s pre-skip', () => {
        expect(
            ['mp3', 'mp4a.40.2', 'flac', 'opus', 'vorbis', 'alac'].map(
                remuxable,
            ),
        ).toEqual([true, true, true, true, true, false]);
        expect(preSkip(OPUS)).toBe(312);
        expect(preSkip({ codec: 'vorbis', sampleRate: 1, channels: 1 })).toBe(
            0,
        );
    });
});
