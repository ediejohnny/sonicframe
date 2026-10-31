/**
 * The timing of a text too long for its room that walks across it: a wait before the walk, the
 * walk at a steady speed, a wait after it, and how long the walk takes to cross a fade.
 */

import { describe, expect, it } from 'vite-plus/test';
import { marqueeTiming } from '../src/core/marquee';

describe('marqueeTiming', () => {
    it('walks the distance at the speed given, between the two waits', () => {
        // 60 px at 30 px a second take 2 s; with 1 s before and 1 s after, 4 s in all.
        expect(marqueeTiming(60, 30, 1000, 1000)).toEqual({
            duration: 4000,
            start: 0.25,
            end: 0.75,
            ramp: 0,
        });
    });

    it('waits only before the walk when nothing waits after it, as a strip that loops', () => {
        // 90 px at 30 px a second take 3 s, after 1 s of waiting.
        expect(marqueeTiming(90, 30, 1000, 0)).toEqual({
            duration: 4000,
            start: 0.25,
            end: 1,
            ramp: 0,
        });
    });

    it('says how much of the round the walk takes to cross a fade', () => {
        // 24 px of fade at 30 px a second: 800 ms of a 4000 ms round.
        expect(marqueeTiming(90, 30, 1000, 0, 24)?.ramp).toBe(0.2);
    });

    it('never lets the fade take more than half the walk', () => {
        // A 60 px fade on a 30 px walk (1 s of a 3 s round): half the walk, 0.5 s.
        expect(marqueeTiming(30, 30, 1000, 1000, 60)?.ramp).toBeCloseTo(
            1 / 6,
            10,
        );
    });

    it('walks without stopping when there is no wait', () => {
        expect(marqueeTiming(45, 15, 0, 0)).toEqual({
            duration: 3000,
            start: 0,
            end: 1,
            ramp: 0,
        });
    });

    it('does not walk a text that fits, or at no speed', () => {
        expect(marqueeTiming(0, 30, 1000, 1000)).toBeNull();
        expect(marqueeTiming(-4, 30, 1000, 1000)).toBeNull();
        expect(marqueeTiming(60, 0, 1000, 1000)).toBeNull();
        expect(marqueeTiming(Number.NaN, 30, 1000, 1000)).toBeNull();
        expect(
            marqueeTiming(Number.POSITIVE_INFINITY, 30, 1000, 1000),
        ).toBeNull();
    });
});
