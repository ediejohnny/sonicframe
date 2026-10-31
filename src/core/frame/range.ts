/**
 * Playing a stretch of the sound (a region's "play" or "loop"). Pure, so the decision is tested in
 * Node: given the media's time, say whether it is still inside the range, should wrap to the start
 * (a loop), or should stop (the end was reached, or the listener seeked out of it).
 */

export type RangeState = {
    /** Start of the range, in seconds. */
    start: number;
    /** End of the range, in seconds. */
    end: number;
    /** Whether reaching the end wraps to the start instead of stopping. */
    loop: boolean;
};

export type RangeStep = 'inside' | 'wrap' | 'stop';

/** How far the listener can be before the start before the range is treated as abandoned. */
const SLACK = 0.05;

/** What playing a range should do at `time` (seconds). */
export function rangeStep(time: number, range: RangeState): RangeStep {
    if (time < range.start - SLACK) {
        return 'stop';
    }

    if (time >= range.end) {
        return range.loop ? 'wrap' : 'stop';
    }

    return 'inside';
}
