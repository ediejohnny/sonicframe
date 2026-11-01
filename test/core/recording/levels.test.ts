/**
 * The levels heard while recording: the loudest of each slice of time, the last seconds of them for
 * a wave that scrolls, and the level of a block of samples.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { LevelTrack, levelOf } from '../../../src/core/recording/levels';

/** What a track of `rate` slices a second keeps, worked out one slice at a time. */
function bruteLevels(
    heard: readonly (readonly [number, number])[],
    rate: number,
): number[] {
    const last = Math.max(
        -1,
        ...heard.map(([time]) => Math.floor(time * rate)),
    );
    const slices: number[] = [];

    for (let slice = 0; slice <= last; slice++) {
        const inSlice = heard
            .filter(([time]) => Math.floor(time * rate) === slice)
            .map(([, level]) => Math.min(1, Math.max(0, level)));
        slices.push(inSlice.length === 0 ? 0 : Math.max(...inSlice));
    }

    return slices;
}

describe('LevelTrack', () => {
    it('keeps the loudest level of each slice, and silence in a slice nothing was heard in', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.tuple(
                        fc.double({ min: 0, max: 30, noNaN: true }),
                        fc.double({ min: -0.5, max: 1.5, noNaN: true }),
                    ),
                    { maxLength: 60 },
                ),
                fc.constantFrom(1, 10, 20, 60),
                (heard, rate) => {
                    const track = new LevelTrack(rate);

                    for (const [time, level] of heard) {
                        track.add(time, level);
                    }

                    expect([...track.levels]).toEqual(bruteLevels(heard, rate));
                },
            ),
        );
    });

    it('slices 20 times a second by default', () => {
        const track = new LevelTrack();
        track.add(0.01, 0.2);
        track.add(0.04, 0.6);
        track.add(0.06, 0.3);
        track.add(0.16, 0.9);

        expect([...track.levels]).toEqual([0.6, 0.3, 0, 0.9]);
        expect(track.seconds).toBe(0.2);
    });

    it('ignores a time that is not a moment of the recording', () => {
        const track = new LevelTrack(10);
        track.add(Number.NaN, 1);
        track.add(-1, 1);
        track.add(Number.POSITIVE_INFINITY, 1);
        track.add(0.05, Number.NaN);

        // Every key of the list, so a stray entry outside its slices shows too.
        expect(Object.keys(track.levels)).toEqual(['0']);
        expect([...track.levels]).toEqual([0]);
    });

    it('keeps no level past its longest recording', () => {
        const track = new LevelTrack(10, 2);
        track.add(1.95, 0.5);
        track.add(2, 0.8);
        track.add(500, 0.8);

        expect(track.levels.length).toBe(20);
        expect(track.levels.at(-1)).toBe(0.5);
    });

    it('gives the last seconds, with silence before the start while it is shorter', () => {
        const track = new LevelTrack(10);
        track.add(0, 0.1);
        track.add(0.1, 0.2);
        track.add(0.2, 0.3);

        expect(track.last(0.5)).toEqual([0, 0, 0.1, 0.2, 0.3]);

        for (let slice = 3; slice < 8; slice++) {
            track.add(slice / 10, slice / 10);
        }

        expect(track.last(0.5)).toEqual([0.3, 0.4, 0.5, 0.6, 0.7]);
    });

    it('starts again empty when cleared', () => {
        const track = new LevelTrack(10);
        track.add(0.3, 0.5);
        track.clear();

        expect(track.levels).toEqual([]);
        expect(track.last(0.2)).toEqual([0, 0]);
    });

    it('takes a rate from 1 to 100 slices a second, 20 when it is not a number', () => {
        expect(new LevelTrack(0).rate).toBe(1);
        expect(new LevelTrack(1000).rate).toBe(100);
        expect(new LevelTrack(Number.NaN).rate).toBe(20);
    });
});

describe('levelOf', () => {
    it('is the loudest sample, either way from silence, at most 1', () => {
        expect(levelOf(new Float32Array([0.1, -0.7, 0.4]))).toBeCloseTo(0.7);
        expect(levelOf(new Float32Array([0.2, 1.8]))).toBe(1);
        expect(levelOf(new Float32Array(0))).toBe(0);
    });
});
