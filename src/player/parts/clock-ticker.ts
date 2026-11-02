/**
 * Moves a precise clock while the sound plays, as often as its digits change and no more. A step
 * that lasts `FRAME_PACED` or more of the page's time (tenths) waits on a timer set for the next
 * change; a shorter one (hundredths, milliseconds, frames) is read on every animation frame. Whole
 * seconds never run here: the media's own events keep them. Paused, waiting or ended, nothing runs.
 */

import {
    clockStep,
    nextClockChange,
    type ClockFormat,
} from '../../core/shared/clock';
import {
    setLooping,
    unschedule,
    type FrameTask,
} from '../../dom/frame/scheduler';

/** In seconds of the page's time: a step shorter than this is read on every animation frame. */
const FRAME_PACED = 0.05;

/** In milliseconds: a timer fires this late, so the time it reads has already changed. */
const PAST_CHANGE = 1;

const RUN = ['play', 'playing'] as const;
const REST = ['pause', 'waiting', 'ended', 'emptied'] as const;

/**
 * Calls `show` whenever `clock` would read the time (`time()`) differently while `media` plays;
 * returns what stops it.
 */
export function tickClock(
    media: HTMLMediaElement,
    clock: ClockFormat,
    time: () => number | null,
    show: () => void,
): () => void {
    if (clock.precision === 'seconds') {
        return () => {};
    }

    const task: FrameTask = { render: show };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;

    const halt = (): void => {
        clearTimeout(timer);
        timer = undefined;
        unschedule(task);
    };

    const wait = (): void => {
        const now = time();
        const next =
            now === null
                ? null
                : nextClockChange(now, clock, media.playbackRate);

        if (next !== null) {
            timer = setTimeout(
                () => {
                    show();
                    wait();
                },
                next * 1000 + PAST_CHANGE,
            );
        }
    };

    const run = (): void => {
        halt();
        running = true;
        const rate = media.playbackRate;

        if (!Number.isFinite(rate) || rate <= 0) {
            return;
        }

        if (clockStep(clock) / rate < FRAME_PACED) {
            setLooping(task, true);
        } else {
            wait();
        }
    };

    const rest = (): void => {
        running = false;
        halt();
    };

    const respeed = (): void => {
        if (running) {
            run();
        }
    };

    for (const type of RUN) {
        media.addEventListener(type, run);
    }

    for (const type of REST) {
        media.addEventListener(type, rest);
    }

    media.addEventListener('ratechange', respeed);

    if (!media.paused && !media.ended) {
        run();
    }

    return () => {
        rest();

        for (const type of RUN) {
            media.removeEventListener(type, run);
        }

        for (const type of REST) {
            media.removeEventListener(type, rest);
        }

        media.removeEventListener('ratechange', respeed);
    };
}
