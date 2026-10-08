/**
 * Bar geometry in whole device pixels: every bar has the same width, starts on a whole pixel and keeps
 * its gap, so edges stay sharp at any zoom or screen density.
 */

import type { BarStyle } from '../types';
import { clamp01 } from './math';

/** One bar, in device pixels. */
export type Bar = {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
};

export type BarMetrics = {
    /** Width of one bar. */
    width: number;
    /** Space between two bars. */
    gap: number;
    /** How many bars fit. */
    count: number;
};

/** Bar width, gap and how many bars fit across `width` device pixels. */
export function barMetrics(
    width: number,
    bar: Pick<BarStyle, 'width' | 'gap'>,
    pixelRatio: number,
): BarMetrics {
    const ratio = pixelRatio > 0 ? pixelRatio : 1;
    const barWidth = Math.max(1, Math.round(bar.width * ratio));
    const gap = bar.gap > 0 ? Math.max(1, Math.round(bar.gap * ratio)) : 0;
    const count =
        width >= barWidth ? Math.floor((width + gap) / (barWidth + gap)) : 0;

    return { width: barWidth, gap, count };
}

/**
 * Places one bar per value (0..1) across the whole width: the first bar starts at the left edge and the
 * last one ends at the right edge. Bars never overlap; without a gap they touch, drawing one shape.
 * Centered bars keep the same parity as the height, so they are exactly symmetric.
 */
export function layoutBars(
    values: readonly number[],
    width: number,
    height: number,
    bar: BarStyle,
    pixelRatio: number,
): Bar[] {
    const metrics = barMetrics(width, bar, pixelRatio);
    const count = values.length;

    if (count === 0 || metrics.count === 0 || height <= 0) {
        return [];
    }

    const ratio = pixelRatio > 0 ? pixelRatio : 1;
    const curve = bar.curve > 0 ? bar.curve : 1;
    const minimum = Math.min(
        height,
        Math.max(1, Math.round(bar.minHeight * ratio)),
    );
    const step = count > 1 ? (width - metrics.width) / (count - 1) : 0;
    const left = (index: number): number =>
        count > 1
            ? Math.round(index * step)
            : Math.round((width - metrics.width) / 2);

    return values.map((value, index) => {
        let barHeight = Math.min(
            height,
            Math.max(minimum, Math.round(clamp01(value) ** curve * height)),
        );

        if (bar.align === 'center' && (height - barHeight) % 2 !== 0) {
            barHeight += 1;
        }

        const x = left(index);
        const barWidth =
            metrics.gap === 0 && index < count - 1
                ? Math.max(metrics.width, left(index + 1) - x)
                : metrics.width;

        return {
            x,
            y:
                bar.align === 'bottom'
                    ? height - barHeight
                    : (height - barHeight) / 2,
            width: barWidth,
            height: barHeight,
            radius: Math.max(
                0,
                Math.min(
                    Math.round(bar.radius * ratio),
                    Math.floor(barWidth / 2),
                    Math.floor(barHeight / 2),
                ),
            ),
        };
    });
}
