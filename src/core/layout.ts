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
 * The bars on screen of a row laid over the whole sound, `virtualWidth` device pixels wide (the width
 * ÷ the view's size): bars `first` to `first + count - 1` of `total`, shifted left by `offset`. Bar k
 * always covers the same piece of sound, so scrolling never makes the bars swim.
 */
export type BarWindow = {
    total: number;
    first: number;
    count: number;
    virtualWidth: number;
    offset: number;
};

/** The window of bars that covers `width` device pixels showing `view` (ratios of the sound). */
export function barWindow(
    width: number,
    view: { start: number; end: number },
    bar: Pick<BarStyle, 'width' | 'gap'>,
    pixelRatio: number,
): BarWindow {
    const virtualWidth = width / (view.end - view.start);
    const metrics = barMetrics(virtualWidth, bar, pixelRatio);
    const total = metrics.count;
    const offset = Math.round(view.start * virtualWidth);
    const step = total > 1 ? (virtualWidth - metrics.width) / (total - 1) : 0;

    if (total <= 1 || step <= 0) {
        return { total, first: 0, count: total, virtualWidth, offset };
    }

    const first = Math.max(0, Math.floor((offset - metrics.width) / step));
    const last = Math.min(total - 1, Math.ceil((offset + width) / step));

    return { total, first, count: last - first + 1, virtualWidth, offset };
}

/**
 * Places one bar per value (0..1) across the whole width: the first bar starts at the left edge and the
 * last one ends at the right edge. With a window of the row (`grid`), the values are its bars,
 * placed on its row and shifted to the screen. Bars never overlap; without a gap they touch, drawing one shape. Centered
 * bars keep the same parity as the height, so they are exactly symmetric.
 */
export function layoutBars(
    values: readonly number[],
    width: number,
    height: number,
    bar: BarStyle,
    pixelRatio: number,
    grid?: BarWindow,
): Bar[] {
    const row = grid?.virtualWidth ?? width;
    const metrics = barMetrics(row, bar, pixelRatio);
    const count = grid?.total ?? values.length;
    const first = grid?.first ?? 0;
    const offset = grid?.offset ?? 0;

    if (values.length === 0 || metrics.count === 0 || height <= 0) {
        return [];
    }

    const ratio = pixelRatio > 0 ? pixelRatio : 1;
    const curve = bar.curve > 0 ? bar.curve : 1;
    const minimum = Math.min(
        height,
        Math.max(1, Math.round(bar.minHeight * ratio)),
    );
    const step = count > 1 ? (row - metrics.width) / (count - 1) : 0;
    const left = (index: number): number =>
        (count > 1
            ? Math.round((first + index) * step)
            : Math.round((row - metrics.width) / 2)) - offset;

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
            metrics.gap === 0 && first + index < count - 1
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
