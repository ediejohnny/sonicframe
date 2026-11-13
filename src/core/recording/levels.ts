/**
 * The levels heard while recording, for a wave drawn live: the loudest level of each slice of time
 * (20 a second by default), silence in a slice nothing was heard in, and nothing past the longest
 * recording. The last seconds of them feed a wave that scrolls; all of them, a wave that fits.
 */

import { finiteOr, within } from '../shared/checked';
import { clamp01 } from '../shared/math';

/** The longest recording a track keeps levels for unless given, in seconds (one hour). */
const MAX_SECONDS = 3600;

/** The longest it may be given, in seconds: the most a recording may run (6 hours). */
const MOST_SECONDS = 21_600;

/** The level of a block of samples (from -1 to 1): its loudest one, either way from silence, at most 1. */
export function levelOf(samples: ArrayLike<number>): number {
    let loudest = 0;

    for (let index = 0; index < samples.length; index++) {
        const value = Math.abs(samples[index]);

        if (value > loudest) {
            loudest = value;
        }
    }

    return Math.min(1, loudest);
}

export class LevelTrack {
    /** Slices a second: from 1 to 100, 20 by default. */
    readonly rate: number;
    private readonly limit: number;
    private readonly values: number[] = [];

    constructor(rate: number = 20, maxSeconds: number = MAX_SECONDS) {
        this.rate = within(rate, 20, 1, 100);
        this.limit = Math.ceil(
            within(maxSeconds, MAX_SECONDS, 0, MOST_SECONDS) * this.rate,
        );
    }

    /** Every level so far, one per slice. */
    get levels(): readonly number[] {
        return this.values;
    }

    /** The seconds the levels cover. */
    get seconds(): number {
        return this.values.length / this.rate;
    }

    /** Takes a level heard `time` seconds into the recording; a slice keeps its loudest. */
    add(time: number, level: number): void {
        if (!Number.isFinite(time) || time < 0) {
            return;
        }

        const slice = Math.floor(time * this.rate);

        if (slice >= this.limit) {
            return;
        }

        while (this.values.length <= slice) {
            this.values.push(0);
        }

        this.values[slice] = Math.max(this.values[slice], clamp01(level));
    }

    /** The last `seconds` of levels, with silence before the start while the recording is shorter. */
    last(seconds: number): number[] {
        const count = Math.max(0, Math.round(finiteOr(seconds, 0) * this.rate));
        const kept = this.values.slice(Math.max(0, this.values.length - count));

        return [
            ...Array.from({ length: count - kept.length }, () => 0),
            ...kept,
        ];
    }

    /** Forgets every level. */
    clear(): void {
        this.values.length = 0;
    }
}
