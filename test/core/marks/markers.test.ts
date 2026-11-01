import { describe, expect, it } from 'vite-plus/test';
import {
    markerSpans,
    toMarks,
    type Mark,
} from '../../../src/core/marks/markers';

describe('toMarks', () => {
    it('keeps only finite moments and marks with a finite time, and never breaks on anything else', () => {
        const given = [
            null,
            Number.NaN,
            5,
            { time: Number.NaN },
            { time: '3' },
            'x',
            { time: 3, label: 'Intro' },
            Number.POSITIVE_INFINITY,
        ] as unknown as Mark[];

        expect(toMarks(given)).toEqual([
            { time: 5 },
            { time: 3, label: 'Intro' },
        ]);
    });
});

describe('markerSpans', () => {
    it('centers each line on its moment, inside the frame', () => {
        expect(markerSpans([0, 15, 30], 30, 300, 4)).toEqual([
            { x: 0, width: 4 },
            { x: 148, width: 4 },
            { x: 296, width: 4 },
        ]);
    });

    it('draws nothing while the duration is unknown, and skips broken moments', () => {
        expect(markerSpans([5], null, 300, 4)).toEqual([]);
        expect(markerSpans([5], NaN, 300, 4)).toEqual([]);
        expect(markerSpans([NaN, 10], 20, 100, 2)).toEqual([
            { x: 49, width: 2 },
        ]);
    });

    it('places the moments through a view and leaves out those outside it', () => {
        // 50 s to 75 s across 200 px: 55 s at 40 px, 75 s on the right edge, 10 s out of view.
        expect(
            markerSpans([55, 10, 75], 100, 200, 2, { start: 0.5, end: 0.75 }),
        ).toEqual([
            { x: 39, width: 2 },
            { x: 198, width: 2 },
        ]);
    });
});
