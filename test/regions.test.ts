import { describe, expect, it } from 'vite-plus/test';
import { hitRegion, normalizeRegion } from '../src/core/regions';

describe('normalizing a region', () => {
    it('orders the ends and clamps to the sound', () => {
        expect(normalizeRegion(8, 3, 10, 0.25)).toEqual({ start: 3, end: 8 });
        expect(normalizeRegion(-2, 20, 10, 0.25)).toEqual({
            start: 0,
            end: 10,
        });
    });

    it('keeps at least the minimum length when the end crosses the start', () => {
        // Dragging the end back past the start: the region stays minLength wide, not inverted.
        const region = normalizeRegion(5, 4.9, 10, 0.25);

        expect(region.end - region.start).toBeCloseTo(0.25, 5);
        expect(region.start).toBeGreaterThanOrEqual(0);
        expect(region.end).toBeLessThanOrEqual(10);
    });
});

describe('hit-testing a region', () => {
    const laid = [{ start: 100, end: 200 }];

    it('lands on the start edge within the edge zone', () => {
        expect(hitRegion(104, laid, 12)).toEqual({ index: 0, part: 'start' });
    });

    it('lands on the end edge within the edge zone', () => {
        expect(hitRegion(196, laid, 12)).toEqual({ index: 0, part: 'end' });
    });

    it('lands on the body between the edges', () => {
        expect(hitRegion(150, laid, 12)).toEqual({ index: 0, part: 'body' });
    });

    it('misses outside the region', () => {
        expect(hitRegion(50, laid, 12)).toBeNull();
    });

    it('prefers the region given first (topmost)', () => {
        const two = [
            { start: 140, end: 260 },
            { start: 100, end: 200 },
        ];
        expect(hitRegion(200, two, 12)).toEqual({ index: 0, part: 'body' });
    });
});
