import { describe, expect, it } from 'vite-plus/test';
import {
    loadPeaks,
    normalize,
    peaksFromChannel,
    readPeaks,
    resample,
    type PeaksFetcher,
} from '../src/core/peaks';

function respond(body: unknown, status = 200, length?: number): PeaksFetcher {
    return () =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
                get: (name: string) =>
                    name === 'content-length' && length !== undefined
                        ? String(length)
                        : null,
            },
            json: () => Promise.resolve(body),
        });
}

describe('readPeaks', () => {
    it('reads a list or a { peaks } object, capping values into 0..1', () => {
        expect(readPeaks([0, 0.5, 1])).toEqual([0, 0.5, 1]);
        expect(readPeaks({ peaks: [0.25, -0.75, 3] })).toEqual([0.25, 0.75, 1]);
    });

    it('refuses anything that is not a list of finite numbers', () => {
        for (const bad of [
            null,
            'x',
            { peaks: 'x' },
            [0.1, '2'],
            [NaN],
            [1, Infinity],
            {},
        ]) {
            expect(() => readPeaks(bad)).toThrow(TypeError);
        }
    });

    it('refuses more peaks than the limit', () => {
        expect(() => readPeaks([0.1, 0.2, 0.3], 2)).toThrow(RangeError);
        expect(readPeaks([0.1, 0.2], 2)).toHaveLength(2);
    });
});

describe('loadPeaks', () => {
    it('fetches each address once, however many frames ask', async () => {
        let calls = 0;
        const fetcher: PeaksFetcher = (url) => {
            calls++;

            return respond({ peaks: [0.2, 0.4] })(url);
        };

        const [a, b] = await Promise.all([
            loadPeaks('/once.json', fetcher),
            loadPeaks('/once.json', fetcher),
        ]);

        expect(a).toEqual([0.2, 0.4]);
        expect(b).toBe(a);
        expect(calls).toBe(1);
    });

    it('forgets a failed fetch so it can be tried again', async () => {
        await expect(
            loadPeaks('/retry.json', respond(null, 503)),
        ).rejects.toThrow('503');
        await expect(loadPeaks('/retry.json', respond([0.5]))).resolves.toEqual(
            [0.5],
        );
    });

    it('refuses a file announced as too large before reading it', async () => {
        await expect(
            loadPeaks('/huge.json', respond([0.5], 200, 5_000_000)),
        ).rejects.toThrow(RangeError);
    });
});

describe('resample', () => {
    it('folds into exactly count values, keeping each slice loudest point', () => {
        const peaks = [0.1, 0.9, 0.2, 0.3, 0.8, 0.1, 0, 0.4, 0.5, 0.2];

        expect(resample(peaks, 5)).toEqual([0.9, 0.3, 0.8, 0.4, 0.5]);
        expect(resample(peaks, 3)).toHaveLength(3);
        expect(Math.max(...resample(peaks, 3))).toBe(0.9);
    });

    it('stretches by blending neighbours and keeps both ends', () => {
        expect(resample([0, 1], 5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(resample([0.5], 3)).toEqual([0.5, 0.5, 0.5]);
    });

    it('returns nothing for no peaks or no room', () => {
        expect(resample([], 10)).toEqual([]);
        expect(resample([0.5], 0)).toEqual([]);
    });
});

describe('peaksFromChannel', () => {
    it('returns exactly count peaks, even when the samples do not divide evenly', () => {
        const samples = Float32Array.from({ length: 1000 }, (_, i) =>
            Math.sin(i / 7),
        );

        expect(peaksFromChannel(samples, 400)).toHaveLength(400);
        expect(peaksFromChannel(samples, 3)).toHaveLength(3);
        expect(peaksFromChannel(samples.subarray(0, 10), 40)).toHaveLength(40);
    });

    it('normalizes so the loudest peak is 1', () => {
        const peaks = peaksFromChannel(
            Float32Array.from([0.1, -0.4, 0.2, 0.05]),
            2,
        );

        expect(peaks).toEqual([1, 0.5]);
    });

    it('keeps silence silent', () => {
        expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
        expect(peaksFromChannel(new Float32Array(8), 4)).toEqual([0, 0, 0, 0]);
    });
});
