import { describe, expect, it } from 'vite-plus/test';
import {
    Controller,
    type AriaState,
    type ControllerOptions,
    type MediaEventType,
} from '../src/core/controller';
import type { MediaLike } from '../src/types';

/** A media element that only keeps state; tests fire its events by hand, as a browser would. */
class FakeMedia implements MediaLike {
    duration = NaN;
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

function setup(options: Partial<ControllerOptions> = {}) {
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
function loaded(media: FakeMedia, seconds: number): void {
    media.duration = seconds;
    media.readyState = 4;
}

describe('seeking', () => {
    it('waits for the metadata when asked to seek too early, showing the target meanwhile', () => {
        const { controller, media, fire } = setup();
        controller.setDuration(40);
        controller.bind(media);

        controller.seekTo(0.5);

        expect(media.seeks).toEqual([]);
        expect(controller.progress).toBe(0.5);

        fire('play', 'timeupdate');
        expect(controller.progress).toBe(0.5);

        loaded(media, 40);
        fire('loadedmetadata');

        expect(media.seeks).toEqual([20]);
        expect(controller.progress).toBe(0.5);
    });

    it('lands an arrow-key step on the very second asked for, and says so', () => {
        // In floating point, 5 / 77 * 77 is 4.999…: the step must not lose its second on the way.
        const { controller, media, seeks } = setup();
        loaded(media, 77);
        controller.bind(media);

        controller.key('ArrowRight');

        expect(media.seeks).toEqual([5]);
        expect(seeks()).toEqual([
            { ratio: 5 / 77, time: 5, source: 'keyboard' },
        ]);
    });

    it('tells where a seek waiting for the metadata will land, then the media’s own time', () => {
        const { controller, media, fire } = setup();
        controller.setDuration(77);
        controller.bind(media);

        controller.key('ArrowRight');

        expect(media.seeks).toEqual([]);
        expect(controller.time).toBe(5);

        loaded(media, 77);
        fire('loadedmetadata');
        media.advance(6.25);

        expect(media.seeks).toEqual([5]);
        expect(controller.time).toBe(6.25);
    });

    it('tells the position set without media, and no time while the duration is unknown', () => {
        const { controller } = setup();

        expect(controller.time).toBeNull();

        controller.setDuration(20);
        controller.setProgress(0.5);

        expect(controller.time).toBe(10);
    });

    it('uses the hint for media without a real duration (browser recordings)', () => {
        const { controller, media } = setup();
        controller.bind(media);
        controller.setDuration(10);
        media.duration = Infinity;
        media.readyState = 4;

        controller.seekTo(0.3);

        expect(media.seeks).toEqual([3]);
    });

    it('seeks once per drag, when the pointer is let go', () => {
        const { controller, media, seeks } = setup();
        loaded(media, 100);
        controller.bind(media);

        expect(controller.pointerDown(0.2)).toBe(true);
        controller.pointerMove(0.4);
        controller.pointerMove(0.6);

        expect(controller.progress).toBe(0.6);
        expect(media.seeks).toEqual([]);

        controller.pointerUp(0.7);

        expect(media.seeks).toEqual([70]);
        expect(seeks()).toEqual([{ ratio: 0.7, time: 70, source: 'pointer' }]);
    });

    it('goes back to where it was when the browser cancels a drag', () => {
        const { controller, media, seeks } = setup();
        loaded(media, 100);
        media.advance(25);
        controller.bind(media);

        controller.pointerDown(0.9);
        controller.pointerCancel();

        expect(controller.progress).toBe(0.25);
        expect(media.seeks).toEqual([]);
        expect(seeks()).toEqual([]);
    });

    it('does not follow the media under a drag', () => {
        const { controller, media, fire } = setup();
        loaded(media, 100);
        controller.bind(media);

        controller.pointerDown(0.8);
        media.advance(10);
        fire('timeupdate');
        controller.tick();

        expect(controller.progress).toBe(0.8);
    });
});

describe('animation loop', () => {
    it('loops only while the media plays and the frame is on screen', () => {
        const { controller, media, fire, loops } = setup();
        loaded(media, 10);
        controller.bind(media);

        media.paused = false;
        fire('play');
        expect(loops).toEqual([]);

        controller.setVisible(true);
        expect(loops).toEqual([true]);

        fire('waiting');
        fire('playing');
        controller.setVisible(false);
        controller.setVisible(true);
        media.paused = true;
        fire('pause');

        expect(loops).toEqual([true, false, true, false, true, false]);
    });

    it('stops looping at the end', () => {
        const { controller, media, fire, loops } = setup();
        loaded(media, 10);
        controller.bind(media);
        controller.setVisible(true);

        media.paused = false;
        fire('playing');
        media.ended = true;
        media.paused = true;
        fire('ended');

        expect(loops).toEqual([true, false]);
    });
});

describe('the end of the sound', () => {
    function playToEnd(rewindOnEnd: boolean) {
        const context = setup({ rewindOnEnd });
        loaded(context.media, 10);
        context.controller.bind(context.media);
        context.media.advance(10);
        context.media.ended = true;
        context.fire('ended');

        return context;
    }

    it('shows the start again with rewindOnEnd', () => {
        const { controller } = playToEnd(true);

        expect(controller.progress).toBe(0);
    });

    it('stays at the end without it', () => {
        const { controller } = playToEnd(false);

        expect(controller.progress).toBe(1);
    });
});

describe('keyboard', () => {
    it('steps by seconds and jumps with Home and End', () => {
        const { controller, media } = setup();
        loaded(media, 50);
        media.advance(20);
        controller.bind(media);

        expect(controller.key('ArrowRight')).toBe(true);
        expect(controller.key('PageDown')).toBe(true);
        expect(controller.key('End')).toBe(true);

        expect(media.seeks).toEqual([25, 20, 50]);
    });

    it('leaves other keys and shortcuts to the page', () => {
        const { controller, media } = setup();
        loaded(media, 50);
        controller.bind(media);

        expect(controller.key('Enter')).toBe(false);
        expect(controller.key('ArrowRight', { ctrlKey: true })).toBe(false);
        expect(media.seeks).toEqual([]);
    });

    it('does nothing at all when the frame is only a picture', () => {
        const { controller, media, events } = setup({ interact: false });
        loaded(media, 50);
        controller.bind(media);

        expect(controller.key('ArrowRight')).toBe(false);
        expect(controller.pointerDown(0.5)).toBe(false);
        controller.hoverAt(0.5);

        expect(media.seeks).toEqual([]);
        expect(
            events.filter(
                ([name]) => name !== 'timeupdate' && name !== 'durationchange',
            ),
        ).toEqual([]);
    });
});

describe('duration', () => {
    it('says when the duration becomes known and when it changes, once each', () => {
        const { controller, media, fire, events } = setup();
        controller.bind(media);

        media.duration = 30;
        media.readyState = 1;
        fire('loadedmetadata', 'durationchange');
        fire('timeupdate');
        media.duration = 31.5;
        fire('durationchange');

        expect(events.filter(([name]) => name === 'durationchange')).toEqual([
            ['durationchange', [30]],
            ['durationchange', [31.5]],
        ]);
    });
});

describe('announcements', () => {
    it('updates the slider values only when they change', () => {
        const { controller, media, fire, aria } = setup();
        loaded(media, 100);
        controller.bind(media);
        const before = aria.length;

        media.advance(10.1);
        fire('timeupdate');
        media.advance(10.3);
        fire('timeupdate');
        media.advance(10.4);
        fire('timeupdate');

        expect(aria.slice(before)).toEqual([{ now: 10, text: '0:10 / 1:40' }]);
    });

    it('reports time at the media pace, never once per animation frame', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 100);
        controller.bind(media);
        const timeupdates = () =>
            events.filter(([name]) => name === 'timeupdate');
        const before = timeupdates().length;

        media.advance(5);
        controller.tick();
        controller.tick();

        expect(controller.progress).toBe(0.05);
        expect(timeupdates()).toHaveLength(before);

        fire('timeupdate');

        expect(timeupdates().slice(before)).toEqual([
            ['timeupdate', [5, 0.05]],
        ]);
    });

    it('says a whole second the media is at as that very second', () => {
        // In floating point, 5 / 77 * 77 is 4.999…, which a person would read as 0:04.
        const { controller, media, fire, events, aria } = setup();
        loaded(media, 77);
        controller.bind(media);

        media.advance(5);
        fire('timeupdate');

        expect(events.filter(([name]) => name === 'timeupdate').at(-1)).toEqual(
            ['timeupdate', [5, 5 / 77]],
        );
        expect(aria.at(-1)?.text).toBe('0:05 / 1:17');
    });

    it('uses the app own words for the position', () => {
        const { controller, aria } = setup({
            valueText: (time, ratio) => `at ${time} (${ratio})`,
        });

        controller.setDuration(20);
        controller.setProgress(0.5);

        expect(aria.at(-1)).toEqual({ now: 50, text: 'at 10 (0.5)' });
    });
});

describe('hover', () => {
    it('reports the hovered time and clears it when a drag starts', () => {
        const { controller, events } = setup();
        controller.setDuration(60);

        controller.hoverAt(0.25);
        controller.hoverAt(0.25);
        controller.pointerDown(0.5);
        controller.hoverAt(0.75);

        expect(events.filter(([name]) => name === 'hover')).toEqual([
            ['hover', [0.25, 15]],
            ['hover', [null, null]],
        ]);
        expect(controller.hover).toBeNull();
    });
});

describe('ranges', () => {
    /** Playback reaches the end of the media; a browser then reports these events, already ended. */
    function playToTheEnd(
        media: FakeMedia,
        fire: (...types: MediaEventType[]) => void,
    ): void {
        media.advance(media.duration);
        media.ended = true;
        media.paused = true;
        fire('timeupdate', 'pause', 'ended');
    }

    const rangeEnds = (events: [string, unknown[]][]) =>
        events.filter(([name]) => name === 'rangeend');

    it('starts a looping range again when the media ends inside it', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(20, 30, true);
        playToTheEnd(media, fire);

        expect(media.currentTime).toBe(20);
        expect(media.plays).toBe(2);
        expect(rangeEnds(events)).toEqual([]);
    });

    it('ends a range that runs to the end of the media, and says so once', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(20, 30);
        playToTheEnd(media, fire);
        fire('ended');

        expect(rangeEnds(events)).toHaveLength(1);
    });

    it('stops a range off screen at the media own pace', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(5, 10);
        media.advance(10.2);
        fire('timeupdate');

        expect(media.paused).toBe(true);
        expect(rangeEnds(events)).toHaveLength(1);
    });

    it('loops a range off screen at the media own pace', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(5, 10, true);
        media.advance(10.2);
        fire('timeupdate');

        expect(media.currentTime).toBe(5);
        expect(rangeEnds(events)).toEqual([]);
    });
});
