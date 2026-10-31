/**
 * A text too long for its room walks across it: it waits at its start, walks at a steady speed
 * until its end shows, waits there, and starts over.
 */

/** One round of the walk: its length in milliseconds, and where the walk starts and ends in it (0 to 1). */
export type MarqueeTiming = { duration: number; start: number; end: number };

/**
 * The round for a text `overflow` CSS pixels wider than its room, walked at `speed` pixels a
 * second with `pause` milliseconds at each end; `null` when there is nothing to walk.
 */
export function marqueeTiming(
    overflow: number,
    speed: number,
    pause: number,
): MarqueeTiming | null {
    if (!(overflow > 0) || !(speed > 0) || !Number.isFinite(overflow)) {
        return null;
    }

    const rest = Number.isFinite(pause) && pause > 0 ? pause : 0;
    const walk = (overflow / speed) * 1000;
    const duration = rest + walk + rest;

    return {
        duration,
        start: rest / duration,
        end: (rest + walk) / duration,
    };
}
