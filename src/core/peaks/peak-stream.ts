/**
 * Peaks built from a sound that arrives in pieces (a decoder's output, a server's PCM pipe), holding
 * a few values per peak instead of the sound: each slot keeps the loudest point of a block of
 * samples, and when the slots run out, neighbours merge and the block doubles. The peaks are those
 * blocks fitted to the count asked, the same however the sound was cut.
 */

import { limitOf } from '../shared/limits';
import { normalize, PEAKS_COUNT, resample } from './peaks';

/** Slots kept for each peak asked: the blocks are never wider than a quarter of a peak. */
const SLOTS_PER_PEAK = 4;

/** Peaks taking a sound piece by piece. */
export type PeakStream = {
    /** How many samples came so far. */
    readonly length: number;
    /** Takes the next samples of one channel; values that are not finite are skipped. */
    push(samples: ArrayLike<number>): void;
    /**
     * The peaks so far, the loudest scaled to 1. Given the whole sound's length in samples, the part
     * still to come is drawn as silence, so a wave can show a sound while it is read.
     */
    peaks(totalSamples?: number): number[];
};

/** Each pair of neighbours as one value, the louder. */
function pairs(values: ArrayLike<number>, length: number): number[] {
    return Array.from({ length: Math.ceil(length / 2) }, (_, index) =>
        Math.max(values[index * 2], values[index * 2 + 1] ?? 0),
    );
}

/**
 * Starts peaks for a sound of any length: `count` of them (20 000 if not a number), from 1 up to
 * 1 000 000; past either end, a `RangeError`.
 */
export function createPeakStream(count: number): PeakStream {
    const total = limitOf('count', count, PEAKS_COUNT);
    const room = total * SLOTS_PER_PEAK;
    const slots = new Float32Array(room);
    let filled = 0;
    let stride = 1;
    let length = 0;

    const fold = (): void => {
        const merged = pairs(slots, filled);
        slots.fill(0);
        slots.set(merged);
        filled = merged.length;
        stride *= 2;
    };

    return {
        get length(): number {
            return length;
        },
        push(samples: ArrayLike<number>): void {
            for (let i = 0; i < samples.length; i++) {
                let index = Math.floor(length / stride);

                if (index >= room) {
                    fold();
                    index = Math.floor(length / stride);
                }

                const level = Math.abs(samples[i]);

                if (level > slots[index] && level < Infinity) {
                    slots[index] = level;
                }

                filled = index + 1;
                length++;
            }
        },
        peaks(totalSamples?: number): number[] {
            if (length === 0) {
                return [];
            }

            const promised = Number(totalSamples);
            const whole =
                Number.isFinite(promised) && promised > length
                    ? promised
                    : length;
            let values: number[] = Array.from(slots.subarray(0, filled));
            let step = stride;

            while (Math.ceil(whole / step) > room) {
                values = pairs(values, values.length);
                step *= 2;
            }

            const span = Math.ceil(whole / step);
            const drawn = Array.from(
                { length: span },
                (_, index) => values[index] ?? 0,
            );

            return normalize(resample(drawn, total));
        },
    };
}
