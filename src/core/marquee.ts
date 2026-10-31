/**
 * A text too long for its room walks across it: it waits, walks at a steady speed, may wait again,
 * and starts the round over.
 */

/**
 * One round of the walk: its length in milliseconds; where the walk starts and ends in it (0 to
 * 1); and the part of the round the walk takes to cross a fade (`ramp`), never more than half the
 * walk.
 */
export type MarqueeTiming = {
    duration: number;
    start: number;
    end: number;
    ramp: number;
};

/**
 * The round for a walk of `distance` CSS pixels at `speed` pixels a second, waiting `before`
 * milliseconds before it and `after` after it, across a fade `fade` pixels wide; `null` when there
 * is nothing to walk.
 */
export function marqueeTiming(
    distance: number,
    speed: number,
    before: number,
    after: number,
    fade = 0,
): MarqueeTiming | null {
    if (!(distance > 0) || !(speed > 0) || !Number.isFinite(distance)) {
        return null;
    }

    const wait = (value: number): number =>
        Number.isFinite(value) && value > 0 ? value : 0;
    const first = wait(before);
    const walk = (distance / speed) * 1000;
    const duration = first + walk + wait(after);
    const cross = Math.min((wait(fade) / speed) * 1000, walk / 2);

    return {
        duration,
        start: first / duration,
        end: (first + walk) / duration,
        ramp: cross / duration,
    };
}
