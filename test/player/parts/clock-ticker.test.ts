/**
 * A precise clock moves while the sound plays as often as its digits change, and no more: tenths ten
 * times a second (twice that at double speed), hundredths once an animation frame, whole seconds not
 * at all (the media's own events keep them). Paused, waiting or stopped, nothing runs.
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import type {
    ClockFormat,
    ClockPrecision,
} from '../../../src/core/shared/clock';
import { tickClock } from '../../../src/player/parts/clock-ticker';
import { fakeMedia } from '../../support/helpers';

type Media = ReturnType<typeof fakeMedia>;

function clock(precision: ClockPrecision): ClockFormat {
    return { precision, fps: 30, hours: 'auto', decimal: '.' };
}

/** A media that plays from 0 and moves with the hand-moved clock, at its own `playbackRate`. */
function playing(): Media {
    const media = fakeMedia({ duration: 600, paused: false });
    media.currentTime = 0;

    return media;
}

/** Moves the page's time on by `milliseconds`, one at a time, the sound with it. */
function play(media: Media, milliseconds: number): void {
    for (let step = 0; step < milliseconds; step += 1) {
        media.currentTime += media.playbackRate / 1000;
        vi.advanceTimersByTime(1);
    }
}

let stops: (() => void)[] = [];

function start(media: Media, precision: ClockPrecision): { shows: number } {
    const counter = { shows: 0 };
    stops.push(
        tickClock(
            media,
            clock(precision),
            () => media.currentTime,
            () => {
                counter.shows += 1;
            },
        ),
    );

    return counter;
}

beforeEach(() => {
    vi.useFakeTimers({
        toFake: [
            'setTimeout',
            'clearTimeout',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'performance',
        ],
    });
});

afterEach(() => {
    for (const stop of stops) {
        stop();
    }

    stops = [];
    // The page's one frame loop keeps the frame it asked for until it runs; let it run.
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
});

describe('how often a precise clock moves', () => {
    it('moves tenths ten times in a second of playing, not once a frame', () => {
        const media = playing();
        const counter = start(media, 'tenths');

        play(media, 1000);

        expect(counter.shows).toBe(10);
    });

    it('moves tenths twenty times a second at double speed, from the moment the speed changes', () => {
        const media = playing();
        const counter = start(media, 'tenths');
        media.playbackRate = 2;
        media.fire('ratechange');

        play(media, 1000);

        expect(counter.shows).toBe(20);
    });

    it('follows a speed change at once, not at the change it was waiting for', () => {
        const media = playing();
        const counter = start(media, 'tenths');
        media.playbackRate = 4;
        media.fire('ratechange');

        play(media, 30);

        // At four times the speed the first tenth turns 12.5 ms in; a clock still waiting for it
        // at the old speed would show it only 51 ms in.
        expect(counter.shows).toBeGreaterThanOrEqual(1);
    });

    it('moves hundredths once an animation frame', () => {
        const media = playing();
        const counter = start(media, 'hundredths');

        play(media, 1000);

        // The hand-moved clock runs an animation frame every 16 ms.
        expect(counter.shows).toBeGreaterThanOrEqual(60);
        expect(counter.shows).toBeLessThanOrEqual(63);
    });

    it('leaves whole seconds to the media’s own events', () => {
        const media = playing();
        const counter = start(media, 'seconds');

        play(media, 3000);

        expect(counter.shows).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('when a precise clock rests', () => {
    it('stops at a pause, and starts again when the sound plays', () => {
        const media = playing();
        const counter = start(media, 'tenths');
        media.fire('pause');
        play(media, 1000);

        expect(counter.shows).toBe(0);

        media.fire('playing');
        play(media, 1000);

        expect(counter.shows).toBe(10);
    });

    it('stops while the sound waits for data, at its end, and when it is emptied', () => {
        for (const rest of ['waiting', 'ended', 'emptied']) {
            const media = playing();
            const counter = start(media, 'hundredths');
            media.fire(rest);
            play(media, 500);

            expect(counter.shows, rest).toBe(0);
        }
    });

    it('does not start for a sound that is not playing', () => {
        const media = fakeMedia({ duration: 600, paused: true });
        const counter = start(media, 'tenths');

        play(media, 1000);

        expect(counter.shows).toBe(0);
    });

    it('leaves no timer and no frame behind once stopped', () => {
        const media = playing();
        const counter = start(media, 'tenths');
        play(media, 250);
        const before = counter.shows;

        stops.pop()?.();
        media.fire('playing');
        play(media, 1000);

        expect(counter.shows).toBe(before);
        expect(vi.getTimerCount()).toBe(0);
    });
});
