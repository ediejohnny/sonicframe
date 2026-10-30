/**
 * Decoding a sound for the peaks and the spectrogram: the download and the length have ceilings an
 * app may only lower; a sound longer than the length ceiling is read evenly through, and the rate
 * given back is the rate of the samples given back, so times stay right.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { decodeAudio } from '../../src/dom/decode';

/** A decoder whose every sound is `seconds` long at 1000 samples per second, the value i at sample i. */
function fakeDecoder(seconds: number): void {
    vi.stubGlobal(
        'OfflineAudioContext',
        class {
            decodeAudioData(): Promise<AudioBuffer> {
                const length = seconds * 1000;
                const data = Float32Array.from({ length }, (_, i) => i);

                return Promise.resolve({
                    length,
                    duration: seconds,
                    sampleRate: 1000,
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

    it('never raises the ceilings: a larger maxSeconds or maxBytes keeps the defaults', async () => {
        fakeDecoder(3);
        const decoded = await decodeAudio(new Blob([new Uint8Array(4)]), {
            maxSeconds: 1e9,
        });

        expect(decoded.samples.length).toBe(3000);
        await expect(
            decodeAudio(new Blob([new Uint8Array(10)]), { maxBytes: 5 }),
        ).rejects.toThrow('too large');
        await expect(
            decodeAudio(new Blob([new Uint8Array(60 * 1024 * 1024)]), {
                maxBytes: 1e12,
            }),
        ).rejects.toThrow('too large');
    });
});
