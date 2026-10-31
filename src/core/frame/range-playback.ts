/**
 * A range being played on a media element (a region's "play" or "loop"): it wraps to its start or
 * stops at its end, and a seek out of it abandons it. Both the media's own events and the animation
 * tick drive it, since the tick only runs on screen.
 */

import type { MediaLike } from '../../types';
import { outsideRange, rangeStep, type RangeState } from './range';

/** Starts playback; a refused start (an autoplay rule, say) leaves the media paused and is no error here. */
export function startPlaying(media: MediaLike): void {
    const started = media.play?.();

    if (started !== undefined && typeof started.then === 'function') {
        started.then(undefined, () => undefined);
    }
}

export class RangePlayback {
    private range: RangeState | null = null;

    /** `over` is called when the range ends: its end reached, or the listener seeked before it. */
    constructor(private readonly over: () => void) {}

    get active(): boolean {
        return this.range !== null;
    }

    /** Opens `start`..`end` seconds of a sound `duration` long, both kept inside it; returns the start. */
    open(start: number, end: number, loop: boolean, duration: number): number {
        const from = Math.max(0, Math.min(start, duration));
        const to = Math.max(from, Math.min(end, duration));
        this.range = { start: from, end: to, loop };

        return from;
    }

    /** Forgets the range (playback itself carries on). */
    close(): void {
        this.range = null;
    }

    /** Keeps playing `media` inside the range: wraps to the start of a loop, or stops at the end. */
    follow(media: MediaLike): void {
        const range = this.range;

        if (range === null) {
            return;
        }

        const step = rangeStep(media.currentTime, range);

        if (step === 'wrap') {
            media.currentTime = range.start;
        } else if (step === 'stop') {
            const reachedEnd = media.currentTime >= range.end;
            this.range = null;

            if (reachedEnd) {
                media.pause?.();
            }

            this.over();
        }
    }

    /**
     * The media ended while the range was open: a looping range starts again, any other one is over.
     * The animation tick never sees this moment, since an ended media no longer plays.
     */
    mediaEnded(media: MediaLike): void {
        const range = this.range;

        if (range === null) {
            return;
        }

        if (range.loop) {
            media.currentTime = range.start;
            startPlaying(media);
        } else {
            this.range = null;
            this.over();
        }
    }

    /** A seek to `time` seconds out of the range abandons it (a seek to its start does not). */
    seeked(time: number): void {
        if (this.range !== null && outsideRange(time, this.range)) {
            this.range = null;
        }
    }
}
