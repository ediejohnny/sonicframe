import { describe, expect, it } from 'vite-plus/test';
import {
    clipBars,
    clipPlan,
    clipShape,
    DEFAULT_CLIP_TYPES,
    pickMimeType,
} from '../src/core/clip';
import { layoutBars } from '../src/core/layout';
import { DEFAULT_WAVE } from '../src/core/shapes';
import type { BarStyle } from '../src/types';

const BAR: BarStyle = {
    width: 3,
    gap: 2,
    radius: 0,
    minHeight: 2,
    align: 'center',
    curve: 1,
};

/** 100 silent peaks, then 100 loud ones. */
const HALVES = [
    ...Array.from({ length: 100 }, () => 0),
    ...Array.from({ length: 100 }, () => 1),
];

describe('clipBars', () => {
    it('lays the whole sound across the width when the clip is all of it', () => {
        // 100 px of 3 px bars with 2 px gaps: 20 bars, the first 10 silent.
        const { values, grid } = clipBars(HALVES, 0, 60, 60, 100, BAR);

        expect(grid).toBeUndefined();
        expect(values).toEqual([
            ...Array.from({ length: 10 }, () => 0),
            ...Array.from({ length: 10 }, () => 1),
        ]);
    });

    it('lays only the range across the width, so the played part matches the bars', () => {
        // 33 s to 60 s is 55% to 100% of the sound: all of it loud, even the bar cut by the edge.
        const loud = clipBars(HALVES, 33, 60, 60, 100, BAR);
        const quiet = clipBars(HALVES, 0, 27, 60, 100, BAR);

        expect(loud.grid?.virtualWidth).toBeCloseTo(100 / 0.45, 9);
        expect(loud.grid?.offset).toBe(Math.round(0.55 * (100 / 0.45)));
        expect(loud.values.length).toBeGreaterThan(0);
        expect(loud.values.every((value) => value === 1)).toBe(true);
        expect(quiet.values.every((value) => value === 0)).toBe(true);
    });

    it('starts with the silence and ends with the sound of a range across the middle', () => {
        const { values } = clipBars(HALVES, 15, 45, 60, 100, BAR);

        expect(values[0]).toBe(0);
        expect(values.at(-1)).toBe(1);
    });

    it('draws nothing without peaks, and the whole sound while its length is unknown', () => {
        expect(clipBars([], 0, 10, 10, 100, BAR).values).toEqual([]);

        for (const duration of [0, NaN]) {
            const whole = clipBars(HALVES, 5, 10, duration, 100, BAR);

            expect(whole.grid).toBeUndefined();
            expect(whole.values).toHaveLength(20);
        }
    });
});

describe('clipShape', () => {
    it('lays the bars of the range on their window of the row', () => {
        const range = { start: 33, end: 60 };
        const { values, grid } = clipBars(HALVES, 33, 60, 60, 100, BAR);

        expect(
            clipShape(HALVES, range, 60, 100, 40, BAR, {
                ...DEFAULT_WAVE,
                style: 'bars',
            }).rects,
        ).toEqual(layoutBars(values, 100, 40, BAR, 1, grid));
        expect(grid?.first).toBeGreaterThan(0);
    });
});

describe('pickMimeType', () => {
    it('returns the first supported candidate', () => {
        const supported = (type: string): boolean =>
            type === 'video/webm;codecs=vp9';

        expect(pickMimeType(DEFAULT_CLIP_TYPES, supported)).toBe(
            'video/webm;codecs=vp9',
        );
    });

    it('prefers MP4 when everything is supported', () => {
        expect(pickMimeType(DEFAULT_CLIP_TYPES, () => true)).toBe(
            'video/mp4;codecs=avc1',
        );
    });

    it('returns null when nothing is supported', () => {
        expect(pickMimeType(DEFAULT_CLIP_TYPES, () => false)).toBeNull();
    });
});

describe('clipPlan', () => {
    it('orders the ends and clamps to the sound', () => {
        expect(clipPlan(5, 2, 100)).toEqual({ start: 2, end: 5, seconds: 3 });
    });

    it('caps the length', () => {
        expect(clipPlan(0, 9999, 1000).seconds).toBe(120);
    });

    it('clamps to the duration', () => {
        expect(clipPlan(0, 500, 100).end).toBe(100);
    });

    it('takes a missing start or end as the sound own start or end', () => {
        expect(clipPlan(Number.NaN, 10, 30)).toEqual({
            start: 0,
            end: 10,
            seconds: 10,
        });
        expect(clipPlan(5, Number.NaN, 30)).toEqual({
            start: 5,
            end: 30,
            seconds: 25,
        });
    });
});
