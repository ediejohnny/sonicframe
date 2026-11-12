/**
 * The now-playing bar: it follows the player that started playing last (any player of the page), shows
 * when that player is playing and out of view (or as `when` says), plays and pauses it, says its name
 * and time as text, takes the person back to it, and stays closed as `close` says.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createPlayer, type Player } from '../../../src/player';
import { nowPlaying, type NowPlayingOptions } from '../../../src/playlist';
import { triggerVisible } from '../../support/fakes';
import { afterTest, pageHost } from '../../support/helpers';
import { playableMedia } from '../../support/media-session';

let hosts: HTMLElement[] = [];

afterEach(() => {
    for (const host of hosts) {
        host.remove();
    }

    hosts = [];
    vi.restoreAllMocks();
});

type Media = ReturnType<typeof playableMedia>;

function player(
    label = 'Episode one',
    tracks?: { previous: () => void; next: () => void },
): {
    player: Player;
    media: Media;
} {
    const host = pageHost({ left: 0, top: 0, width: 320, height: 48 });
    hosts.push(host);
    const media = playableMedia(100);
    const made = afterTest(
        createPlayer({ container: host, media, a11y: { label }, tracks }),
    );

    return { player: made, media };
}

function bar(options: Partial<NowPlayingOptions> = {}) {
    return afterTest(nowPlaying(options));
}

function box(): HTMLElement {
    return document.querySelector('.sonicframe-now-playing') as HTMLElement;
}

function part(name: string): HTMLElement | null {
    return box().querySelector(`.sonicframe-now-playing-${name}`);
}

describe('the now-playing bar', () => {
    it('stays hidden until a player plays, then shows while it is out of view', async () => {
        bar();
        const { player: made, media } = player();

        expect(box().hidden).toBe(true);

        await media.play();
        expect(box().hidden).toBe(true);

        triggerVisible(made.element, false);
        expect(box().hidden).toBe(false);
        expect(part('title')?.textContent).toBe('Episode one');

        triggerVisible(made.element, true);
        expect(box().hidden).toBe(true);
    });

    it('hides when the player pauses, and follows the player that played last', async () => {
        bar({ when: 'playing' });
        const first = player('First');
        const second = player('Second');

        await first.media.play();
        expect(part('title')?.textContent).toBe('First');

        await second.media.play();
        expect(part('title')?.textContent).toBe('Second');

        second.media.pause();
        expect(box().hidden).toBe(true);
    });

    it('shows the last player played even paused, with when "always"', async () => {
        bar({ when: 'always' });
        const { media } = player();

        expect(box().hidden).toBe(true);

        await media.play();
        media.pause();

        expect(box().hidden).toBe(false);
    });

    it('plays and pauses the player, and says which it will do', async () => {
        bar({ when: 'playing' });
        const { media } = player();
        await media.play();
        const play = part('play') as HTMLButtonElement;

        expect(play.getAttribute('aria-label')).toBe('Pause');

        play.click();

        expect(media.paused).toBe(true);
    });

    it('writes the time and fills the bar as the sound plays', async () => {
        bar({ when: 'playing' });
        const { media } = player();
        await media.play();
        media.currentTime = 25;
        media.fire('timeupdate');

        expect(part('time')?.textContent).toBe('0:25 / 1:40');
        expect(part('progress-fill')?.style.getPropertyValue('width')).toBe(
            '25%',
        );
    });

    it('takes the person back to the player and its play button', async () => {
        bar({ when: 'playing', parts: ['back', 'title'] });
        const { player: made, media } = player();
        await media.play();
        const scroll = vi.fn();
        made.element.scrollIntoView = scroll;

        part('back')?.click();

        expect(scroll).toHaveBeenCalled();
        expect(made.element.contains(document.activeElement)).toBe(true);
        expect(part('play')).toBeNull();
    });

    it('goes to the tracks around the sound with the track parts', async () => {
        bar({ when: 'playing', parts: ['previousTrack', 'nextTrack'] });
        const asked: string[] = [];
        const { media } = player('Track', {
            previous: () => asked.push('previous'),
            next: () => asked.push('next'),
        });
        await media.play();

        part('previous-track')?.click();
        part('next-track')?.click();

        expect(asked).toEqual(['previous', 'next']);
    });

    it('closes until the next play by default, and for the page when asked', async () => {
        bar({ when: 'playing' });
        const { media } = player();
        await media.play();

        part('close')?.click();
        expect(box().hidden).toBe(true);

        media.pause();
        await media.play();
        expect(box().hidden).toBe(false);
    });

    it('stays closed for the page with close "forPage"', async () => {
        bar({ when: 'playing', close: 'forPage' });
        const { media } = player();
        await media.play();

        part('close')?.click();
        media.pause();
        await media.play();

        expect(box().hidden).toBe(true);
    });

    it('is a named region that Escape closes, and says nothing unless asked', async () => {
        bar({ when: 'playing' });
        const { media } = player();
        await media.play();
        const play = part('play') as HTMLButtonElement;
        play.focus();

        expect(box().getAttribute('role')).toBe('region');
        expect(box().getAttribute('aria-label')).toBe('Now playing');

        play.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );

        expect(box().hidden).toBe(true);
        expect(
            document.querySelector('[role="status"]')?.textContent ?? '',
        ).not.toContain('Now playing');
    });

    it('sits where it is asked: the top, with an offset, aligned to the end', () => {
        bar({ place: 'top', offset: 2, align: 'end' });

        expect(box().style.getPropertyValue('top')).toContain('2rem');
        expect(box().style.getPropertyValue('bottom')).toBe('');
        expect(box().style.getPropertyValue('right')).not.toBe('');
    });

    it('shows a name from outside as text only', async () => {
        bar({ when: 'playing' });
        const { media } = player('<img src=x onerror=alert(1)>');
        await media.play();

        expect(part('title')?.textContent).toBe('<img src=x onerror=alert(1)>');
        expect(box().querySelector('img')).toBeNull();
    });

    it('leaves the page when destroyed', () => {
        const made = nowPlaying();

        made.destroy();

        expect(document.querySelector('.sonicframe-now-playing')).toBeNull();
    });
});
