/**
 * The order a list plays in: written or shuffled with the track playing first, the next and previous
 * a person asks for and the track after one that ends, under each way of repeating, and when
 * "previous" starts the track over.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    nextTrack,
    previousRestarts,
    previousTrack,
    shuffledOrder,
    trackAfterEnd,
    writtenOrder,
} from '../../../src/core/playlist/order';

/** A source of "random" numbers that gives `values` in turn, over and over. */
function sequence(...values: number[]): () => number {
    let at = 0;

    return () => values[at++ % values.length];
}

describe('writtenOrder', () => {
    it('is every track in the order written, and none for an empty or broken count', () => {
        expect(writtenOrder(4)).toEqual([0, 1, 2, 3]);
        expect(writtenOrder(0)).toEqual([]);
        expect(writtenOrder(-2)).toEqual([]);
        expect(writtenOrder(2.7)).toEqual([0, 1]);
    });
});

describe('shuffledOrder', () => {
    it('keeps the track playing first and shuffles the others by the random numbers', () => {
        // Fisher-Yates over [0, 1, 3, 4] (track 2 is playing): 0.99 swaps the last with itself,
        // 0 swaps place 2 with place 0, then 0.5 swaps place 1 with place 1.
        expect(shuffledOrder(5, 2, sequence(0.99, 0, 0.5))).toEqual([
            2, 3, 1, 0, 4,
        ]);
    });

    it('is a plain shuffle when the track playing is no track of the list', () => {
        const ascending = (a: number, b: number): number => a - b;

        expect(shuffledOrder(3, -1, sequence(0)).sort(ascending)).toEqual([
            0, 1, 2,
        ]);
        expect(shuffledOrder(3, 7, sequence(0)).sort(ascending)).toEqual([
            0, 1, 2,
        ]);
    });

    it('is always every track once, the one playing first, whatever the random numbers', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 40 }),
                fc.nat(),
                fc.array(fc.double({ min: -5, max: 5, noNaN: true }), {
                    minLength: 1,
                }),
                (count, pick, randoms) => {
                    const first = pick % count;
                    const order = shuffledOrder(
                        count,
                        first,
                        sequence(...randoms),
                    );

                    expect(order[0]).toBe(first);
                    expect([...order].sort((a, b) => a - b)).toEqual(
                        writtenOrder(count),
                    );
                },
            ),
        );
    });
});

describe('next and previous', () => {
    const order = [2, 0, 3, 1];

    it('go one place along the order', () => {
        expect(nextTrack(order, 0, 'none')).toBe(3);
        expect(previousTrack(order, 0, 'none')).toBe(2);
    });

    it('stop at the ends, unless the whole list repeats', () => {
        expect(nextTrack(order, 1, 'none')).toBeNull();
        expect(nextTrack(order, 1, 'one')).toBeNull();
        expect(nextTrack(order, 1, 'all')).toBe(2);
        expect(previousTrack(order, 2, 'none')).toBeNull();
        expect(previousTrack(order, 2, 'one')).toBeNull();
        expect(previousTrack(order, 2, 'all')).toBe(1);
    });

    it('start the list from a track that is in no place of it, and find nothing in an empty one', () => {
        expect(nextTrack(order, 9, 'none')).toBe(2);
        expect(previousTrack(order, 9, 'all')).toBeNull();
        expect(nextTrack([], 0, 'all')).toBeNull();
        expect(previousTrack([], 0, 'all')).toBeNull();
    });

    it('with the whole list repeating, visit every track once before coming back', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 30 }),
                fc.nat(),
                fc.nat(),
                (count, seed, start) => {
                    const list = shuffledOrder(
                        count,
                        -1,
                        sequence((seed % 97) / 97),
                    );
                    const first = list[start % count];
                    const seen = new Set<number>();
                    let at: number | null = first;

                    for (let step = 0; step < count; step++) {
                        seen.add(at as number);
                        at = nextTrack(list, at as number, 'all');
                    }

                    expect(seen.size).toBe(count);
                    expect(at).toBe(first);
                },
            ),
        );
    });
});

describe('trackAfterEnd', () => {
    const order = [1, 0, 2];

    it('plays the same track again when one repeats, and the next one otherwise', () => {
        expect(trackAfterEnd(order, 0, 'one')).toBe(0);
        expect(trackAfterEnd(order, 0, 'none')).toBe(2);
        expect(trackAfterEnd(order, 2, 'none')).toBeNull();
        expect(trackAfterEnd(order, 2, 'all')).toBe(1);
    });

    it('never repeats a track that is in no place of the order', () => {
        expect(trackAfterEnd(order, 9, 'one')).toBe(1);
    });
});

describe('previousRestarts', () => {
    it('starts the track over once it has played past the seconds, or when there is none before', () => {
        expect(previousRestarts(4, 3, true)).toBe(true);
        expect(previousRestarts(3, 3, true)).toBe(false);
        expect(previousRestarts(1, 3, true)).toBe(false);
        expect(previousRestarts(1, 3, false)).toBe(true);
    });

    it('never starts over with 0 seconds, unless there is no track before', () => {
        expect(previousRestarts(500, 0, true)).toBe(false);
        expect(previousRestarts(500, 0, false)).toBe(true);
    });
});
