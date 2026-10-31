/**
 * The drawings made of runs of points, as pure geometry in device pixels: steps, line, area, scope
 * and pulse. Every point stays inside the frame.
 */

import type { BarStyle } from '../../types';
import { clamp01 } from '../shared/math';
import type { Bar, BarWindow } from './layout';

/** How wide one heartbeat of the pulse is, in CSS pixels. */
const BEAT = 12;

/** A run of points `[x0, y0, x1, y1, ...]`, closed back to its start or left open. */
export type Polyline = { points: number[]; closed: boolean };

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
export function steps(
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
export function edges(
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
export function area(
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
export function scope(
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
export function pulse(
    values: readonly number[],
    bars: readonly Bar[],
    width: number,
    height: number,
    bar: BarStyle,
    lineWidth: number,
    ratio: number,
    grid: BarWindow | undefined,
): Polyline {
    const middle = height / 2;
    const reach = Math.max(0, middle - lineWidth / 2);
    const curve = bar.curve > 0 ? bar.curve : 1;
    const edges = boundaries(bars, width);
    const slot = grid
        ? grid.virtualWidth / Math.max(1, grid.total)
        : width / bars.length;
    const group = Math.max(1, Math.round((BEAT * ratio) / Math.max(1, slot)));
    const first = grid?.first ?? 0;
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
            const from = grid ? start * slot - grid.offset : edges[start];
            const span = grid
                ? (Math.min(start + group, grid.total) - start) * slot
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
