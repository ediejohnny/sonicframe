/**
 * The timing of a text too long for its room that walks across it: a pause at the start, the walk
 * at a steady speed, a pause at the end, then back to the start.
 */

import { describe, expect, it } from 'vite-plus/test';
import { marqueeTiming } from '../src/core/marquee';

describe('marqueeTiming', () => {
    it('walks the overflow at the speed given, between two pauses', () => {
        // 60 px at 30 px a second take 2 s; with 1 s at each end, 4 s in all.
        expect(marqueeTiming(60, 30, 1000)).toEqual({
            duration: 4000,
            start: 0.25,
            end: 0.75,
        });
    });

    it('walks without stopping when there is no pause', () => {
        expect(marqueeTiming(45, 15, 0)).toEqual({
            duration: 3000,
            start: 0,
            end: 1,
        });
    });

    it('does not walk a text that fits, or at no speed', () => {
        expect(marqueeTiming(0, 30, 1000)).toBeNull();
        expect(marqueeTiming(-4, 30, 1000)).toBeNull();
        expect(marqueeTiming(60, 0, 1000)).toBeNull();
        expect(marqueeTiming(Number.NaN, 30, 1000)).toBeNull();
        expect(marqueeTiming(Number.POSITIVE_INFINITY, 30, 1000)).toBeNull();
    });
});
