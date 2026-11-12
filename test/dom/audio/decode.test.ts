/**
 * Decoding a sound for the peaks and the spectrogram: the download and the length have ceilings an
 * app may only lower; a sound longer than the length ceiling is read evenly through, and the rate
 * given back is the rate of the samples given back, so times stay right.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { decodeAudio } from '../../../src/dom/audio/decode';

/** What each decoder was made with: channels, length and sample rate. */
let made: unknown[][] = [];

/** A decoder whose every sound is `seconds` long at `rate` samples per second, the value i at sample i. */
function fakeDecoder(seconds: number, rate: number = 1000): void {
    made = [];
    vi.stubGlobal(
        'OfflineAudioContext',
        class {
            constructor(...args: unknown[]) {
                made.push(args);
            }

            decodeAudioData(): Promise<AudioBuffer> {
                const length = seconds * rate;
                const data = Float32Array.from({ length }, (_, i) => i);

                return Promise.resolve({
                    length,
                    duration: seconds,
                    sampleRate: rate,
                    numberOfChannels: 1,
                    getChannelData: () => data,
                } as unknown as AudioBuffer);
            }
        },
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('decodeAudio', () => {
    it('gives back the samples, their rate and the length of the sound', async () => {
        fakeDecoder(3);
        const decoded = await decodeAudio(new Blob([new Uint8Array(4)]));

        expect(decoded.samples.length).toBe(3000);
        expect(decoded.sampleRate).toBe(1000);
        expect(decoded.duration).toBe(3);
    });

    it('decodes at the usual 22 050 samples a second when the rate is not a number', async () => {
        for (const sampleRate of [Number.NaN, '8000' as unknown as number]) {
            fakeDecoder(3);
            await decodeAudio(new Blob([new Uint8Array(4)]), { sampleRate });

            expect(made).toEqual([[1, 22050, 22050]]);
        }
    });

    it('reads a sound past maxSeconds evenly through, at the rate of what it gives back', async () => {
        fakeDecoder(10);
        const decoded = await decodeAudio(new Blob([new Uint8Array(4)]), {
            maxSeconds: 2,
        });

        // 2 s worth of samples (2000) spread over the whole 10 s: one in every five.
        expect(decoded.samples.length).toBe(2000);
        expect(decoded.samples[1]).toBe(5);
        expect(decoded.sampleRate).toBe(200);
        expect(decoded.duration).toBe(10);
    });

    it('reads 30 minutes by default, and up to 10 hours when asked; past that, 10 hours until 2.0', async () => {
        // At one sample a second the samples count the seconds read.
        fakeDecoder(40_000, 1);
        const read = async (maxSeconds?: number): Promise<number> =>
            (await decodeAudio(new Blob([new Uint8Array(4)]), { maxSeconds }))
                .samples.length;

        expect(await read()).toBe(1800);
        expect(await read(36_000)).toBe(36_000);
        expect(await read(1e9)).toBe(36_000);
        expect(await read(60)).toBe(60);
    });

    it('takes 50 MiB by default, and up to 256 MiB when asked; past that, 256 MiB until 2.0', async () => {
        fakeDecoder(3);
        /** A file of `size` bytes, never held in memory. */
        const file = (size: number): Blob =>
            ({
                size,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
            }) as unknown as Blob;

        await expect(decodeAudio(file(52_428_801))).rejects.toThrow(
            'too large',
        );
        await expect(
            decodeAudio(file(268_435_456), { maxBytes: 268_435_456 }),
        ).resolves.toMatchObject({ duration: 3 });
        await expect(
            decodeAudio(file(268_435_456), { maxBytes: 1e12 }),
        ).resolves.toMatchObject({ duration: 3 });
        await expect(
            decodeAudio(file(268_435_457), { maxBytes: 1e12 }),
        ).rejects.toThrow('too large');
        await expect(
            decodeAudio(new Blob([new Uint8Array(10)]), { maxBytes: 5 }),
        ).rejects.toThrow('too large');
    });

    it('stops a download as soon as it grows past maxBytes, its size never announced', async () => {
        fakeDecoder(3);
        let sent = 0;
        const body = new ReadableStream<Uint8Array>({
            pull(controller): void {
                // Four bytes at a time, 4000 in all, as long as someone reads.
                sent += 4;
                controller.enqueue(new Uint8Array(4));

                if (sent >= 4000) {
                    controller.close();
                }
            },
        });
        vi.stubGlobal('fetch', () =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: (): null => null },
                body,
                arrayBuffer: (): Promise<ArrayBuffer> =>
                    Promise.reject(new Error('test: read as a stream')),
            }),
        );

        await expect(
            decodeAudio('/sounds/endless.mp3', { maxBytes: 10 }),
        ).rejects.toThrow('too large');
        // The third piece passed the ceiling; nothing more was read.
        expect(sent).toBeLessThanOrEqual(16);
    });
});
