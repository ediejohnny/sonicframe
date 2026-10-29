import { describe, expect, it } from 'vite-plus/test';
import { barMetrics, layoutBars } from '../src/core/layout';
import {
    DEFAULT_WAVE,
    knobSpot,
    MAX_CELLS,
    resolveWave,
    WAVE_NAMES,
    waveShape,
    type WaveShape,
} from '../src/core/shapes';
import type { BarStyle, WaveName } from '../src/types';

const BAR: BarStyle = {
    width: 3,
    gap: 2,
    radius: 1.5,
    minHeight: 2,
    align: 'center',
    curve: 1,
};

function wave(count: number): number[] {
    return Array.from(
        { length: count },
        (_, i) => Math.abs(Math.sin(i * 0.37)) * 0.9 + 0.05,
    );
}

/** Shapes a drawing as a frame does: one value per bar that fits. */
function shape(
    style: WaveName,
    width = 300,
    height = 40,
    ratio = 1,
    bar: BarStyle = BAR,
): WaveShape {
    const { count } = barMetrics(width, bar, ratio);

    return waveShape(
        wave(count),
        width,
        height,
        bar,
        { ...DEFAULT_WAVE, style },
        ratio,
    );
}

/** Every rectangle, circle and point of a shape lies inside the frame. */
function inside(drawn: WaveShape, width: number, height: number): boolean {
    const rects = drawn.rects.every(
        (rect) =>
            rect.x >= 0 &&
            rect.y >= 0 &&
            rect.x + rect.width <= width &&
            rect.y + rect.height <= height,
    );
    const circles = drawn.circles.every(
        (circle) =>
            circle.x - circle.radius >= 0 &&
            circle.y - circle.radius >= 0 &&
            circle.x + circle.radius <= width &&
            circle.y + circle.radius <= height,
    );
    const points = drawn.lines.every((line) =>
        line.points.every((value, index) =>
            index % 2 === 0
                ? value >= 0 && value <= width
                : value >= 0 && value <= height,
        ),
    );

    return rects && circles && points;
}

describe('resolveWave', () => {
    it('takes a drawing by name and keeps the rest', () => {
        const base = { ...DEFAULT_WAVE, knob: 10 };

        expect(resolveWave(base, 'line')).toEqual({ ...base, style: 'line' });
    });

    it('falls back for an unknown drawing and keeps numbers in range', () => {
        const wave = resolveWave(DEFAULT_WAVE, {
            style: 'flames' as WaveName,
            lineWidth: 1000,
            glow: -4,
            knob: Number.NaN,
        });

        expect(wave.style).toBe('bars');
        expect(wave.lineWidth).toBe(16);
        expect(wave.glow).toBe(0);
        expect(wave.knob).toBe(DEFAULT_WAVE.knob);
    });
});

describe('waveShape', () => {
    it('keeps every drawing inside the frame at any density', () => {
        for (const style of WAVE_NAMES) {
            for (const ratio of [1, 1.5, 2, 3]) {
                const width = Math.round(300 * ratio);
                const height = Math.round(40 * ratio);

                expect(
                    inside(shape(style, width, height, ratio), width, height),
                ).toBe(true);
            }
        }
    });

    it('draws the bars exactly as the bar layout does', () => {
        const { count } = barMetrics(300, BAR, 1);

        expect(shape('bars').rects).toEqual(
            layoutBars(wave(count), 300, 40, BAR, 1),
        );
    });

    it('fills the shapes and strokes the lines', () => {
        for (const style of WAVE_NAMES) {
            const drawn = shape(style);
            const strokes = ['line', 'scope', 'pulse'].includes(style);

            expect(drawn.mode).toBe(strokes ? 'stroke' : 'fill');
        }
    });

    it('draws nothing without values, except the track', () => {
        for (const style of WAVE_NAMES) {
            const drawn = waveShape(
                [],
                300,
                40,
                BAR,
                { ...DEFAULT_WAVE, style },
                1,
            );
            const pieces =
                drawn.rects.length + drawn.circles.length + drawn.lines.length;

            expect(pieces > 0).toBe(style === 'track');
        }
    });

    it('mirrors the line around the middle', () => {
        const drawn = shape('line');
        const [top, bottom] = drawn.lines;

        expect(drawn.lines).toHaveLength(2);
        top.points.forEach((value, index) => {
            if (index % 2 === 1) {
                expect(value + bottom.points[index]).toBeCloseTo(40);
            }
        });
    });

    it('swings the scope to both sides of the middle', () => {
        const ys = shape('scope').lines[0].points.filter((_, i) => i % 2 === 1);

        expect(ys.some((y) => y < 20)).toBe(true);
        expect(ys.some((y) => y > 20)).toBe(true);
    });

    it('beats the pulse from a flat middle line', () => {
        const points = shape('pulse').lines[0].points;
        const ys = points.filter((_, i) => i % 2 === 1);

        expect(ys[0]).toBe(20);
        expect(ys.at(-1)).toBe(20);
        expect(Math.min(...ys)).toBeLessThan(20);
    });

    it('stays flat on silence for the pulse', () => {
        const drawn = waveShape(
            [0, 0, 0, 0],
            40,
            40,
            BAR,
            { ...DEFAULT_WAVE, style: 'pulse' },
            1,
        );
        const ys = drawn.lines[0].points.filter((_, i) => i % 2 === 1);

        expect(new Set(ys)).toEqual(new Set([20]));
    });

    it('caps the blocks and dots on a huge frame', () => {
        const bar = { ...BAR, width: 1, gap: 0 };

        for (const style of ['blocks', 'dots'] as const) {
            const drawn = shape(style, 4000, 4000, 1, bar);
            const pieces = drawn.rects.length + drawn.circles.length;

            expect(pieces).toBeGreaterThan(0);
            expect(pieces).toBeLessThanOrEqual(MAX_CELLS);
        }
    });

    it('lays the track as one rail across the whole width', () => {
        const [rail] = shape('track').rects;

        expect(rail.x).toBe(0);
        expect(rail.width).toBe(300);
        expect(rail.y + rail.height / 2).toBe(20);
    });
});

describe('knobSpot', () => {
    it('follows the played edge and never leaves the frame', () => {
        const wave = { ...DEFAULT_WAVE, knob: 12 };

        expect(knobSpot(150, 300, 40, wave, 'center', 1)).toEqual({
            x: 150,
            y: 20,
            radius: 6,
        });
        expect(knobSpot(0, 300, 40, wave, 'center', 1)?.x).toBe(6);
        expect(knobSpot(300, 300, 40, wave, 'center', 1)?.x).toBe(294);
    });

    it('draws no knob unless asked', () => {
        expect(knobSpot(150, 300, 40, DEFAULT_WAVE, 'center', 1)).toBeNull();
    });
});
