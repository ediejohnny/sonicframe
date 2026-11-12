/**
 * `<sonic-playlist>`: the tracks come from the tag's own links (hidden while the playlist stands, back
 * when it goes), the attributes set the playlist and every track's player, a change to an attribute
 * or to a link builds it again (never a change inside the playlist it built), and its events reach
 * the page as `sonicframe:<event>`.
 */

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import {
    defineSonicPlaylist,
    PLAYLIST_ATTRIBUTES,
    type SonicPlaylistElement,
} from '../../../src/playlist';
import { pageHost } from '../../support/helpers';
import { cleanUp, keep, settle, titles } from '../playlist/playlist-harness';

beforeAll(() => {
    defineSonicPlaylist();
});

beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
        () => undefined,
    );
});

afterEach(cleanUp);

/** A tag with `attributes` and these links, put on the page. */
function tag(
    attributes: Record<string, string>,
    links: string = '<a href="https://site.test/one.mp3" data-artist="Ana">One</a>' +
        '<a href="https://site.test/two.mp3" data-duration="61">Two</a>',
): SonicPlaylistElement {
    const host = pageHost({ left: 0, top: 0, width: 320, height: 200 });
    keep(host);
    const element = document.createElement(
        'sonic-playlist',
    ) as SonicPlaylistElement;

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    element.insertAdjacentHTML('beforeend', links);
    host.append(element);

    return element;
}

describe('<sonic-playlist>', () => {
    it('is registered once', () => {
        expect(defineSonicPlaylist()).toBe(false);
    });

    it('plays its own links, hidden while the playlist stands and back when it goes', () => {
        const element = tag({});
        const links = [
            ...element.querySelectorAll(':scope > a'),
        ] as HTMLElement[];

        expect(titles()).toEqual(['One', 'Two']);
        expect(links.every((link) => link.hidden)).toBe(true);
        expect(element.playlist?.tracks[0].artist).toBe('Ana');
        expect(element.playlist?.tracks[1].duration).toBe(61);

        element.remove();

        expect(links.every((link) => !link.hidden)).toBe(true);
        expect(element.playlist).toBeNull();
    });

    it('leaves out a link whose address is not a web address', () => {
        const element = tag(
            {},
            '<a href="javascript:alert(1)">Bad</a><a href="https://site.test/ok.mp3">Ok</a>',
        );

        expect(element.playlist?.tracks.map((track) => track.title)).toEqual([
            'Ok',
        ]);
    });

    it('sets the playlist and its list from the attributes', () => {
        const element = tag({
            repeat: 'all',
            shuffle: '',
            start: '1',
            buttons: 'repeat',
            'list-place': 'above',
            'a11y-label': 'Episodes',
        });
        const playlist = element.playlist;

        expect(playlist?.repeat).toBe('all');
        expect(playlist?.shuffle).toBe(true);
        expect(playlist?.index).toBe(1);
        expect(
            element.querySelector('.sonicframe-playlist-shuffle'),
        ).toBeNull();
        expect(playlist?.element.getAttribute('aria-label')).toBe('Episodes');
        expect(
            playlist?.element
                .querySelector('.sonicframe-player')
                ?.getAttribute('aria-label'),
        ).toBe('Two');
    });

    it('never lets the tag send cookies to another site, only keep them home or leave them out', () => {
        const asked: RequestInit[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, init: RequestInit) => {
                asked.push(init);

                return Promise.reject(new Error('offline'));
            }),
        );

        tag({
            src: 'https://lists.test/a.m3u',
            'fetch-credentials': 'include',
        });
        tag({ src: 'https://lists.test/a.m3u', 'fetch-credentials': 'omit' });

        expect(asked.map((init) => init.credentials)).toEqual([
            'same-origin',
            'omit',
        ]);
    });

    it('hides the list with list="false"', () => {
        tag({ list: 'false' });

        expect(titles()).toEqual([]);
    });

    it('builds again when an attribute changes', () => {
        const element = tag({});
        const first = element.playlist;

        element.setAttribute('repeat', 'one');

        expect(element.playlist).not.toBe(first);
        expect(element.playlist?.repeat).toBe('one');
    });

    it('reads its links again when one is added, and never for a change inside the playlist', async () => {
        const element = tag({});
        const first = element.playlist;
        // A link of the playlist's own (a chapter's, say), added and then changed.
        const inner = document.createElement('a');
        first?.element.append(inner);
        await settle();
        inner.setAttribute('href', 'https://site.test/chapter');
        inner.textContent = 'Chapter page';
        await settle();

        expect(element.playlist).toBe(first);

        const link = document.createElement('a');
        link.href = 'https://site.test/three.mp3';
        link.textContent = 'Three';
        element.append(link);
        await vi.waitFor(() =>
            expect(element.playlist?.tracks).toHaveLength(3),
        );
        expect(link.hidden).toBe(true);
    });

    it('tells the page of its events', () => {
        const element = tag({});
        const heard: unknown[] = [];
        element.addEventListener('sonicframe:trackchange', (event) =>
            heard.push((event as CustomEvent).detail[1]),
        );

        element.playlist?.select(1);

        expect(heard).toEqual([1]);
    });

    it('lists the attributes it reads, the playlist’s and the player’s, but the sound’s', () => {
        expect(PLAYLIST_ATTRIBUTES).toContain('repeat');
        expect(PLAYLIST_ATTRIBUTES).toContain('theme');
        expect(PLAYLIST_ATTRIBUTES).not.toContain('peaks');
        expect(PLAYLIST_ATTRIBUTES).not.toContain('preload');
    });
});
