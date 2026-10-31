/**
 * The time keeps the room of the longest time the sound can show, so its digits never change the
 * wave's width as the sound plays (a narrower digit used to shrink the time, resize the wave and
 * blank its canvas for a frame). The text sits toward the wave's far side or the near one, by its
 * place or by the look's `timeAlign`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { createPlayer, type Player } from '../../src/player';
import { boxOf, fakeMedia } from './helpers';
import { triggerResize } from './fakes';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
});

const PEAKS = Array.from({ length: 200 }, (_, i) => (i % 7) / 7);

function make(
    look: Record<string, unknown> = {},
    duration = 123,
): ReturnType<typeof fakeMedia> {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 640, height: 48 });
    const media = fakeMedia({ duration });
    player = createPlayer({
        container: host,
        media,
        peaks: PEAKS,
        look: { line: ['play', 'wave', 'time'], ...look },
    });

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

    it('keeps to the start under a voice note’s wave, and back to the end on one line', () => {
        make({ line: ['play', 'wave', 'time', 'speed'] });
        const root = (host as HTMLElement).querySelector(
            '.sonicframe-player',
        ) as HTMLElement;
        const [time] = times();

        triggerResize(root, { width: 320, height: 48 });
        expect(read(time).side).toBe('start');

        triggerResize(root, { width: 640, height: 48 });
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
