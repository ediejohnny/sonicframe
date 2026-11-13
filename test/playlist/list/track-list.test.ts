/**
 * The playlist's list and what it keeps: the tracks as text only (never as HTML), the arrows moving
 * the focus with one stop in the tab order, the shuffle and repeat buttons saying their state, the
 * list floating over the page from its button, the words of the page's language, what is remembered
 * between visits (read back as outside input), and a list fetched from an address.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { RememberStore } from '../../../src/core/player/remember';
import { serve } from '../../support/responses';
import {
    barButton,
    cleanUp,
    items,
    make,
    marked,
    serveText,
    settle,
    titles,
} from '../playlist/playlist-harness';

afterEach(cleanUp);

/** A storage in memory. */
function memoryStore(): RememberStore & { kept: Map<string, string> } {
    const kept = new Map<string, string>();

    return {
        kept,
        getItem: (key) => kept.get(key) ?? null,
        setItem: (key, value) => void kept.set(key, value),
        removeItem: (key) => void kept.delete(key),
    };
}

function press(target: HTMLElement, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

const PAYLOADS = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '"><svg onload=alert(1)>',
    '&amp;lt;script&amp;gt;',
];

describe('the list', () => {
    it('shows each track’s title and artist, "Track 2" for one without a title', () => {
        make();

        expect(titles()).toEqual(['One', 'Track 2', 'Three']);
        expect(
            items()[0].querySelector('.sonicframe-track-span')?.textContent,
        ).toBe('Ana');
        expect(
            document
                .querySelector('nav.sonicframe-tracks')
                ?.getAttribute('aria-label'),
        ).toBe('Playlist');
    });

    it('shows titles and artists from outside as text, never as page elements', () => {
        const { playlist } = make({
            tracks: PAYLOADS.map((title, at) => ({
                src: `https://site.test/${at}.mp3`,
                title,
                artist: title,
                artwork: 'javascript:alert(1)',
            })),
        });

        expect(titles()).toEqual(PAYLOADS);
        expect(
            playlist.element.querySelectorAll('script, svg[onload], img'),
        ).toHaveLength(0);
        expect(document.querySelectorAll('[onerror], [onload]')).toHaveLength(
            0,
        );
    });

    it('goes above the player when asked', () => {
        const { playlist } = make({ list: { place: 'above' } });
        const parts = [...playlist.element.children].map(
            (part) => part.className,
        );

        expect(parts.indexOf('sonicframe-playlist-tracks')).toBeLessThan(
            parts.indexOf('sonicframe-playlist-player'),
        );
    });

    it('stays out with list false, and with a player for each track', () => {
        make({ list: false });
        expect(items()).toHaveLength(0);
        cleanUp();
        make({ layout: 'each' });
        expect(items()).toHaveLength(0);
    });
});

describe('the list by keyboard', () => {
    it('keeps one stop in the tab order: the track playing', () => {
        make({ start: 1 });

        expect(items().map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
    });

    it('moves the focus with the arrows, Home and End, without leaving the list', () => {
        make();
        const [first, second, third] = items();
        first.focus();

        press(first, 'ArrowDown');
        expect(document.activeElement).toBe(second);
        expect(second.tabIndex).toBe(0);
        expect(first.tabIndex).toBe(-1);

        press(second, 'End');
        expect(document.activeElement).toBe(third);

        press(third, 'ArrowDown');
        expect(document.activeElement).toBe(third);

        press(third, 'Home');
        expect(document.activeElement).toBe(first);

        press(first, 'ArrowUp');
        expect(document.activeElement).toBe(first);
    });
});

describe('the buttons over the list', () => {
    it('say whether the shuffle is on, and turn it on and off', () => {
        const { playlist } = make();
        const shuffle = barButton('shuffle');

        expect(shuffle.getAttribute('aria-label')).toBe('Shuffle');
        expect(shuffle.getAttribute('aria-pressed')).toBe('false');

        shuffle.click();

        expect(playlist.shuffle).toBe(true);
        expect(shuffle.getAttribute('aria-pressed')).toBe('true');
    });

    it('step the repeat through off, all and one, saying each', () => {
        const { playlist } = make();
        const repeat = barButton('repeat');
        const seen: [string | null, string | null][] = [];

        for (let press = 0; press < 3; press += 1) {
            seen.push([
                repeat.getAttribute('aria-label'),
                repeat.getAttribute('aria-pressed'),
            ]);
            repeat.click();
        }

        expect(seen).toEqual([
            ['Repeat: off', 'false'],
            ['Repeat: all', 'true'],
            ['Repeat: one', 'true'],
        ]);
        expect(playlist.repeat).toBe('none');
    });

    it('leave out what the app leaves out', () => {
        make({ buttons: ['repeat'] });

        expect(
            document.querySelector('.sonicframe-playlist-shuffle'),
        ).toBeNull();
        expect(barButton('repeat')).not.toBeNull();
    });
});

describe('a list floating over the page', () => {
    it('opens from its button, which says whether it is open', () => {
        const { playlist } = make({ list: { type: 'popover' } });
        const toggle = barButton('toggle');
        const box = document.querySelector<HTMLElement>(
            '.sonicframe-track-list',
        );

        expect(toggle.getAttribute('aria-label')).toBe('Playlist');
        expect(toggle.getAttribute('aria-controls')).toBe(box?.id);
        expect(box?.hidden).toBe(true);
        expect(playlist.element.contains(box)).toBe(false);

        toggle.click();

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(box?.hidden).toBe(false);
        expect(document.activeElement).toBe(items()[0]);
    });

    it('closes when a track is chosen, the focus back on its button', async () => {
        const { playlist } = make({ list: { type: 'drawer' } });
        const toggle = barButton('toggle');
        toggle.click();

        items()[1].click();
        await settle();

        expect(playlist.index).toBe(1);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(toggle);
    });

    it('leaves the page with the playlist', () => {
        const { playlist } = make({ list: { type: 'drawer' } });

        playlist.destroy();

        expect(document.querySelector('.sonicframe-track-list')).toBeNull();
    });
});

describe('the words', () => {
    it('speak the page’s language, and the app’s own words win', () => {
        document.documentElement.setAttribute('lang', 'pt-BR');
        make({ a11y: { lang: 'auto', words: { shuffle: 'Misturar' } } });

        expect(titles()[1]).toBe('Faixa 2');
        expect(barButton('repeat').getAttribute('aria-label')).toBe(
            'Repetir: desligado',
        );
        expect(barButton('shuffle').getAttribute('aria-label')).toBe(
            'Misturar',
        );
    });
});

describe('remember', () => {
    it('keeps the track, the shuffle and the repeat, and the next visit starts there', () => {
        const store = memoryStore();
        const { playlist } = make({ remember: { store } });

        playlist.select(2);
        playlist.setRepeat('all');
        cleanUp();
        const again = make({ remember: { store } }).playlist;

        expect(again.index).toBe(2);
        expect(again.repeat).toBe('all');
        expect(marked()).toBe(2);
        expect([...store.kept.keys()]).toEqual(['sonicframe:playlist']);
    });

    it('reads what is kept as outside input: a strange value is left out', () => {
        const store = memoryStore();
        store.setItem(
            'sonicframe:playlist',
            '{"track":"nowhere","shuffle":"yes","repeat":"<img>"}',
        );

        const { playlist } = make({ remember: { store }, repeat: 'one' });

        expect(playlist.index).toBe(0);
        expect(playlist.shuffle).toBe(false);
        expect(playlist.repeat).toBe('one');
    });

    it('keeps nothing while off, and forgets when asked', () => {
        const store = memoryStore();
        const { playlist } = make({ remember: { store, key: 'show' } });
        playlist.select(1);

        expect(store.kept.has('sonicframe:playlist:show')).toBe(true);

        playlist.forget();

        expect(store.kept.size).toBe(0);
        cleanUp();
        make().playlist.select(1);
        expect(store.kept.size).toBe(0);
    });

    it('goes on without remembering when the storage fails', () => {
        const store: RememberStore = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
            removeItem: () => {
                throw new Error('blocked');
            },
        };
        const { playlist } = make({ remember: { store } });

        expect(() => playlist.select(1)).not.toThrow();
        expect(playlist.index).toBe(1);
    });
});

describe('a list from an address', () => {
    it('fetches it, cookies only to the page’s own site, and plays its first track', async () => {
        const asked = serveText('#EXTM3U\n#EXTINF:5,Far\nfar.mp3\n');
        const { playlist, media } = make({
            tracks: undefined,
            src: 'https://lists.test/show/list.m3u',
        });
        const changes: number[] = [];
        playlist.on('trackschange', (tracks) => changes.push(tracks.length));

        await vi.waitFor(() => expect(playlist.tracks).toHaveLength(1));

        expect(asked[0].credentials).toBe('same-origin');
        expect(media.src).toBe('https://lists.test/show/far.mp3');
        expect(titles()).toEqual(['Far']);
        expect(changes).toEqual([1]);
    });

    it('reports a list it cannot load, and never fetches an address that is not a web address', async () => {
        const fetch = vi.fn(() =>
            serve(new Uint8Array(0), { status: 500 })(''),
        );
        vi.stubGlobal('fetch', fetch);
        const errors: string[] = [];
        const { playlist } = make({
            tracks: undefined,
            src: 'https://lists.test/a.m3u',
        });
        playlist.on('error', (error) => errors.push(error.message));

        await vi.waitFor(() => expect(errors).toHaveLength(1));
        expect(errors[0]).toContain('(500)');

        cleanUp();
        vi.stubGlobal('fetch', fetch);
        const bad = make({
            tracks: undefined,
            src: 'javascript:alert(1)',
        }).playlist;
        const refused: string[] = [];
        bad.on('error', (error) => refused.push(error.message));
        await vi.waitFor(() => expect(refused).toHaveLength(1));

        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
