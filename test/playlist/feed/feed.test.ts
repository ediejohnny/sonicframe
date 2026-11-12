/**
 * A podcast feed fetched and played: `loadFeed` sends cookies only to the page's own site and
 * refuses an address that is not a web one, the playlist plays the newest episode, and the tag's
 * `feed` attribute reads its order and limit. Reading the feed itself is tested in the core.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineSonicPlaylist, loadFeed } from '../../../src/playlist';
import { playlistOptionsOf } from '../../../src/playlist/element/playlist-attributes';
import { feed, ONE, TWO } from '../../support/feeds';
import { pageHost } from '../../support/helpers';
import { serve } from '../../support/responses';
import {
    cleanUp,
    keep,
    make,
    serveText,
    titles,
} from '../playlist/playlist-harness';

afterEach(cleanUp);

describe('loadFeed and the playlist', () => {
    it('fetches a feed, cookies only to the page’s own site, and plays its newest episode', async () => {
        const asked = serveText(feed(ONE + TWO));

        const read = await loadFeed('https://site.test/feeds/show.xml');
        expect(read.tracks[0].src).toBe('https://site.test/feeds/ep2.mp3');
        expect(asked[0].credentials).toBe('same-origin');

        const { playlist, media } = make({
            tracks: undefined,
            feed: 'https://site.test/feeds/show.xml',
        });

        await vi.waitFor(() => expect(playlist.tracks).toHaveLength(2));
        expect(titles()).toEqual(['Second', 'Pilot']);
        expect(media.src).toBe('https://site.test/feeds/ep2.mp3');
    });

    it('reads the feed attribute of the tag, with its order and limit', async () => {
        defineSonicPlaylist();
        vi.stubGlobal(
            'fetch',
            vi.fn(() => serve(new TextEncoder().encode(feed(ONE + TWO)))('')),
        );
        const host = pageHost({ left: 0, top: 0, width: 320, height: 200 });
        keep(host);
        const tag = document.createElement('sonic-playlist');
        tag.setAttribute('feed', 'https://site.test/feeds/show.xml');
        tag.setAttribute('feed-order', 'oldest');
        tag.setAttribute('feed-limit', '1');
        host.append(tag);

        await vi.waitFor(() => expect(titles()).toEqual(['Pilot']));
    });

    it('stops fetching a feed past the size given, by loadFeed and by the playlist', async () => {
        serveText(feed(TWO, `<description>${'x'.repeat(1100)}</description>`));

        await expect(
            loadFeed('https://site.test/feeds/show.xml', { maxSize: 1024 }),
        ).rejects.toThrow('feed file is too large');

        const { playlist } = make({
            tracks: undefined,
            feed: { src: 'https://site.test/feeds/show.xml', maxSize: 1024 },
        });
        const errors: string[] = [];
        playlist.on('error', (error) => errors.push(error.message));

        await vi.waitFor(() => expect(errors).toHaveLength(1));
        expect(errors[0]).toContain('too large');
        expect(titles()).toEqual([]);
    });

    it('passes the feed ceilings of the playlist on to the reader', async () => {
        serveText(feed(ONE));
        const read = (feedOptions: object): Promise<string[]> => {
            const { playlist } = make({
                tracks: undefined,
                feed: {
                    src: 'https://site.test/feeds/show.xml',
                    ...feedOptions,
                },
            });
            const errors: string[] = [];
            playlist.on('error', (error) => errors.push(error.message));

            return vi
                .waitFor(() => expect(errors).toHaveLength(1))
                .then(() => errors);
        };

        expect(await read({ maxDepth: 2 })).toEqual([
            expect.stringContaining('maxDepth (2)'),
        ]);
        cleanUp();
        serveText(feed(ONE));
        expect(await read({ maxNameLength: 5 })).toEqual([
            expect.stringContaining('maxNameLength (5)'),
        ]);
    });

    it('reads the feed ceilings from the tag, which may lower them but never raise them', () => {
        const tag = document.createElement('sonic-playlist');
        tag.setAttribute('feed', 'https://site.test/feeds/show.xml');
        tag.setAttribute('feed-max-size', '2048');
        tag.setAttribute('feed-max-depth', '8');
        tag.setAttribute('feed-max-elements', '5000');
        tag.setAttribute('feed-max-attributes', '20');
        tag.setAttribute('feed-max-name-length', '64');

        expect(playlistOptionsOf(tag).feed).toMatchObject({
            maxSize: 2048,
            maxDepth: 8,
            maxElements: 5000,
            maxAttributes: 20,
            maxNameLength: 64,
        });

        for (const name of [
            'max-size',
            'max-depth',
            'max-elements',
            'max-attributes',
            'max-name-length',
        ]) {
            tag.setAttribute(`feed-${name}`, '99999999');
        }

        expect(playlistOptionsOf(tag).feed).toMatchObject({
            maxSize: 5_242_880,
            maxDepth: 100,
            maxElements: 200_000,
            maxAttributes: 200,
            maxNameLength: 1000,
        });
    });

    it('never fetches a feed address that is not a web address', async () => {
        await expect(loadFeed('javascript:alert(1)')).rejects.toThrow(
            'not allowed',
        );
    });
});
