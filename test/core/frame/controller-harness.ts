/**
 * A controller wired to a media element that only keeps state, recording everything the
 * controller asks of its page; tests fire the media's events by hand, as a browser would.
 */

import {
    Controller,
    type AriaState,
    type ControllerOptions,
} from '../../../src/core/frame/controller';
import type { MediaEventType } from '../../../src/core/frame/media-events';
import type { MediaLike } from '../../../src/types';

/** A media element that only keeps state; tests fire its events by hand, as a browser would. */
export class FakeMedia implements MediaLike {
    duration: number = NaN;
    paused = true;
    ended = false;
    readyState = 0;
    readonly seeks: number[] = [];
    private time = 0;

    get currentTime(): number {
        return this.time;
    }

    set currentTime(value: number) {
        this.seeks.push(value);
        this.time = value;
        this.ended = false;
    }

    /** Moves time forward the way playback does (not a seek). */
    advance(to: number): void {
        this.time = to;
    }

    /** How many times playback was started. */
    plays = 0;

    play(): void {
        this.plays++;
        this.paused = false;
    }

    pause(): void {
        this.paused = true;
    }
}

/** The controller, its media, a way to fire media events, and what the controller asked of its page. */
export type Harness = {
    controller: Controller;
    media: FakeMedia;
    fire: (...types: MediaEventType[]) => void;
    loops: boolean[];
    aria: AriaState[];
    events: [string, unknown[]][];
    /** The `seek` events' details, in order. */
    seeks: () => unknown[];
    invalidations: () => number;
};

export function setup(options: Partial<ControllerOptions> = {}): Harness {
    const loops: boolean[] = [];
    const aria: AriaState[] = [];
    const events: [string, unknown[]][] = [];
    let invalidations = 0;

    const controller = new Controller(
        {
            interact: true,
            stepSeconds: 5,
            largeStepRatio: 0.1,
            rewindOnEnd: false,
            ...options,
        },
        {
            invalidate: () => invalidations++,
            loop: (on) => loops.push(on),
            aria: (state) => aria.push(state),
            emit: (event, ...args) => events.push([event, args]),
        },
    );
    const media = new FakeMedia();
    const fire = (...types: MediaEventType[]): void => {
        for (const type of types) {
            controller.mediaEvent(type);
        }
    };
    const seeks = () =>
        events.filter(([name]) => name === 'seek').map(([, args]) => args[0]);

    return {
        controller,
        media,
        fire,
        loops,
        aria,
        events,
        seeks,
        invalidations: () => invalidations,
    };
}

/** Media with its metadata loaded: `seconds` long. */
export function loaded(media: FakeMedia, seconds: number): void {
    media.duration = seconds;
    media.readyState = 4;
}
