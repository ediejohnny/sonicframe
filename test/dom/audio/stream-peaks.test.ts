/**
 * Peaks read while a sound downloads: each format through its reader and a decoder, the ceilings on
 * bytes and seconds, the MP4 index fetched by range, and the sounds left to the whole decode.
 */

import { describe, expect, it } from 'vite-plus/test';
import { mixAudioData } from '../../../src/dom/audio/frame-sinks';
import {
    NotStreamable,
    streamPeaks,
} from '../../../src/dom/audio/stream-peaks';
import { m4a } from '../../support/mp4-files';
import {
    ascii,
    bytes,
    frame,
    MP3_HEADER,
    wav,
} from '../../support/sound-files';
import {
    serve,
    stubWebCodecs,
    stubWholeDecoder,
} from '../../support/stream-audio';
import { cluster, simpleBlock, webm } from '../../support/webm-files';

/** An MP3 frame whose byte 4 says its level. */
function loud(level: number): number[] {
    const one = frame(MP3_HEADER, 417);
    one[4] = level;

    return one;
}

/** An MP3 of frames at these levels. */
function mp3Of(levels: readonly number[]): Uint8Array {
    return bytes(...levels.map(loud));
}

/** A first frame whose Xing header says the sound has `frames` frames. */
function xing(frames: number): number[] {
    const one = frame(MP3_HEADER, 417);
    one.splice(
        36,
        12,
        ...ascii('Xing'),
        0,
        0,
        0,
        1,
        ...[24, 16, 8, 0].map((shift) => (frames >> shift) & 255),
    );

    return one;
}

const LEVELS = [10, 20, 30, 40, 50, 60];

const OPTIONS = { count: 6, maxBytes: 1_000_000, maxSeconds: 36_000 };

/** Peaks on a 0–60 scale, rounded, so float rounding does not hide the order. */
function scaled(peaks: readonly number[]): number[] {
    return peaks.map((peak) => Math.round(peak * 60));
}

describe('streamPeaks', () => {
    it('decodes an MP3 frame by frame with WebCodecs, in order, timed by its samples', async () => {
        serve(mp3Of(LEVELS));
        const decoder = stubWebCodecs();
        const result = await streamPeaks('/a.mp3', OPTIONS);

        expect(scaled(result.peaks)).toEqual(LEVELS);
        expect(decoder.configs).toEqual([
            { codec: 'mp3', sampleRate: 44100, numberOfChannels: 2 },
        ]);
        expect(decoder.times.map((time) => Math.round(time))).toEqual(
            [0, 1, 2, 3, 4, 5].map((index) =>
                Math.round((index * 1152 * 1_000_000) / 44100),
            ),
        );
        expect(result.duration).toBeCloseTo(600 / 44100, 9);
        expect(decoder.data.every((data) => data.closed)).toBe(true);
    });

    it('skips an ID3 tag that spans many pieces', async () => {
        const tag = [
            ...ascii('ID3'),
            4,
            0,
            0,
            0,
            0,
            2,
            0x58,
            ...Array.from({ length: 344 }, () => 1),
        ];
        serve(bytes(tag, mp3Of(LEVELS)), { piece: 50 });
        stubWebCodecs();

        expect(scaled((await streamPeaks('/a.mp3', OPTIONS)).peaks)).toEqual(
            LEVELS,
        );
    });

    it('reads a WAV with no decoder at all', async () => {
        serve(
            wav({
                channels: 1,
                bits: 8,
                rate: 8000,
                payload: [128, 192, 128, 64, 128, 0],
            }),
        );
        const result = await streamPeaks('/a.wav', { ...OPTIONS, count: 3 });

        expect(result.peaks).toEqual([0.5, 0.5, 1]);
        expect(result.duration).toBe(6 / 8000);
    });

    it('stops downloading past maxBytes (a stream buffers a piece or two ahead)', async () => {
        const served = serve(mp3Of(Array.from({ length: 40 }, () => 9)), {
            piece: 64,
        });
        stubWebCodecs();

        await expect(
            streamPeaks('/a.mp3', { ...OPTIONS, maxBytes: 1000 }),
        ).rejects.toThrow('too large');
        expect(served.sent).toBeLessThanOrEqual(1000 + 2 * 64);
    });

    it('stops reading past maxSeconds, the rest of a known length drawn as silence', async () => {
        const file = bytes(
            xing(100),
            mp3Of(Array.from({ length: 30 }, () => 90)),
        );
        const served = serve(file, { piece: 417 });
        stubWebCodecs();
        const result = await streamPeaks('/a.mp3', {
            ...OPTIONS,
            count: 4,
            maxSeconds: 300 / 44100,
        });

        expect(result.peaks).toEqual([1, 0, 0, 0]);
        expect(result.duration).toBeCloseTo((100 * 1152) / 44100, 6);
        expect(served.sent).toBeLessThan(file.length);
    });

    it('shows the peaks so far over the whole length while reading', async () => {
        serve(bytes(xing(8), mp3Of([60, 60, 60, 60])), { piece: 417 });
        stubWebCodecs({ samples: 1152 });
        const seen: number[][] = [];
        await streamPeaks('/a.mp3', {
            ...OPTIONS,
            count: 4,
            every: 0,
            onPeaks: (peaks) => seen.push(peaks),
        });

        // Half the sound came: the start is loud, the end still silent.
        expect(seen[0]).toEqual([1, 0, 0, 0]);
        expect(seen.at(-1)?.[0]).toBe(1);
        expect(seen.at(-1)?.[3]).toBe(0);
        expect(seen.length).toBeGreaterThan(1);
    });

    it('holds frames back while the decoder is busy', async () => {
        serve(mp3Of(Array.from({ length: 80 }, () => 5)), { piece: 4096 });
        const decoder = stubWebCodecs({ queue: 40 });
        await streamPeaks('/a.mp3', OPTIONS);

        expect(decoder.times).toHaveLength(80);
        expect(decoder.crowded).toBe(0);
    });

    it('decodes batches of frames as whole files without WebCodecs, MP3 batches primed with the last frames', async () => {
        serve(mp3Of(Array.from({ length: 1200 }, () => 7)), { piece: 65_536 });
        const decoder = stubWebCodecs();
        const files = stubWholeDecoder({ samples: 10, at: 4 });
        const result = await streamPeaks('/a.mp3', {
            ...OPTIONS,
            maxBytes: 10_000_000,
            webcodecs: false,
        });

        expect(files.map((file) => file.length / 417)).toEqual([1149, 8 + 51]);
        expect(decoder.configs).toEqual([]);
        // The second piece's 10 samples all belong to its 8 priming frames, so they are dropped.
        expect(result.duration).toBe(10 / 22050);
    });

    it('decodes whole files when WebCodecs cannot read the codec', async () => {
        serve(mp3Of(LEVELS));
        stubWebCodecs({ supports: () => false });
        const files = stubWholeDecoder({ samples: 6, at: 4 });

        expect(scaled((await streamPeaks('/a.mp3', OPTIONS)).peaks)).toEqual([
            60, 60, 60, 60, 60, 60,
        ]);
        expect(files).toHaveLength(1);
    });

    it('reads an MP4 whose index comes last by asking for the index first', async () => {
        const { file, moovAt } = m4a({
            sizes: [40, 40, 40, 40, 40],
            perChunk: 2,
            moovFirst: false,
        });
        const served = serve(file, { ranges: true, piece: 30 });
        const decoder = stubWebCodecs({ at: 0 });
        const result = await streamPeaks('/a.m4a', { ...OPTIONS, count: 5 });

        expect(served.requests.map((request) => request.range)).toEqual([
            null,
            `bytes=${moovAt}-`,
            null,
        ]);
        expect(scaled(result.peaks)).toEqual([12, 24, 36, 48, 60]);
        expect(decoder.configs[0].codec).toBe('mp4a.40.2');
        // The first download stops at the data; only the index and one whole download follow.
        expect(served.sent).toBeLessThan(file.length * 2);
    });

    it('reads the bytes the caller opens itself, from where it asks, with no fetch', async () => {
        const { file, moovAt } = m4a({
            sizes: [40, 40, 40, 40, 40],
            perChunk: 2,
            moovFirst: false,
        });
        const fetched = serve(file, { ranges: true });
        stubWebCodecs({ at: 0 });
        const opened: (number | undefined)[] = [];
        const result = await streamPeaks('/a.m4a', {
            ...OPTIONS,
            count: 5,
            open: (from) => {
                opened.push(from);

                return Promise.resolve(new Response(file.slice(from ?? 0)));
            },
        });

        expect(opened).toEqual([undefined, moovAt, undefined]);
        expect(scaled(result.peaks)).toEqual([12, 24, 36, 48, 60]);
        expect(fetched.requests).toEqual([]);
    });

    it('leaves an MP4 whose index comes last to the whole decode when the server sends no ranges', async () => {
        serve(m4a({ sizes: [40, 40], perChunk: 1, moovFirst: false }).file);
        stubWebCodecs();

        await expect(streamPeaks('/a.m4a', OPTIONS)).rejects.toThrow(
            'no ranges',
        );
    });

    it('leaves to the whole decode what it cannot read in pieces', async () => {
        const cases: [Uint8Array, () => void][] = [
            [
                bytes(ascii('<html><body>hello</body></html>')),
                (): void => undefined,
            ],
            [bytes(ascii('ID3')), (): void => undefined],
            [
                m4a({ sizes: [40, 40], perChunk: 1, moovFirst: false }).file,
                (): void => void stubWebCodecs(),
            ],
            [
                webm({
                    tracks: [{ number: 1, codec: 'A_OPUS' }],
                    clusters: [cluster(0, simpleBlock(1, 0, [[1]]))],
                }),
                (): void => void stubWebCodecs({ supports: () => false }),
            ],
            [mp3Of([200, 10]), (): void => void stubWebCodecs({ failOn: 200 })],
            [
                bytes(
                    MP3_HEADER,
                    Array.from({ length: 70_000 }, () => 0),
                ),
                (): void => void stubWebCodecs(),
            ],
        ];

        for (const [file, setUp] of cases) {
            serve(file);
            setUp();

            await expect(streamPeaks('/a', OPTIONS)).rejects.toBeInstanceOf(
                NotStreamable,
            );
        }
    });

    it('stops at once when the signal fires, and says so', async () => {
        serve(mp3Of(LEVELS));
        stubWebCodecs();
        const controller = new AbortController();
        controller.abort();

        await expect(
            streamPeaks('/a.mp3', { ...OPTIONS, signal: controller.signal }),
        ).rejects.toMatchObject({
            name: 'AbortError',
        });
    });

    it('says when the server refuses the sound', async () => {
        serve(mp3Of(LEVELS), { status: 404 });

        await expect(streamPeaks('/a.mp3', OPTIONS)).rejects.toThrow(
            'could not fetch audio (404)',
        );
    });
});

describe('mixAudioData', () => {
    it('averages the channels of a decoded piece', () => {
        const planes = [
            Float32Array.from([1, 0.5]),
            Float32Array.from([0, 0.25]),
            Float32Array.from([0.5, 0]),
        ];
        const data = {
            numberOfFrames: 2,
            numberOfChannels: 3,
            copyTo: (
                target: Float32Array,
                options: { planeIndex: number },
            ): void => target.set(planes[options.planeIndex]),
        } as unknown as AudioData;

        expect(Array.from(mixAudioData(data))).toEqual([0.5, 0.25]);
    });
});
