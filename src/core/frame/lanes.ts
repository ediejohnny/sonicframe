/**
 * How much room the strips above and below the bars take, and how much is left for the wave. A lane
 * is a caption, a timeline or anything a plugin stacks outside the bars; the wave shrinks to make
 * room. The wave is never allowed below `MIN_WAVE`: if the lanes would not fit, the outermost ones
 * are dropped (the caller then leaves those lanes off the page).
 */

/** The least height, in CSS pixels, the wave is allowed to keep. */
export const MIN_WAVE = 8;

export type LaneInset = {
    /** CSS pixels taken above the bars (the canvas's top offset). */
    top: number;
    /** CSS pixels taken below the bars. */
    bottom: number;
    /** CSS pixels left for the bars. */
    waveHeight: number;
    /** The lanes that fit, nearest the bars first (the rest were dropped). */
    above: number[];
    /** The lanes that fit, nearest the bars first. */
    below: number[];
};

function total(sizes: readonly number[]): number {
    return sizes.reduce((sum, size) => sum + size, 0);
}

/**
 * Splits `heightCss` between the lanes and the wave. `above` and `below` are lane sizes nearest the
 * bars first; non-positive sizes are ignored. Lanes that would push the wave below `minWave` are
 * dropped from the outside in, below before above.
 */
export function stackLanes(
    above: readonly number[],
    below: readonly number[],
    heightCss: number,
    minWave: number = MIN_WAVE,
): LaneInset {
    const keptAbove = above.filter((size) => size > 0);
    const keptBelow = below.filter((size) => size > 0);

    while (
        heightCss - total(keptAbove) - total(keptBelow) < minWave &&
        keptAbove.length + keptBelow.length > 0
    ) {
        if (keptBelow.length > 0) {
            keptBelow.pop();
        } else {
            keptAbove.pop();
        }
    }

    const top = total(keptAbove);
    const bottom = total(keptBelow);

    return {
        top,
        bottom,
        waveHeight: Math.max(0, heightCss - top - bottom),
        above: keptAbove,
        below: keptBelow,
    };
}
