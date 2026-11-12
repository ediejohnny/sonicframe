/**
 * The order a list of tracks plays in, without the page: in the order written or shuffled (with the
 * track playing first), the track after one that ends, and the next and previous a person asks for,
 * under the three ways of repeating. An order is the list of track indexes in playing order.
 */

/** Never again (`'none'`), the whole list over and over (`'all'`), or the same track (`'one'`). */
export type Repeat = 'none' | 'all' | 'one';

export const REPEATS: readonly Repeat[] = Object.freeze([
    'none',
    'all',
    'one',
] as const);

/** The tracks in the order written: `0, 1, …, count - 1`. */
export function writtenOrder(count: number): number[] {
    return Array.from(
        { length: Math.max(0, Math.floor(count)) },
        (_, at) => at,
    );
}

/**
 * The tracks shuffled, with `first` (the track playing) kept first so nothing jumps, by the
 * Fisher-Yates shuffle with `random` (numbers from 0 up to 1, `Math.random` by default). A `first`
 * that is no track gives a plain shuffle.
 */
export function shuffledOrder(
    count: number,
    first: number,
    random: () => number = Math.random,
): number[] {
    const rest = writtenOrder(count).filter((at) => at !== first);

    for (let at = rest.length - 1; at > 0; at--) {
        // A random number outside 0 to 1 (a broken source) still picks a place in the list.
        const pick = Math.min(at, Math.max(0, Math.floor(random() * (at + 1))));
        [rest[at], rest[pick]] = [rest[pick], rest[at]];
    }

    return first >= 0 && first < count ? [first, ...rest] : rest;
}

/** Where `current` is in `order`, or -1. */
function placeOf(order: readonly number[], current: number): number {
    return order.indexOf(current);
}

/**
 * The track a person's "next" goes to: the one after `current` in `order` (the first one when
 * `current` is in no place of it), or the first one again with `repeat: 'all'`; null at the end
 * otherwise. `'one'` repeats only a track that ends by itself.
 */
export function nextTrack(
    order: readonly number[],
    current: number,
    repeat: Repeat,
): number | null {
    const at = placeOf(order, current);

    if (order.length === 0) {
        return null;
    }

    if (at < order.length - 1) {
        return order[at + 1];
    }

    return repeat === 'all' ? order[0] : null;
}

/**
 * The track a person's "previous" goes to: the one before `current` in `order`, or the last one
 * with `repeat: 'all'`; null at the start otherwise.
 */
export function previousTrack(
    order: readonly number[],
    current: number,
    repeat: Repeat,
): number | null {
    const at = placeOf(order, current);

    if (order.length === 0 || at < 0) {
        return null;
    }

    if (at > 0) {
        return order[at - 1];
    }

    return repeat === 'all' ? order[order.length - 1] : null;
}

/**
 * The track that plays when `current` ends by itself: the same one with `repeat: 'one'`, otherwise
 * as `nextTrack`; null when the list is over.
 */
export function trackAfterEnd(
    order: readonly number[],
    current: number,
    repeat: Repeat,
): number | null {
    if (repeat === 'one' && placeOf(order, current) >= 0) {
        return current;
    }

    return nextTrack(order, current, repeat);
}

/**
 * Whether a person's "previous" starts the track playing over instead of going back: when it has
 * played more than `restartAfter` seconds (0 never restarts), or when there is no track before.
 */
export function previousRestarts(
    time: number,
    restartAfter: number,
    hasPrevious: boolean,
): boolean {
    return !hasPrevious || (restartAfter > 0 && time > restartAfter);
}
