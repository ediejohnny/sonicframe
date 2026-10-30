/**
 * The detail pyramid: level 0 is the peaks, each next level keeps the louder of each pair. A window
 * of a bar grid laid over the whole sound reads the loudest peak of each bar's slice through it (the
 * same slices as `resample`), and past the file's own detail blends neighbours instead of leaving
 * holes.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { barValues, buildDetail } from '../src/core/detail';

/** Bar k of `total` over `peaks` is the loudest of peaks floor(k·n/total) .. floor((k+1)·n/total) − 1. */
function bruteFold(peaks: readonly number[], total: number): number[] {
    const n = peaks.length;

    return Array.from({ length: total }, (_, k) => {
        let loudest = 0;

        for (
            let i = Math.floor((k * n) / total);
            i < Math.floor(((k + 1) * n) / total);
            i++
        ) {
            loudest = Math.max(loudest, peaks[i]);
        }

        return loudest;
    });
}

describe('buildDetail', () => {
    it('halves each level, keeping the louder of each pair and the odd one out', () => {
        const levels = buildDetail([0.1, 0.5, 0.3, 0.2, 0.9]);

        expect(levels.map((level) => Array.from(level))).toEqual([
            [0.1, 0.5, 0.3, 0.2, 0.9],
            [0.5, 0.3, 0.9],
            [0.5, 0.9],
            [0.9],
        ]);
    });

    it('has one empty level for no peaks', () => {
        expect(buildDetail([]).map((level) => level.length)).toEqual([0]);
    });
});

describe('barValues', () => {
    const peaks = [0.1, 0.9, 0.2, 0.3, 0.8, 0.1, 0, 0.4, 0.5, 0.2];

    it('reads the loudest peak of each bar of the window', () => {
        // Five bars over ten peaks: pairs. Bars 1 to 3 of them.
        expect(barValues(buildDetail(peaks), 5, 1, 3)).toEqual([0.3, 0.8, 0.4]);
    });

    it('blends neighbours past the detail of the file, like a stretch', () => {
        // Five bars over two peaks: 0, 0.25, 0.5, 0.75, 1 of the way from the first to the second.
        expect(barValues(buildDetail([0, 1]), 5, 0, 5)).toEqual([
            0, 0.25, 0.5, 0.75, 1,
        ]);
    });

    it('keeps the window inside the grid, and gives nothing without peaks or bars', () => {
        expect(barValues(buildDetail(peaks), 5, 3, 10)).toEqual([0.4, 0.5]);
        expect(barValues(buildDetail(peaks), 5, -2, 3)).toEqual([0.9]);
        expect(barValues(buildDetail([]), 5, 0, 5)).toEqual([]);
        expect(barValues(buildDetail(peaks), 0, 0, 5)).toEqual([]);
    });

    it('matches the brute-force fold for any peaks and any window of a grid that folds them', () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
                    minLength: 1,
                    maxLength: 400,
                }),
                fc.nat(),
                fc.nat(),
                fc.nat(),
                (values, a, b, c) => {
                    const total = 1 + (a % values.length);
                    const first = b % total;
                    const count = 1 + (c % (total - first));

                    expect(
                        barValues(buildDetail(values), total, first, count),
                    ).toEqual(
                        bruteFold(values, total).slice(first, first + count),
                    );
                },
            ),
        );
    });
});
