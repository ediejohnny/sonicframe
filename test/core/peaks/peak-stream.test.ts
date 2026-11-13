import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { createPeakStream } from '../../../src/core/peaks/peak-stream';
import { normalize, resample } from '../../../src/core/peaks/peaks';

/** Brute force: the loudest of each block of the smallest power-of-two stride that fits 4 blocks a peak. */
function bruteForce(samples: readonly number[], count: number): number[] {
    let stride = 1;

    while (Math.ceil(samples.length / stride) > count * 4) {
        stride *= 2;
    }

    const blocks: number[] = [];

    for (let start = 0; start < samples.length; start += stride) {
        let loudest = 0;

        for (const sample of samples.slice(start, start + stride)) {
            loudest = Math.max(loudest, Math.abs(sample));
        }

        blocks.push(loudest);
    }

    return normalize(resample(blocks, count));
}

describe('createPeakStream', () => {
    it('gives the loudest point of each slice, the loudest scaled to 1', () => {
        const stream = createPeakStream(2);
        stream.push([0.5, -1, 0.25, 0.1]);

        expect(stream.peaks()).toEqual([1, 0.25]);
    });

    it('keeps the loudest points when a long sound outgrows its room', () => {
        const samples = Array.from({ length: 16 }, () => 0);
        samples[2] = 0.4;
        samples[13] = -0.8;
        const stream = createPeakStream(2);
        stream.push(samples);

        expect(stream.peaks()).toEqual([0.5, 1]);
    });

    it('gives the same peaks however the sound is cut into pieces', () => {
        fc.assert(
            fc.property(
                fc.array(fc.float({ min: -1, max: 1, noNaN: true }), {
                    minLength: 1,
                    maxLength: 600,
                }),
                fc.integer({ min: 1, max: 40 }),
                fc.array(fc.integer({ min: 1, max: 50 }), { maxLength: 30 }),
                (samples, count, cuts) => {
                    const whole = createPeakStream(count);
                    whole.push(samples);
                    const pieces = createPeakStream(count);
                    let at = 0;

                    for (const cut of cuts) {
                        pieces.push(samples.slice(at, at + cut));
                        at += cut;
                    }

                    pieces.push(samples.slice(at));

                    expect(pieces.peaks()).toEqual(whole.peaks());
                },
            ),
        );
    });

    it('matches a brute-force fold of the whole sound', () => {
        fc.assert(
            fc.property(
                fc.array(fc.float({ min: -1, max: 1, noNaN: true }), {
                    minLength: 1,
                    maxLength: 2000,
                }),
                fc.integer({ min: 1, max: 60 }),
                (samples, count) => {
                    const stream = createPeakStream(count);
                    stream.push(samples);

                    expect(stream.peaks()).toEqual(bruteForce(samples, count));
                },
            ),
        );
    });

    it('counts the samples it was given', () => {
        const stream = createPeakStream(1);
        stream.push([0.1, 0.2, 0.3]);
        stream.push(new Float32Array(5));

        expect(stream.length).toBe(8);
    });

    it('draws the part still to come as silence when the whole length is known', () => {
        const stream = createPeakStream(2);
        stream.push([1, 0.5]);

        expect(stream.peaks(8)).toEqual([1, 0]);
    });

    it('fits a promised length far past its room, folding as the sound would', () => {
        const stream = createPeakStream(2);
        stream.push([0.5, 0.5, 0.5, 0.5]);

        expect(stream.peaks(5_000_000_000)).toEqual([1, 0]);
    });

    it('ignores a promised length shorter than what came, or not a finite number', () => {
        const stream = createPeakStream(2);
        stream.push([1, 0.5]);

        expect(stream.peaks(1)).toEqual([1, 0.5]);
        expect(stream.peaks(Number.POSITIVE_INFINITY)).toEqual([1, 0.5]);
        expect(stream.peaks(Number.NaN)).toEqual([1, 0.5]);
    });

    it('skips samples that are not finite numbers', () => {
        const stream = createPeakStream(1);
        stream.push([Number.NaN, Number.POSITIVE_INFINITY, 0.5]);

        expect(stream.peaks()).toEqual([1]);
    });

    it('gives no peaks before any sound', () => {
        expect(createPeakStream(5).peaks()).toEqual([]);
        expect(createPeakStream(5).peaks(100)).toEqual([]);
    });

    it('takes 20 000 peaks for a count that is not a number, and refuses one out of range', () => {
        const stream = createPeakStream(Number.NaN);
        stream.push(Array.from({ length: 30_000 }, () => 0.5));

        expect(stream.peaks()).toHaveLength(20_000);
        expect(() => createPeakStream(0)).toThrow(RangeError);
        expect(() => createPeakStream(1_000_001)).toThrow(
            /count goes past its most, 1000000/,
        );
    });
});
