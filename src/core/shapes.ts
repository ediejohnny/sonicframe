/**
 * The ways to draw the sound, as pure geometry in device pixels: rectangles (bars, needles, blocks,
 * the track), circles (dots) and runs of points (steps, line, area, scope, pulse). The page turns a
 * shape into one cached path and fills or strokes it through the same clips as the bars, so the
 * played, hover and unplayed colors work for every drawing. Every piece stays inside the frame, and
 * the number of pieces is capped.
 */

import type { BarStyle, WaveName, WaveStyle } from '../types';
import { layoutBars, type Bar, type BarWindow } from './layout';
import { clamp01 } from './math';

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

/** The most blocks or dots one drawing makes; past it the cells grow taller. */
export const MAX_CELLS = 20000;

/** How wide one heartbeat of the pulse is, in CSS pixels. */
const BEAT = 12;

/** A circle, in device pixels. */
export type Circle = { x: number; y: number; radius: number };

/** A run of points `[x0, y0, x1, y1, ...]`, closed back to its start or left open. */
export type Polyline = { points: number[]; closed: boolean };

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
    return (
        typeof value === 'string' &&
        (WAVE_NAMES as readonly string[]).includes(value)
    );
}

function within(
    value: number | undefined,
    fallback: number,
    lo: number,
    hi: number,
): number {
    return value !== undefined && Number.isFinite(value)
        ? Math.min(hi, Math.max(lo, value))
        : fallback;
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
 * the track needs no values at all. With a window, the values are its bars (see `BarWindow`), and the
 * scope's swings and the pulse's beats stay on the same bars while the view scrolls.
 */
export function waveShape(
    values: readonly number[],
    width: number,
    height: number,
    bar: BarStyle,
    wave: WaveStyle,
    pixelRatio: number,
    window?: BarWindow,
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

    const bars = layoutBars(values, width, height, bar, ratio, window);
    const first = window?.first ?? 0;

    if (bars.length === 0) {
        return shape;
    }

    switch (wave.style) {
        case 'needles':
            shape.rects = needles(bars, ratio);
            break;
        case 'blocks':
        case 'dots':
            cells(shape, bars, height, bar, ratio, wave.style);
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
                    window,
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

/** One rail across the whole width, as thick as the line, with round ends. */
function rail(
    width: number,
    height: number,
    thickness: number,
    align: BarStyle['align'],
): Bar {
    const tall = Math.min(height, thickness);

    return {
        x: 0,
        y: align === 'bottom' ? height - tall : Math.round((height - tall) / 2),
        width,
        height: tall,
        radius: Math.floor(tall / 2),
    };
}

/** Each bar thinned to one CSS pixel, centered in its place. */
function needles(bars: readonly Bar[], ratio: number): Bar[] {
    const thin = Math.max(1, Math.round(ratio));

    return bars.map((bar) => {
        const width = Math.min(bar.width, thin);

        return {
            x: bar.x + Math.floor((bar.width - width) / 2),
            y: bar.y,
            width,
            height: bar.height,
            radius: 0,
        };
    });
}

/** Each bar as a column of square cells (blocks) or round ones (dots), as tall as the bar. */
function cells(
    shape: WaveShape,
    bars: readonly Bar[],
    height: number,
    bar: BarStyle,
    ratio: number,
    style: 'blocks' | 'dots',
): void {
    const gap = Math.max(1, Math.round((bar.gap > 0 ? bar.gap : 1) * ratio));
    let size = Math.max(1, Math.round(bar.width * ratio));
    let fit = Math.floor((height + gap) / (size + gap));

    // Past the cap the cells grow taller, so a huge frame never makes millions of pieces.
    while (fit > 1 && bars.length * fit > MAX_CELLS) {
        size *= 2;
        fit = Math.floor((height + gap) / (size + gap));
    }

    fit = Math.max(1, fit);
    size = Math.min(size, height);

    for (const column of bars) {
        const count = Math.min(
            fit,
            Math.max(1, Math.round((column.height + gap) / (size + gap))),
        );
        const tall = count * size + (count - 1) * gap;
        const top =
            bar.align === 'bottom'
                ? height - tall
                : Math.round((height - tall) / 2);

        for (let index = 0; index < count; index++) {
            const y = top + index * (size + gap);

            if (style === 'dots') {
                shape.circles.push({
                    x: column.x + column.width / 2,
                    y: y + size / 2,
                    radius: Math.min(column.width, size) / 2,
                });
            } else {
                shape.rects.push({
                    x: column.x,
                    y,
                    width: column.width,
                    height: size,
                    radius: Math.max(
                        0,
                        Math.min(
                            Math.round(bar.radius * ratio),
                            Math.floor(Math.min(column.width, size) / 2),
                        ),
                    ),
                });
            }
        }
    }
}

/** Where one bar's place ends and the next begins, from the left edge to the right one. */
function boundaries(bars: readonly Bar[], width: number): number[] {
    const centers = bars.map((bar) => bar.x + bar.width / 2);
    const edges = [0];

    for (let index = 1; index < centers.length; index++) {
        edges.push(Math.round((centers[index - 1] + centers[index]) / 2));
    }

    edges.push(width);

    return edges;
}

/** The outline of the bars with flat tops that meet edge to edge: an 8-bit staircase. */
function steps(
    bars: readonly Bar[],
    width: number,
    height: number,
    align: BarStyle['align'],
): Polyline {
    const edges = boundaries(bars, width);
    const points: number[] = [];

    bars.forEach((bar, index) => {
        points.push(edges[index], bar.y, edges[index + 1], bar.y);
    });

    if (align === 'bottom') {
        points.push(width, height, 0, height);
    } else {
        for (let index = bars.length - 1; index >= 0; index--) {
            const bottom = bars[index].y + bars[index].height;
            points.push(edges[index + 1], bottom, edges[index], bottom);
        }
    }

    return { points, closed: true };
}

/** The upper edge of the sound through the bar centers, and the lower one when mirrored. */
function edges(
    bars: readonly Bar[],
    height: number,
    lineWidth: number,
    mirror: boolean,
): Polyline[] {
    const half = lineWidth / 2;
    const inside = (y: number): number =>
        Math.min(height - half, Math.max(half, y));
    const top: number[] = [];
    const bottom: number[] = [];

    for (const bar of bars) {
        const x = bar.x + bar.width / 2;
        top.push(x, inside(bar.y));
        bottom.push(x, inside(bar.y + bar.height));
    }

    return mirror
        ? [
              { points: top, closed: false },
              { points: bottom, closed: false },
          ]
        : [{ points: top, closed: false }];
}

/** The sound as one filled shape: its upper edge, then its lower edge (or the floor) back. */
function area(
    bars: readonly Bar[],
    width: number,
    height: number,
    align: BarStyle['align'],
): Polyline {
    const first = bars[0];
    const last = bars[bars.length - 1];
    const points: number[] = [0, first.y];

    for (const bar of bars) {
        points.push(bar.x + bar.width / 2, bar.y);
    }

    points.push(width, last.y);

    if (align === 'bottom') {
        points.push(width, height, 0, height);
    } else {
        points.push(width, last.y + last.height);

        for (let index = bars.length - 1; index >= 0; index--) {
            const bar = bars[index];
            points.push(bar.x + bar.width / 2, bar.y + bar.height);
        }

        points.push(0, first.y + first.height);
    }

    return { points, closed: true };
}

/**
 * An oscilloscope trace: one line swinging above and below the middle, as far as each bar reaches.
 * Bar k of the row (`first` + its index) swings up when k is even.
 */
function scope(
    bars: readonly Bar[],
    width: number,
    height: number,
    lineWidth: number,
    first: number,
): Polyline {
    const middle = height / 2;
    const reach = Math.max(0, middle - lineWidth / 2);
    const points = [0, middle];

    bars.forEach((bar, index) => {
        const swing = Math.min(reach, bar.height / 2);
        points.push(
            bar.x + bar.width / 2,
            (first + index) % 2 === 0 ? middle - swing : middle + swing,
        );
    });

    points.push(width, middle);

    return { points, closed: false };
}

/**
 * A heartbeat monitor: a flat middle line that beats once every few bars, as high as the loudest
 * of them (with no minimum height, so silence stays flat). With a window, the beats are groups of
 * the whole row, so each one keeps its place on the sound while the view scrolls.
 */
function pulse(
    values: readonly number[],
    bars: readonly Bar[],
    width: number,
    height: number,
    bar: BarStyle,
    lineWidth: number,
    ratio: number,
    window: BarWindow | undefined,
): Polyline {
    const middle = height / 2;
    const reach = Math.max(0, middle - lineWidth / 2);
    const curve = bar.curve > 0 ? bar.curve : 1;
    const edges = boundaries(bars, width);
    const slot = window
        ? window.virtualWidth / Math.max(1, window.total)
        : width / bars.length;
    const group = Math.max(1, Math.round((BEAT * ratio) / Math.max(1, slot)));
    const first = window?.first ?? 0;
    const points = [0, middle];

    // Groups start at whole multiples of `group` along the row; the first one may begin off screen.
    for (
        let start = first - (first % group);
        start < first + bars.length;
        start += group
    ) {
        const end = Math.min(first + bars.length, start + group);
        let level = 0;

        for (let index = Math.max(start, first); index < end; index++) {
            level = Math.max(level, clamp01(values[index - first]) ** curve);
        }

        const swing = level * reach;

        if (swing >= 0.5) {
            const from = window ? start * slot - window.offset : edges[start];
            const span = window
                ? (Math.min(start + group, window.total) - start) * slot
                : edges[end] - from;

            points.push(
                from + span * 0.35,
                middle,
                from + span * 0.5,
                middle - swing,
                from + span * 0.65,
                middle + swing * 0.45,
                from + span * 0.8,
                middle,
            );
        }
    }

    points.push(width, middle);

    return { points, closed: false };
}
