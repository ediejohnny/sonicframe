/**
 * The `title` and `artist` parts: the sound's name (the player's own, else its file's when the look
 * allows) and the player's `artist`, as text hidden from screen readers; following `setLabel`; never
 * shown unless the look places them; and the same from the tag's `label`, `artist` and `line`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { afterTest, fakeMedia, showTag } from '../../support/helpers';
import { playableMedia, stubSession } from '../../support/media-session';
import {
    cleanUp as cleanUpPlaylist,
    make as makePlaylist,
    settle,
} from '../../playlist/playlist/playlist-harness';
import { cleanUp, container, keep } from '../player/player-harness';

afterEach(() => {
    cleanUp();
    cleanUpPlaylist();
});

const LINE: PlayerOptions['look'] = {
    line: ['play', 'wave', 'title', 'artist'],
};

function make(options: Partial<PlayerOptions> = {}): Player {
    return afterTest(
        createPlayer({
            container: container(),
            media: fakeMedia(),
            look: LINE,
            ...options,
        }),
    );
}

function textOf(player: Player, part: 'title' | 'artist'): string | null {
    return (
        player.element.querySelector(`.sonicframe-${part}`)?.textContent ?? null
    );
}

describe('the title and artist parts', () => {
    it('show the player’s name and artist, hidden from screen readers', () => {
        const player = make({ a11y: { label: 'Little Elf' }, artist: 'Edie' });

        expect(textOf(player, 'title')).toBe('Little Elf');
        expect(textOf(player, 'artist')).toBe('Edie');

        for (const part of ['title', 'artist']) {
            expect(
                player.element
                    .querySelector(`.sonicframe-${part}`)
                    ?.getAttribute('aria-hidden'),
            ).toBe('true');
        }
    });

    it('take the old `label` too, and `a11y.label` wins over it', () => {
        expect(textOf(make({ label: 'Old name' }), 'title')).toBe('Old name');
        expect(
            textOf(
                make({ label: 'Old name', a11y: { label: 'New name' } }),
                'title',
            ),
        ).toBe('New name');
    });

    it('without a name, the title is the file’s name; with `titleFromFile` off, nothing', () => {
        const src = 'https://cdn.test/sounds/little-elf.mp3?v=2';

        expect(textOf(make({ src, media: undefined }), 'title')).toBe(
            'Little elf',
        );
        expect(
            textOf(
                make({
                    src,
                    media: undefined,
                    look: { ...LINE, titleFromFile: false },
                }),
                'title',
            ),
        ).toBe('');
    });

    it('reads the file’s name from the app’s own audio', () => {
        const media = document.createElement('audio');
        media.src = 'https://cdn.test/sounds/night_walk.ogg';

        expect(textOf(make({ media }), 'title')).toBe('Night walk');
    });

    it('leave the line while they have no text, and come back with one', () => {
        const player = make({ look: { ...LINE, titleFromFile: false } });
        const title = (): HTMLElement | null =>
            player.element.querySelector('.sonicframe-title');

        expect(title()?.hidden).toBe(true);
        expect(
            player.element.querySelector<HTMLElement>('.sonicframe-artist')
                ?.hidden,
        ).toBe(true);

        player.setLabel('Little Elf');

        expect(title()?.hidden).toBe(false);
    });

    it('take the look’s widest, `nameMaxWidth`, and give their room to the wave first', () => {
        const player = make({
            a11y: { label: 'Little Elf' },
            look: { ...LINE, nameMaxWidth: 20 },
        });
        const style =
            player.element.querySelector<HTMLElement>(
                '.sonicframe-title',
            )?.style;

        expect(style?.getPropertyValue('max-width')).toBe('20rem');
        expect(style?.getPropertyValue('flex')).toBe('0 1 auto');
    });

    it('follow `setLabel`, back to the file’s name when the name goes', () => {
        const player = make({
            src: '/sounds/little-elf.mp3',
            media: undefined,
            a11y: { label: 'First' },
        });

        player.setLabel('Second');
        expect(textOf(player, 'title')).toBe('Second');

        player.setLabel();
        expect(textOf(player, 'title')).toBe('Little elf');
    });

    it('keep a name and artist one line long and capped', () => {
        const player = make({
            a11y: { label: 'Two\nlines' },
            artist: `A${'b'.repeat(300)}`,
        });

        expect(textOf(player, 'title')).toBe('Two lines');
        expect(textOf(player, 'artist')).toHaveLength(120);
    });

    it('never show unless the look places them', () => {
        const player = make({
            look: undefined,
            a11y: { label: 'Little Elf' },
            artist: 'Edie',
        });

        expect(textOf(player, 'title')).toBeNull();
        expect(textOf(player, 'artist')).toBeNull();
    });

    it('come from the tag’s `label`, `artist` and `line`; a word that is no part is left out', () => {
        defineSonicPlayer();
        const tag = document.createElement('sonic-player');
        tag.setAttribute('src', '/sounds/little-elf.mp3');
        tag.setAttribute('label', 'Little Elf');
        tag.setAttribute('artist', 'Edie');
        tag.setAttribute('line', 'play wave title nothing artist');
        keep(tag);
        showTag(tag);

        const title = tag.querySelector('.sonicframe-title');
        const artist = tag.querySelector('.sonicframe-artist');

        expect(title?.textContent).toBe('Little Elf');
        expect(artist?.textContent).toBe('Edie');
        expect(title?.nextElementSibling).toBe(artist);
    });

    it('the tag’s `meta` places a part on its own, in the line under the wave', () => {
        defineSonicPlayer();
        const tag = document.createElement('sonic-player');
        tag.setAttribute('src', '/sounds/little-elf.mp3');
        tag.setAttribute('meta', 'artist');
        tag.setAttribute('artist', 'Edie');
        keep(tag);
        showTag(tag);

        expect(tag.querySelector('.sonicframe-artist')?.textContent).toBe(
            'Edie',
        );
        expect(tag.querySelector('.sonicframe-title')).toBeNull();
    });
});

describe('maxText', () => {
    it('keeps the name, the artist and the words to 120 characters, or maxText up to 1000', async () => {
        const long = 'x'.repeat(2000);
        const plain = make({ a11y: { label: long }, artist: long });
        const raised = make({
            a11y: { label: long, words: { play: long } },
            artist: long,
            maxText: 1000,
        });

        expect(plain.element.getAttribute('aria-label')).toHaveLength(120);
        expect(textOf(plain, 'artist')).toHaveLength(120);
        expect(raised.element.getAttribute('aria-label')).toHaveLength(1000);
        expect(textOf(raised, 'title')).toHaveLength(1000);
        expect(textOf(raised, 'artist')).toHaveLength(1000);
        expect(
            raised.element.querySelector('button')?.getAttribute('aria-label'),
        ).toHaveLength(1000);
        expect(() => make({ maxText: 1001 })).toThrow(
            new RangeError(
                'sonicframe: maxText goes past its most, 1000 (1001)',
            ),
        );
    });

    it('keeps the media controls’ details to it too', async () => {
        const session = stubSession();
        const media = playableMedia(100);
        make({
            media,
            artist: 'a'.repeat(2000),
            mediaSession: { album: 'b'.repeat(2000) },
            maxText: 500,
        });
        await media.play();

        expect(session.metadata?.artist).toHaveLength(500);
        expect(session.metadata?.album).toHaveLength(500);
    });
});

describe('the artist elsewhere', () => {
    it('names the artist in the system’s media controls, unless the session gives its own', async () => {
        const session = stubSession();
        const media = playableMedia(100);
        make({ media, artist: 'Edie', mediaSession: true });
        await media.play();

        expect(session.metadata?.artist).toBe('Edie');

        const other = playableMedia(100);
        make({
            media: other,
            artist: 'Edie',
            mediaSession: { artist: 'Band' },
        });
        await other.play();

        expect(session.metadata?.artist).toBe('Band');
    });

    it('a playlist shows each track’s artist, and the playlist’s own for a track without one', async () => {
        const { playlist } = makePlaylist({
            player: { look: LINE, artist: 'Band' },
        });

        expect(textOf(playlist.player as Player, 'title')).toBe('One');
        expect(textOf(playlist.player as Player, 'artist')).toBe('Ana');

        playlist.next();
        await settle();

        expect(textOf(playlist.player as Player, 'title')).toBe('Track 2');
        expect(textOf(playlist.player as Player, 'artist')).toBe('Band');
    });
});
