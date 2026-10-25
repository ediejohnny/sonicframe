/**
 * The maths of regions (stretches of the sound a listener can mark, play or loop), kept pure. A
 * region is ordered and clamped to the sound and never shorter than a minimum; hit-testing says
 * whether a position lands on a region's start edge, its end edge, or its body, with an edge zone
 * wide enough to grab on a touch screen (WCAG 2.5.8).
 */

export type RegionPart = 'start' | 'end' | 'body';

/** A region laid out in pixels, for hit-testing. */
export type LaidRegion = { start: number; end: number };

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** Orders `start`/`end`, clamps them to `0..duration`, and keeps the region at least `minLength`. */
export function normalizeRegion(
    start: number,
    end: number,
    duration: number,
    minLength: number,
): { start: number; end: number } {
    let from = clamp(Math.min(start, end), 0, duration);
    let to = clamp(Math.max(start, end), 0, duration);

    if (to - from < minLength) {
        to = Math.min(duration, from + minLength);
        from = Math.max(0, to - minLength);
    }

    return { start: from, end: to };
}

/**
 * Which part of which region a position (in the same pixels as `laid`) lands on, topmost first
 * (`laid` is given in that order). `edge` is how close to a boundary still counts as the edge.
 */
export function hitRegion(
    x: number,
    laid: readonly LaidRegion[],
    edge: number,
): { index: number; part: RegionPart } | null {
    for (let index = 0; index < laid.length; index++) {
        const region = laid[index];

        if (Math.abs(x - region.start) <= edge) {
            return { index, part: 'start' };
        }

        if (Math.abs(x - region.end) <= edge) {
            return { index, part: 'end' };
        }

        if (x > region.start && x < region.end) {
            return { index, part: 'body' };
        }
    }

    return null;
}
