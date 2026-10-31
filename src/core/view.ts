/**
 * The view: the part of the sound on screen, as ratios of the whole sound from 0 to 1. Its zoom
 * level is 1 ÷ its size. Nothing here touches the page.
 */

import { clamp01 } from './math';

/** The part of the sound on screen: `start` < `end`, both from 0 to 1. */
export type View = { readonly start: number; readonly end: number };

/** The view, its zoom level (1 ÷ its size) and the largest level allowed. */
export type ViewState = View & {
    readonly level: number;
    readonly maxLevel: number;
};

export const FULL_VIEW: View = Object.freeze({ start: 0, end: 1 });

/**
 * The view `start`..`end` made possible: at least 1 ÷ `maxLevel` and at most the whole sound in size,
 * slid back inside the sound when it runs past an end. Numbers that are not finite give the whole
 * sound.
 */
export function fitView(start: number, end: number, maxLevel: number): View {
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return FULL_VIEW;
    }

    const max = Number.isFinite(maxLevel) && maxLevel > 1 ? maxLevel : 1;
    const span = Math.min(1, Math.max(1 / max, end - start));

    if (span >= 1) {
        return FULL_VIEW;
    }

    if (start <= 0) {
        return { start: 0, end: span };
    }

    if (start + span >= 1) {
        return { start: 1 - span, end: 1 };
    }

    return { start, end: start + span };
}

export function viewLevel(view: View): number {
    return 1 / (view.end - view.start);
}

/** The view at zoom `level` around the ratio `at`, which keeps its place on screen unless an end is in the way. */
export function zoomView(
    view: View,
    level: number,
    at: number,
    maxLevel: number,
): View {
    const span = 1 / Math.min(Math.max(1, maxLevel), Math.max(1, level));
    const place = clamp01((at - view.start) / (view.end - view.start));
    const start = clamp01(at) - place * span;

    return fitView(start, start + span, maxLevel);
}

/** The view moved to begin at `start`, keeping its size, stopped at the ends of the sound. */
export function scrollView(view: View, start: number): View {
    const span = view.end - view.start;

    return fitView(start, start + span, 1 / span);
}

/**
 * A view showing `ratio`: the same view when it already does; otherwise whole pages forward or back
 * (`'page'`), or the ratio in the middle (`'center'`), keeping the view's size.
 */
export function revealView(
    view: View,
    ratio: number,
    type: 'page' | 'center',
): View {
    const at = clamp01(ratio);

    if (at >= view.start && (at < view.end || view.end === 1)) {
        return view;
    }

    const span = view.end - view.start;
    const start =
        type === 'center'
            ? at - span / 2
            : view.start + Math.floor((at - view.start) / span) * span;

    return scrollView(view, start);
}

/** The x of a ratio of the sound across `width` showing `view`; a ratio off the view lands off the width. */
export function viewX(ratio: number, view: View, width: number): number {
    return ((ratio - view.start) / (view.end - view.start)) * width;
}

/** The ratio of the sound at `x` across `width` showing `view`; an x past an edge counts as that edge. */
export function viewRatio(x: number, view: View, width: number): number {
    const along = width > 0 ? clamp01(x / width) : 0;

    return view.start + along * (view.end - view.start);
}
