import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { createOggReader, xiphHeaders } from '../../../src/core/audio/ogg';
import {
    opusFile,
    opusHead,
    packet,
    page,
    vorbisId,
} from '../../support/ogg-files';
import {
    ascii,
    bytes,
    expectSafeWhenDamaged,
    inPieces,
} from '../../support/sound-files';

/** Each frame the reader gives for `file` pushed in pieces: its size, its fill and its samples. */
function framesOf(
    file: Uint8Array,
    cuts: readonly number[] = [],
): [number, number, number][] {
    const reader = createOggReader();

    return inPieces(file, cuts, (piece) => reader.push(piece))
        .flat()
        .map((frame) => [frame.data.length, frame.data[0], frame.samples]);
}

const OPUS = opusFile([
    { packets: [packet(10, 1), packet(20, 2), packet(30, 3)], granule: 2880 },
    { packets: [packet(40, 4), packet(50, 5)], granule: 4800 },
]);

describe('createOggReader', () => {
    it('gives each Opus packet, with the samples of a page on its last packet, however the bytes are cut', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 120 }), { maxLength: 10 }),
                (cuts) => {
                    expect(framesOf(OPUS, cuts)).toEqual([
                        [10, 1, 0],
                        [20, 2, 0],
                        [30, 3, 2880],
                        [40, 4, 0],
                        [50, 5, 1920],
                    ]);
                },
            ),
        );
    });

    it('sets Opus up from its OpusHead, at 48 kHz', () => {
        const reader = createOggReader();
        reader.push(OPUS);

        expect(reader.format).toEqual({
            codec: 'opus',
            sampleRate: 48000,
            channels: 2,
            description: Uint8Array.from(opusHead()),
        });
    });

    it('puts a packet that runs over pages back together', () => {
        const file = bytes(
            page({ flags: 2, packets: [opusHead()] }),
            page({ packets: [ascii('OpusTags')] }),
            page({ packets: [packet(510, 9)], open: true, granule: -1 }),
            page({ flags: 1, packets: [packet(90, 9)], granule: 960 }),
        );

        expect(framesOf(file)).toEqual([[600, 9, 960]]);
    });

    it('sets Vorbis up from its three headers, laced as WebCodecs takes them', () => {
        const comment = [3, ...ascii('vorbis'), ...packet(253, 0)];
        const setup = [5, ...ascii('vorbis'), ...packet(13, 0)];
        const reader = createOggReader();
        const frames = reader.push(
            bytes(
                page({ flags: 2, packets: [vorbisId(2, 22050)] }),
                page({ packets: [comment, setup] }),
                page({ packets: [packet(8, 1)], granule: 2048 }),
            ),
        );

        expect(reader.format).toEqual({
            codec: 'vorbis',
            sampleRate: 22050,
            channels: 2,
            description: bytes(
                2,
                30,
                255,
                5,
                vorbisId(2, 22050),
                comment,
                setup,
            ),
        });
        expect(frames.map((frame) => frame.samples)).toEqual([2048]);
    });

    it('follows the first Opus or Vorbis stream and skips the others', () => {
        const file = bytes(
            page({
                flags: 2,
                serial: 1,
                packets: [[0x80, ...ascii('theora')]],
            }),
            page({ flags: 2, serial: 2, packets: [opusHead()] }),
            page({ serial: 2, packets: [ascii('OpusTags')] }),
            page({ serial: 1, packets: [packet(70, 7)], granule: 1 }),
            page({ serial: 2, packets: [packet(10, 1)], granule: 960 }),
        );

        expect(framesOf(file)).toEqual([[10, 1, 960]]);
    });

    it('finds pages again after stray bytes, and stops at the last page of its stream', () => {
        const file = bytes(
            page({ flags: 2, packets: [opusHead()] }),
            [1, 2, 3],
            page({ packets: [ascii('OpusTags')] }),
            page({ packets: [packet(10, 1)], granule: 960, flags: 4 }),
            page({ packets: [packet(10, 2)], granule: 1920 }),
        );

        expect(framesOf(file)).toEqual([[10, 1, 960]]);
    });

    it('skips a page of an Ogg version it does not know', () => {
        const unknown = page({ packets: [packet(10, 8)], granule: 960 });
        unknown[4] = 1;
        const file = bytes(
            page({ flags: 2, packets: [opusHead()] }),
            page({ packets: [ascii('OpusTags')] }),
            unknown,
            page({ packets: [packet(10, 1)], granule: 1920 }),
        );

        expect(framesOf(file)).toEqual([[10, 1, 1920]]);
    });

    it('drops a packet whose next page does not continue it', () => {
        const file = bytes(
            page({ flags: 2, packets: [opusHead()] }),
            page({ packets: [ascii('OpusTags')] }),
            page({ packets: [packet(255, 9)], open: true, granule: -1 }),
            page({ packets: [packet(10, 1)], granule: 960 }),
        );

        expect(framesOf(file)).toEqual([[10, 1, 960]]);
    });

    it('refuses bytes with no Ogg page in the first 64 KiB, a stream of no channels and a packet past 1 MiB', () => {
        const silent = bytes(
            page({ flags: 2, packets: [opusHead(0)] }),
            page({ packets: [ascii('OpusTags')] }),
        );
        const fullPage = {
            packets: [packet(255 * 255, 1)],
            open: true,
            granule: -1,
        };
        const huge = bytes(
            page({ flags: 2, packets: [opusHead()] }),
            page({ packets: [ascii('OpusTags')] }),
            ...Array.from({ length: 17 }, (_, index) =>
                page({ ...fullPage, flags: index === 0 ? 0 : 1 }),
            ),
        );

        expect(() => createOggReader().push(new Uint8Array(70_000))).toThrow(
            TypeError,
        );
        expect(() => createOggReader().push(silent)).toThrow(TypeError);
        expect(() => createOggReader().push(huge)).toThrow(TypeError);
    });

    it('never runs away on a damaged file, and throws only TypeError', () => {
        expectSafeWhenDamaged(OPUS, (damaged) => {
            createOggReader().push(damaged);
        });
    });
});

describe('xiphHeaders', () => {
    it('writes the count less one, the first two lengths laced, then the headers', () => {
        const headers = [packet(255, 1), packet(2, 2), packet(1, 3)].map(
            (one) => Uint8Array.from(one),
        );

        expect(xiphHeaders(headers)).toEqual(
            bytes(2, 255, 0, 2, packet(255, 1), packet(2, 2), packet(1, 3)),
        );
    });
});
