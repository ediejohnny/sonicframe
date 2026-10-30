/**
 * The view: the visible part of the sound as ratios from 0 to 1. It never leaves the sound, never
 * shrinks past the largest zoom, zooms around a point that stays put on screen, scrolls without
 * changing its size, reveals a position by pages or by centering it, and maps ratios to pixels and
 * back.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    FULL_VIEW,
    fitView,
    revealView,
    scrollView,
    viewLevel,
    viewRatio,
    viewX,
    zoomView,
} from '../src/core/view';

/** The view is `start`..`end`, to twelve decimals (sums of tenths are never exact in binary). */
function near(
    view: { start: number; end: number },
    start: number,
    end: number,
): void {
    expect(view.start).toBeCloseTo(start, 12);
    expect(view.end).toBeCloseTo(end, 12);
}

const ratio = fc.double({ min: 0, max: 1, noNaN: true });
const level = fc.double({ min: 1, max: 10_000, noNaN: true });
const any = fc.oneof(
    fc.double(),
    fc.constantFrom(NaN, Infinity, -Infinity, -1, 2),
);

describe('fitView', () => {
    it('keeps a view that fits as it is', () => {
        expect(fitView(0.25, 0.5, 8)).toEqual({ start: 0.25, end: 0.5 });
    });

    it('slides a view that runs past an end back inside, keeping its size', () => {
        near(fitView(0.9, 1.1, 8), 0.8, 1);
        near(fitView(-0.1, 0.1, 8), 0, 0.2);
        expect(fitView(0.9, 1.1, 8).end).toBe(1);
        expect(fitView(-0.1, 0.1, 8).start).toBe(0);
    });

    it('widens a view smaller than the largest zoom allows, and narrows one larger than the sound', () => {
        near(fitView(0.5, 0.51, 10), 0.5, 0.6);
        expect(fitView(-1, 3, 10)).toEqual(FULL_VIEW);
    });

    it('takes numbers that are not finite as the whole sound', () => {
        expect(fitView(NaN, 0.5, 4)).toEqual(FULL_VIEW);
        expect(fitView(0.2, Infinity, 4)).toEqual(FULL_VIEW);
    });

    it('never leaves the sound and never shrinks past 1 ÷ maxLevel, whatever it is given', () => {
        fc.assert(
            fc.property(any, any, level, (start, end, max) => {
                const view = fitView(start, end, max);
                const span = view.end - view.start;

                expect(view.start).toBeGreaterThanOrEqual(0);
                expect(view.end).toBeLessThanOrEqual(1);
                expect(span).toBeGreaterThanOrEqual(1 / max - 1e-12);
                expect(span).toBeLessThanOrEqual(1);
            }),
        );
    });
});

describe('zoomView', () => {
    it('zooms around a point that stays at the same place on screen', () => {
        // 0.3 sits at 30% of the whole view; at 4× it still sits at 30% of the screen.
        const view = zoomView(FULL_VIEW, 4, 0.3, 100);

        expect(view.start).toBeCloseTo(0.225, 12);
        expect(view.end).toBeCloseTo(0.475, 12);
        expect(viewLevel(view)).toBeCloseTo(4, 12);
    });

    it('stops at the largest zoom and at the whole sound', () => {
        expect(viewLevel(zoomView(FULL_VIEW, 50, 0.5, 8))).toBeCloseTo(8, 12);
        // At the largest zoom, 0.3 still sits at 30% of the screen.
        near(zoomView(FULL_VIEW, 50, 0.3, 8), 0.2625, 0.3875);
        expect(zoomView({ start: 0.4, end: 0.5 }, 0.5, 0.45, 8)).toEqual(
            FULL_VIEW,
        );
    });

    it('keeps the point under the same pixel whenever the new view fits without sliding', () => {
        fc.assert(
            fc.property(ratio, ratio, level, level, (a, at, from, to) => {
                const start = Math.min(a, 1 - 1 / from);
                const view = { start, end: start + 1 / from };
                const point = view.start + at * (view.end - view.start);
                const next = zoomView(view, to, point, 10_000);
                const before = viewX(point, view, 1000);
                const after = viewX(point, next, 1000);
                const slid =
                    next.start === 0 ||
                    next.end === 1 ||
                    Math.abs(viewLevel(next) - to) > 1e-6;

                if (!slid) {
                    expect(after).toBeCloseTo(before, 6);
                }

                expect(next.start).toBeGreaterThanOrEqual(0);
                expect(next.end).toBeLessThanOrEqual(1);
            }),
        );
    });
});

describe('scrollView', () => {
    it('moves the view without changing its size, and stops at the ends', () => {
        const view = { start: 0.2, end: 0.3 };

        near(scrollView(view, 0.5), 0.5, 0.6);
        near(scrollView(view, 0.95), 0.9, 1);
        near(scrollView(view, -3), 0, 0.1);
    });
});

describe('revealView', () => {
    const view = { start: 0.2, end: 0.3 };

    it('leaves the view alone when the position is already in it', () => {
        expect(revealView(view, 0.25, 'page')).toBe(view);
        expect(revealView(view, 0.2, 'center')).toBe(view);
    });

    it('turns whole pages to reach a position, forward or back', () => {
        near(revealView(view, 0.31, 'page'), 0.3, 0.4);
        near(revealView(view, 0.55, 'page'), 0.5, 0.6);
        near(revealView(view, 0.05, 'page'), 0, 0.1);
    });

    it('puts the position in the middle when centering, unless an end is in the way', () => {
        near(revealView(view, 0.6, 'center'), 0.55, 0.65);
        near(revealView(view, 0.99, 'center'), 0.9, 1);
    });

    it('always ends with the position inside the view, keeping its size', () => {
        fc.assert(
            fc.property(
                ratio,
                level,
                ratio,
                fc.constantFrom<'page' | 'center'>('page', 'center'),
                (a, zoom, target, type) => {
                    const start = Math.min(a, 1 - 1 / zoom);
                    const from = { start, end: start + 1 / zoom };
                    const next = revealView(from, target, type);

                    expect(target).toBeGreaterThanOrEqual(next.start - 1e-9);
                    expect(target).toBeLessThanOrEqual(next.end + 1e-9);
                    expect(next.end - next.start).toBeCloseTo(
                        from.end - from.start,
                        9,
                    );
                },
            ),
        );
    });
});

describe('viewX and viewRatio', () => {
    it('maps the view to the width, leaving what is outside off the screen', () => {
        const view = { start: 0.5, end: 0.75 };

        expect(viewX(0.5, view, 800)).toBe(0);
        expect(viewX(0.625, view, 800)).toBe(400);
        expect(viewX(1, view, 800)).toBe(1600);
        expect(viewX(0.25, view, 800)).toBe(-800);
    });

    it('maps a pointer back into the view, holding it at the edges', () => {
        const view = { start: 0.5, end: 0.75 };

        expect(viewRatio(400, view, 800)).toBe(0.625);
        expect(viewRatio(-50, view, 800)).toBe(0.5);
        expect(viewRatio(900, view, 800)).toBe(0.75);
        expect(viewRatio(10, view, 0)).toBe(0.5);
    });

    it('is the same as the whole-width mapping for the whole sound', () => {
        expect(viewX(0.3, FULL_VIEW, 500)).toBe(150);
        expect(viewRatio(150, FULL_VIEW, 500)).toBe(0.3);
    });

    it('comes back to the same ratio after x and back, for any view', () => {
        fc.assert(
            fc.property(ratio, level, ratio, (a, zoom, at) => {
                const start = Math.min(a, 1 - 1 / zoom);
                const view = { start, end: start + 1 / zoom };
                const point = view.start + at * (view.end - view.start);

                expect(
                    viewRatio(viewX(point, view, 1234), view, 1234),
                ).toBeCloseTo(point, 9);
            }),
        );
    });
});
