/**
 * `SONIC_TAGS`, what an HTML filter must allow for SonicFrame's tags to work: it lists exactly the
 * attributes each registered tag watches and each playlist link is read for, never an event handler,
 * marks the one that sends a visitor's recording away as for trusted authors only, and cannot be
 * changed by the page.
 */

import { beforeAll, describe, expect, it } from 'vite-plus/test';
import { SONIC_TAGS } from '../../src/index';
import { defineSonicPlayer } from '../../src/player';
import { defineSonicNowPlaying, defineSonicPlaylist } from '../../src/playlist';
import { playlistOptionsOf } from '../../src/playlist/element/playlist-attributes';
import { defineSonicRecorder } from '../../src/record';

beforeAll(() => {
    defineSonicPlayer();
    defineSonicPlaylist();
    defineSonicNowPlaying();
    defineSonicRecorder();
});

function entry(name: string) {
    const found = SONIC_TAGS.find((tag) => tag.tag === name);

    if (found === undefined) {
        throw new Error(`test: no ${name} in SONIC_TAGS`);
    }

    return found;
}

describe('SONIC_TAGS', () => {
    it('lists each tag with exactly the attributes the registered tag watches', () => {
        expect(SONIC_TAGS.map((tag) => tag.tag)).toEqual([
            'sonic-player',
            'sonic-playlist',
            'sonic-now-playing',
            'sonic-recorder',
        ]);

        for (const { tag, attributes } of SONIC_TAGS) {
            const watched = (
                customElements.get(tag) as unknown as {
                    observedAttributes: string[];
                }
            ).observedAttributes;

            expect([...attributes].sort(), tag).toEqual([...watched].sort());
        }
    });

    it('lists the attributes a playlist link is read for, and the recorder’s icon names', () => {
        expect(entry('sonic-playlist').children).toEqual([
            {
                tag: 'a',
                attributes: [
                    'href',
                    'data-artist',
                    'data-album',
                    'data-artwork',
                    'data-peaks',
                    'data-duration',
                    'data-chapters',
                    'data-id',
                ],
                trustedOnly: [],
                prefixes: [],
                children: [],
            },
        ]);
        expect(entry('sonic-recorder').prefixes).toEqual(['icon-']);
    });

    it('marks for trusted authors only the address a visitor’s recording is sent to', () => {
        expect(SONIC_TAGS.map((tag) => [tag.tag, tag.trustedOnly])).toEqual([
            ['sonic-player', []],
            ['sonic-playlist', []],
            ['sonic-now-playing', []],
            ['sonic-recorder', ['upload-url']],
        ]);

        for (const { tag, attributes, trustedOnly } of SONIC_TAGS) {
            for (const name of trustedOnly) {
                expect(attributes, `${tag} ${name}`).toContain(name);
            }
        }
    });

    it('lists only link attributes a playlist really reads', () => {
        const tag = document.createElement('sonic-playlist');
        const link = document.createElement('a');
        link.textContent = 'One';

        for (const [name, value] of [
            ['href', 'https://site.test/one.mp3'],
            ['data-artist', 'Ana'],
            ['data-album', 'Live'],
            ['data-artwork', 'https://site.test/one.jpg'],
            ['data-peaks', 'https://site.test/one.json'],
            ['data-duration', '61'],
            ['data-chapters', 'https://site.test/one.vtt'],
            ['data-id', 'ep-1'],
        ]) {
            link.setAttribute(name, value);
        }

        tag.append(link);

        expect(playlistOptionsOf(tag).tracks).toEqual([
            {
                src: 'https://site.test/one.mp3',
                title: 'One',
                artist: 'Ana',
                album: 'Live',
                artwork: 'https://site.test/one.jpg',
                peaks: 'https://site.test/one.json',
                duration: 61,
                chapters: 'https://site.test/one.vtt',
                id: 'ep-1',
            },
        ]);
    });

    it('never names an event handler, a style or a duplicate', () => {
        const every = (
            tags: readonly (typeof SONIC_TAGS)[number][],
        ): string[] =>
            tags.flatMap((tag) => [
                ...tag.attributes,
                ...tag.prefixes,
                ...every(tag.children),
            ]);

        for (const name of every(SONIC_TAGS)) {
            expect(name.startsWith('on'), name).toBe(false);
            expect(name, name).not.toBe('style');
        }

        for (const { tag, attributes } of SONIC_TAGS) {
            expect(new Set(attributes).size, tag).toBe(attributes.length);
        }
    });

    it('cannot be changed by the page', () => {
        const player = entry('sonic-player');

        expect(Object.isFrozen(SONIC_TAGS)).toBe(true);
        expect(Object.isFrozen(player)).toBe(true);
        expect(Object.isFrozen(player.attributes)).toBe(true);
        expect(Object.isFrozen(entry('sonic-playlist').children[0])).toBe(true);
    });
});
