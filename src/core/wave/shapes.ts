/**
 * The ways to draw the sound, as pure geometry in device pixels: rectangles (bars, needles, blocks,
 * the track), circles (dots) and runs of points (steps, line, area, scope, pulse). The page turns a
 * shape into one cached path and fills or strokes it through the same clips as the bars, so the
 * played, hover and unplayed colors work for every drawing. Every piece stays inside the frame, and
 * the number of pieces is capped.
 */

import type { BarStyle, WaveName, WaveStyle } from '../../types';
import { isOneOf, within } from '../shared/checked';
import { layoutBars, type Bar, type BarWindow } from './layout';
import { cells, needles, rail, type Circle } from './pieces';
import { area, edges, pulse, scope, steps, type Polyline } from './traces';

export const WAVE_NAMES: readonly WaveName[] = Object.freeze([
    'bars',
    'needles',
    'blocks',
    'dots',
    'steps',
    'line',
    'area',
    'scope',
    'pulse',
    'track',
] as const);

export const DEFAULT_WAVE: Readonly<WaveStyle> = Object.freeze({
    style: 'bars',
    lineWidth: 2,
    glow: 0,
    mirror: true,
    smooth: true,
    knob: 0,
});

export type WaveShape = {
    /** Fill the pieces, or stroke them as lines. */
    mode: 'fill' | 'stroke';
    rects: Bar[];
    circles: Circle[];
    lines: Polyline[];
    /** Curves through the points instead of corners. */
    smooth: boolean;
    /** Stroke thickness, in device pixels. */
    lineWidth: number;
};

const STROKED: readonly WaveName[] = ['line', 'scope', 'pulse'];

export function isWaveName(value: unknown): value is WaveName {
    return isOneOf(value, WAVE_NAMES);
}

/** A drawing by name, or details laid over `base`; unknown names and stray numbers fall back. */
export function resolveWave(
    base: WaveStyle,
    input: WaveName | Partial<WaveStyle> | undefined,
): WaveStyle {
    const given: Partial<WaveStyle> =
        typeof input === 'string' ? { style: input } : (input ?? {});

    return {
        style: isWaveName(given.style) ? given.style : base.style,
        lineWidth: within(given.lineWidth, base.lineWidth, 0.5, 16),
        glow: within(given.glow, base.glow, 0, 32),
        mirror: typeof given.mirror === 'boolean' ? given.mirror : base.mirror,
        smooth: typeof given.smooth === 'boolean' ? given.smooth : base.smooth,
        knob: within(given.knob, base.knob, 0, 64),
    };
}

/**
 * Shapes one drawing of `values` (0..1, one per bar that fits) across `width` × `height` device
 * pixels. The bar layout gives every drawing the same density, curve, minimum height and alignment;
 * the track needs no values at all. With a window of the row (`grid`, see `BarWindow`), the values
 * are its bars, and the scope's swings and the pulse's beats stay on the same bars while the view
 * scrolls.
 */
export function waveShape(
    values: readonly number[],
    width: number,
    height: number,
    bar: BarStyle,
    wave: WaveStyle,
    pixelRatio: number,
    grid?: BarWindow,
): WaveShape {
    const ratio = pixelRatio > 0 ? pixelRatio : 1;
    const shape: WaveShape = {
        mode: STROKED.includes(wave.style) ? 'stroke' : 'fill',
        rects: [],
        circles: [],
        lines: [],
        smooth: false,
        lineWidth: Math.max(
            1,
            Math.min(height, Math.round(wave.lineWidth * ratio)),
        ),
    };

    if (width <= 0 || height <= 0) {
        return shape;
    }

    if (wave.style === 'track') {
        shape.rects.push(rail(width, height, shape.lineWidth, bar.align));

        return shape;
    }

    const bars = layoutBars(values, width, height, bar, ratio, grid);
    const first = grid?.first ?? 0;

    if (bars.length === 0) {
        return shape;
    }

    switch (wave.style) {
        case 'needles':
            shape.rects = needles(bars, ratio);
            break;
        case 'blocks':
        case 'dots':
            Object.assign(shape, cells(bars, height, bar, ratio, wave.style));
            break;
        case 'steps':
            shape.lines.push(steps(bars, width, height, bar.align));
            break;
        case 'line':
            shape.lines.push(
                ...edges(
                    bars,
                    height,
                    shape.lineWidth,
                    wave.mirror && bar.align === 'center',
                ),
            );
            shape.smooth = wave.smooth;
            break;
        case 'area':
            shape.lines.push(area(bars, width, height, bar.align));
            shape.smooth = wave.smooth;
            break;
        case 'scope':
            shape.lines.push(
                scope(bars, width, height, shape.lineWidth, first),
            );
            shape.smooth = wave.smooth;
            break;
        case 'pulse':
            shape.lines.push(
                pulse(
                    values,
                    bars,
                    width,
                    height,
                    bar,
                    shape.lineWidth,
                    ratio,
                    grid,
                ),
            );
            break;
        default:
            shape.rects = bars;
    }

    return shape;
}

/** The dot riding the played edge, kept whole inside the frame; null when `wave.knob` is 0. */
export function knobSpot(
    progress: number,
    width: number,
    height: number,
    wave: WaveStyle,
    align: BarStyle['align'],
    pixelRatio: number,
): Circle | null {
    const ratio = pixelRatio > 0 ? pixelRatio : 1;
    const diameter = Math.min(width, height, Math.round(wave.knob * ratio));

    if (diameter <= 0) {
        return null;
    }

    const radius = diameter / 2;

    return {
        x: Math.min(width - radius, Math.max(radius, progress)),
        y: align === 'bottom' ? height - radius : height / 2,
        radius,
    };
}
