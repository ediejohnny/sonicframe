import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { arrowOffset } from '../src/core/place';

describe('arrowOffset', () => {
    it("points at the anchor's middle from the box's left edge", () => {
        // An anchor from 300 to 340 (middle 320) under a box that starts at 200.
        expect(arrowOffset({ left: 300, width: 40 }, 200, 240, 12)).toBe(120);
    });

    it('stays inside the box, away from its corners, when the anchor is past an edge', () => {
        expect(arrowOffset({ left: 0, width: 10 }, 100, 240, 12)).toBe(12);
        expect(arrowOffset({ left: 900, width: 10 }, 100, 240, 12)).toBe(228);
    });

    it('keeps to the middle of a box too narrow for its insets', () => {
        expect(arrowOffset({ left: 0, width: 10 }, 0, 16, 12)).toBe(8);
    });

    it('always lands inside the box, and on the anchor whenever it can', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -500, max: 2000 }),
                fc.integer({ min: 0, max: 400 }),
                fc.integer({ min: -500, max: 2000 }),
                fc.integer({ min: 30, max: 800 }),
                fc.integer({ min: 0, max: 14 }),
                (anchorLeft, anchorWidth, boxLeft, boxWidth, inset) => {
                    const x = arrowOffset(
                        { left: anchorLeft, width: anchorWidth },
                        boxLeft,
                        boxWidth,
                        inset,
                    );
                    const wanted = anchorLeft + anchorWidth / 2 - boxLeft;

                    expect(x).toBeGreaterThanOrEqual(inset);
                    expect(x).toBeLessThanOrEqual(boxWidth - inset);

                    if (wanted >= inset && wanted <= boxWidth - inset) {
                        expect(x).toBe(wanted);
                    }
                },
            ),
        );
    });
});
