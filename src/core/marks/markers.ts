/**
 * Where markers go, kept pure: a marker is a moment in seconds, placed across a width through the
 * view; moments that are not finite numbers, and those outside the view, are left out.
 */

import { clamp01, positive } from '../shared/math';
import { cleanText } from '../shared/text';
import { FULL_VIEW, viewX, type View } from '../view/view';

/** One marker: a moment in seconds, with an optional label, color and id. */
export type Mark = {
    time: number;
    label?: string;
    color?: string;
    id?: string;
};

/** Whether a ratio of the sound is in `view` (its ends included). */
function inView(ratio: number, view: View): boolean {
    return ratio >= view.start && ratio <= view.end;
}

/**
 * Where each marker line goes, in device pixels: centered on its moment and never outside the frame.
 * Moments that are not finite numbers are skipped, and so are those outside `view` (the whole sound
 * by default).
 */
export function markerSpans(
    times: readonly number[],
    duration: number | null,
    width: number,
    size: number,
    view: View = FULL_VIEW,
): { x: number; width: number }[] {
    const known = positive(duration);

    if (known === null || width <= 0) {
        return [];
    }

    const lineWidth = Math.max(1, Math.min(size, width));

    return times
        .filter(
            (time) =>
                Number.isFinite(time) && inView(clamp01(time / known), view),
        )
        .map((time) => ({
            x: Math.min(
                width - lineWidth,
                Math.max(
                    0,
                    Math.round(
                        viewX(clamp01(time / known), view, width) -
                            lineWidth / 2,
                    ),
                ),
            ),
            width: lineWidth,
        }));
}

/** Plain moments or marks as marks, each label cleaned and cut to 120 characters. */
export function toMarks(next: readonly number[] | readonly Mark[]): Mark[] {
    return next.map((item) =>
        typeof item === 'number'
            ? { time: item }
            : {
                  ...item,
                  label:
                      item.label === undefined
                          ? undefined
                          : cleanText(item.label, 120),
              },
    );
}

/** The marks with finite times, sorted by time. */
export function sortedMarks(marks: readonly Mark[]): Mark[] {
    return marks
        .filter((mark) => Number.isFinite(mark.time))
        .sort((a, b) => a.time - b.time);
}

/** The marks in `view`, sorted, and their centers across `width` through it. */
export function placeMarks(
    marks: readonly Mark[],
    width: number,
    duration: number,
    view: View,
): { order: Mark[]; centers: number[] } {
    const order = sortedMarks(marks).filter((mark) =>
        inView(clamp01(mark.time / duration), view),
    );

    return {
        order,
        centers: order.map((mark) =>
            viewX(clamp01(mark.time / duration), view, width),
        ),
    };
}
