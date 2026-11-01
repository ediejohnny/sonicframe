/**
 * Stepping through a sound: through its starts (the parts of a description, chapters), the way a
 * player's next and previous track buttons do, and by a skip of some seconds.
 */

/**
 * Where a skip of `seconds` (back when negative) from `now` lands, as a share of a sound of
 * `duration` seconds, kept from 0 to 1.
 */
export function skipRatio(
    now: number,
    seconds: number,
    duration: number,
): number {
    return Math.min(1, Math.max(0, (now + seconds) / duration));
}

/** In seconds: a seek can land this much before the time it asked for. */
export const LANDING = 0.05;

/**
 * The index a step from `time` lands on among `starts` (ascending, in seconds), or null when there
 * is none. Forward, the first start after `time` (one within `LANDING` of it is where a step just
 * landed); back, like a previous track, the start of the current one once more than `grace` seconds
 * into it (floored at `LANDING`), otherwise the one before.
 */
export function stepIndex(
    starts: readonly number[],
    time: number,
    direction: 1 | -1,
    grace: number = 1,
): number | null {
    if (direction > 0) {
        const index = starts.findIndex((start) => start > time + LANDING);

        return index < 0 ? null : index;
    }

    const before = time - Math.max(LANDING, grace);

    for (let index = starts.length - 1; index >= 0; index--) {
        if (starts[index] < before) {
            return index;
        }
    }

    return null;
}
