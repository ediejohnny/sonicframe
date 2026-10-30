import { describe, expect, it } from 'vite-plus/test';
import {
    cursorSpan,
    overlayOf,
    ratioAt,
    regions,
    sameOverlay,
    type Region,
} from '../src/core/scene';

/** Strips must tile the frame: start at 0, end at the width, no gap and no overlap. */
function expectTiled(strips: Region[], width: number): void {
    expect(strips[0].from).toBe(0);
    expect(strips.at(-1)!.to).toBe(width);

    for (let i = 1; i < strips.length; i++) {
        expect(strips[i].from).toBe(strips[i - 1].to);
    }
}

describe('regions', () => {
    it('splits played and not played without a hover', () => {
        const strips = regions({ progress: 40, hover: null }, 100);

        expect(strips.map((strip) => strip.kind)).toEqual(['progress', 'wave']);
        expectTiled(strips, 100);
    });

    it('puts the hover band ahead of the played part', () => {
        const strips = regions({ progress: 40, hover: 70 }, 100);

        expect(strips).toEqual([
            { kind: 'progress', from: 0, to: 40 },
            { kind: 'hover', from: 40, to: 70 },
            { kind: 'wave', from: 70, to: 100 },
        ]);
    });

    it('puts the hover band behind the played part', () => {
        const strips = regions({ progress: 70, hover: 20 }, 100);

        expect(strips).toEqual([
            { kind: 'progress', from: 0, to: 20 },
            { kind: 'hover', from: 20, to: 70 },
            { kind: 'wave', from: 70, to: 100 },
        ]);
    });

    it('leaves out empty strips at the edges', () => {
        expect(regions({ progress: 0, hover: null }, 50)).toEqual([
            { kind: 'wave', from: 0, to: 50 },
        ]);
        expect(regions({ progress: 50, hover: 50 }, 50)).toEqual([
            { kind: 'progress', from: 0, to: 50 },
        ]);
    });
});

describe('overlay and pointer', () => {
    it('rounds positions to whole device pixels and compares them', () => {
        const a = overlayOf(0.5004, null, 1000);
        const b = overlayOf(0.4996, null, 1000);

        expect(a).toEqual({
            progress: 500,
            hover: null,
            hovered: false,
            offscreen: false,
        });
        expect(sameOverlay(a, b)).toBe(true);
        expect(sameOverlay(a, overlayOf(0.5004, 0.2, 1000))).toBe(false);
        expect(sameOverlay(null, a)).toBe(false);
    });

    it('places positions through the view, holding the played edge inside and saying when it is out of view', () => {
        const view = { start: 0.5, end: 1 };

        expect(overlayOf(0.2, null, 200, false, view)).toEqual({
            progress: 0,
            hover: null,
            hovered: false,
            offscreen: true,
        });
        expect(overlayOf(0.75, 0.6, 200, true, view)).toEqual({
            progress: 100,
            hover: 40,
            hovered: true,
            offscreen: false,
        });
        expect(overlayOf(1, null, 200, false, view).offscreen).toBe(false);
        expect(
            overlayOf(0.6, null, 200, false, { start: 0, end: 0.5 }),
        ).toMatchObject({ progress: 200, offscreen: true });
        expect(
            sameOverlay(
                overlayOf(0.2, null, 200, false, view),
                overlayOf(0.5, null, 200, false, view),
            ),
        ).toBe(false);
    });

    it('turns a pointer offset into a position from 0 to 1', () => {
        expect(ratioAt(50, 200)).toBe(0.25);
        expect(ratioAt(-10, 200)).toBe(0);
        expect(ratioAt(500, 200)).toBe(1);
        expect(ratioAt(10, 0)).toBe(0);
    });

    it('keeps the cursor line inside the frame', () => {
        expect(cursorSpan(0, 4, 100)).toEqual({ x: 0, width: 4 });
        expect(cursorSpan(50, 4, 100)).toEqual({ x: 48, width: 4 });
        expect(cursorSpan(100, 4, 100)).toEqual({ x: 96, width: 4 });
    });
});
