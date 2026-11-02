/**
 * The time keeps the room of the longest time the sound can show, so its digits never change the
 * wave's width as the sound plays (a narrower digit used to shrink the time, resize the wave and
 * blank its canvas for a frame). The text sits toward the wave's far side or the near one, by its
 * place or by the look's `timeAlign`. Before the sound loads, it tells where a seek will start it.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { Part } from '../../../src/core/player/look';
import { createPlayer } from '../../../src/player';
import { triggerResize } from '../../support/fakes';
import {
    afterTest,
    fakeMedia,
    nextFrame,
    pageHost,
} from '../../support/helpers';
import { STEPS } from '../../support/sounds';

type Media = ReturnType<typeof fakeMedia>;

let host: HTMLElement | null = null;

function make(
    look: Record<string, unknown> = {},
    duration = 123,
): ReturnType<typeof fakeMedia> {
    host = pageHost({ left: 0, top: 0, width: 640, height: 48 });
    const media = fakeMedia({ duration });
    afterTest(
        createPlayer({
            container: host,
            media,
            peaks: STEPS,
            look: { line: ['play', 'wave', 'time'], ...look },
        }),
    );

    return media;
}

function times(): HTMLElement[] {
    return [
        ...(host as HTMLElement).querySelectorAll<HTMLElement>(
            '.sonicframe-time',
        ),
    ];
}

/** The time shown, the hidden mold that holds its room, and where the shown text sits. */
function read(time: HTMLElement): { text: string; mold: string; side: string } {
    const text = time.querySelector<HTMLElement>('.sonicframe-time-text');
    const mold = time.querySelector<HTMLElement>('.sonicframe-time-mold');

    return {
        text: text?.textContent ?? '',
        mold: mold?.textContent ?? '',
        side: text?.style.getPropertyValue('justify-self') ?? '',
    };
}

describe('the time’s room', () => {
    it('keeps the room of the longest time, in the cell the shown time shares', () => {
        const media = make();
        media.currentTime = 7;
        media.fire('timeupdate');
        const [time] = times();
        const text = time.querySelector<HTMLElement>('.sonicframe-time-text');
        const mold = time.querySelector<HTMLElement>('.sonicframe-time-mold');

        expect(read(time)).toMatchObject({
            text: '0:07 / 2:03',
            mold: '0:00 / 0:00',
        });
        expect(time.style.getPropertyValue('display')).toBe('inline-grid');
        expect(text?.style.getPropertyValue('grid-area')).toBe('1 / 1');
        expect(mold?.style.getPropertyValue('grid-area')).toBe('1 / 1');
        expect(mold?.style.getPropertyValue('visibility')).toBe('hidden');
        expect(time.getAttribute('aria-hidden')).toBe('true');
    });

    it('grows the room when the sound turns out longer', () => {
        const media = make({}, 123);
        const [time] = times();

        Object.defineProperty(media, 'duration', { value: 3600 });
        media.fire('durationchange');

        expect(read(time).mold).toBe('0:00:00 / 0:00:00');
    });

    it('molds each kind of time on its own longest text', () => {
        make({ line: ['play', 'wave', 'elapsed', 'remaining'] }, 600);

        expect(times().map((time) => read(time).mold)).toEqual([
            '00:00',
            '-00:00',
        ]);
    });
});

describe('where the time sits in its room', () => {
    it('keeps to the end after the wave and to the start before it', () => {
        make({ line: ['play', 'elapsed', 'wave', 'duration'] });

        expect(times().map((time) => read(time).side)).toEqual([
            'start',
            'end',
        ]);
    });

    it('keeps to the end after a spacer in the row under the wave', () => {
        make({
            line: ['play', 'wave'],
            meta: ['elapsed', 'spacer', 'duration'],
        });

        expect(times().map((time) => read(time).side)).toEqual([
            'start',
            'end',
        ]);
    });

    it('keeps to the start under a voice note’s wave, and back to the end on one line', async () => {
        make({ line: ['play', 'wave', 'time', 'speed'] });
        const root = (host as HTMLElement).querySelector(
            '.sonicframe-player',
        ) as HTMLElement;
        const [time] = times();

        // The player changes the page at the next frame, out of the browser's size report.
        triggerResize(root, { width: 320, height: 48 });
        await nextFrame();
        expect(read(time).side).toBe('start');

        triggerResize(root, { width: 640, height: 48 });
        await nextFrame();
        expect(read(time).side).toBe('end');
    });

    it('takes the side the look names, wherever the time is', () => {
        make({
            line: ['play', 'elapsed', 'wave', 'duration'],
            timeAlign: 'center',
        });

        expect(times().map((time) => read(time).side)).toEqual([
            'center',
            'center',
        ]);
    });
});

describe('the time where a seek landed', () => {
    it('shows a position the media landed 2 ms short of a second as that second, in the time and the slider', () => {
        // An MP3 asked for 0:15 before it loaded started at 14.998 (measured in Chrome).
        const media = make({}, 33);
        media.currentTime = 14.998;
        media.fire('timeupdate');

        expect(read(times()[0]).text).toBe('0:15 / 0:33');
        expect(
            host
                ?.querySelector('[role="slider"]')
                ?.getAttribute('aria-valuetext'),
        ).toBe('0:15 / 0:33');
    });
});

describe('the time before the sound loads', () => {
    /**
     * A 77-second sound whose media has loaded nothing yet (`preload="none"`): a seek waits in the
     * wave until play, and the media still says 0. Returns the wave, a slider.
     */
    function unloaded(line: Part[]): HTMLElement {
        host = pageHost({ left: 0, top: 0, width: 640, height: 48 });
        afterTest(
            createPlayer({
                container: host,
                media: fakeMedia({ readyState: 0 }),
                peaks: STEPS,
                duration: 77,
                look: { line },
            }),
        );

        return host.querySelector('[role="slider"]') as HTMLElement;
    }

    function press(slider: HTMLElement, key: string): void {
        slider.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true }),
        );
    }

    it('shows where a seek made before play will start the sound', () => {
        const slider = unloaded(['play', 'wave', 'time']);

        press(slider, 'ArrowRight');

        expect(read(times()[0]).text).toBe('0:05 / 1:17');
    });

    it('skips from where that seek will start the sound, not from its beginning', () => {
        const slider = unloaded(['play', 'wave', 'forward', 'time']);

        press(slider, 'ArrowRight');
        host?.querySelector<HTMLButtonElement>('.sonicframe-forward')?.click();

        expect(read(times()[0]).text).toBe('0:15 / 1:17');
    });
});

describe('a precise clock', () => {
    it('reads hundredths, its room kept by a mold of the same precision', () => {
        const media = make({ timePrecision: 'hundredths' });
        media.currentTime = 7.256;
        media.fire('timeupdate');

        expect(read(times()[0])).toMatchObject({
            text: '0:07.26 / 2:03.00',
            mold: '0:00.00 / 0:00.00',
        });
    });

    it('reads a timecode, the hours in two digits, in every kind of time', () => {
        const media = make(
            {
                line: ['play', 'wave', 'elapsed', 'remaining'],
                timePrecision: 'frames',
                timeFps: 25,
                timeHours: 'padded',
            },
            3725,
        );
        media.currentTime = 65.5;
        media.fire('timeupdate');

        expect(times().map((time) => read(time))).toMatchObject([
            { text: '00:01:05:12', mold: '00:00:00:00' },
            { text: '-01:00:59:13', mold: '-00:00:00:00' },
        ]);
    });

    it('writes the decimal mark of the player’s language when the look says `auto`', () => {
        host = pageHost({ left: 0, top: 0, width: 640, height: 48 });
        const media = fakeMedia({ duration: 123 });
        afterTest(
            createPlayer({
                container: host,
                media,
                peaks: STEPS,
                a11y: { lang: 'pt-BR' },
                look: { timePrecision: 'tenths', timeDecimal: 'auto' },
            }),
        );
        media.currentTime = 7.25;
        media.fire('timeupdate');

        expect(read(times()[0]).text).toBe('0:07,3 / 2:03,0');
    });

    it('keeps the slider’s words in whole seconds', () => {
        const media = make({ timePrecision: 'milliseconds' }, 33);
        media.currentTime = 14.998;
        media.fire('timeupdate');

        expect(read(times()[0]).text).toBe('0:14.998 / 0:33.000');
        expect(
            host
                ?.querySelector('[role="slider"]')
                ?.getAttribute('aria-valuetext'),
        ).toBe('0:15 / 0:33');
    });

    /**
     * A 123-second sound playing in a player with a tenths clock, under a hand-moved clock; the
     * player goes and the real clock comes back after `check`.
     */
    function playingTenths(check: (media: Media) => void): void {
        vi.useFakeTimers({
            toFake: [
                'setTimeout',
                'clearTimeout',
                'requestAnimationFrame',
                'cancelAnimationFrame',
                'performance',
            ],
        });

        try {
            host = pageHost({ left: 0, top: 0, width: 640, height: 48 });
            const media = fakeMedia({ duration: 123, paused: false });
            const player = createPlayer({
                container: host,
                media,
                peaks: STEPS,
                look: { timePrecision: 'tenths' },
            });
            check(media);
            player.destroy();
            vi.runOnlyPendingTimers();
        } finally {
            vi.useRealTimers();
        }
    }

    it('touches the page only when the text changes, though it reads the time again and again', () => {
        playingTenths((media) => {
            media.currentTime = 4.5;
            media.fire('playing');
            vi.advanceTimersByTime(60);
            const text = times()[0].querySelector(
                '.sonicframe-time-text',
            ) as HTMLElement;
            const watch = new MutationObserver(() => {});
            watch.observe(text, {
                childList: true,
                characterData: true,
                subtree: true,
            });

            // The sound waits on 4.5 s: the clock looks again every 51 ms for the tenth to turn,
            // and the text reads the same each time, so it stays.
            vi.advanceTimersByTime(300);

            expect(watch.takeRecords()).toHaveLength(0);
            expect(text.textContent).toBe('0:04.5 / 2:03.0');
            watch.disconnect();
        });
    });

    it('moves while the sound plays, between the media’s own reports', () => {
        playingTenths((media) => {
            media.fire('playing');
            media.currentTime = 1.26;
            vi.advanceTimersByTime(100);

            expect(read(times()[0]).text).toBe('0:01.3 / 2:03.0');
        });
    });
});
