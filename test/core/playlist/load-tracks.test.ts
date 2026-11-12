/**
 * A list of tracks fetched from an address: an unsafe address is never requested, a failed request
 * and a file past the ceiling are refused, relative addresses in the list point beside it, and the
 * request sends cookies only to the page's own site unless the app says otherwise.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { loadTracks } from '../../../src/core/playlist/load-tracks';
import { serve } from '../../support/responses';

afterEach(() => {
    vi.unstubAllGlobals();
});

const M3U =
    '#EXTM3U\n#EXTINF:61,Ana - One\none.mp3\nhttps://cdn.test/two.mp3\n';

function bytes(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

describe('loadTracks', () => {
    it('reads the list, with its relative addresses pointing beside it', async () => {
        const tracks = await loadTracks('https://site.test/lists/a.m3u', {
            fetcher: serve(bytes(M3U)),
        });

        expect(tracks.map((track) => track.src)).toEqual([
            'https://site.test/lists/one.mp3',
            'https://cdn.test/two.mp3',
        ]);
        expect(tracks[0].title).toBe('One');
        expect(tracks[0].artist).toBe('Ana');
    });

    it('lets the app say where relative addresses point', async () => {
        const tracks = await loadTracks('a.m3u', {
            base: 'https://other.test/x/a.m3u',
            fetcher: serve(bytes(M3U)),
        });

        expect(tracks[0].src).toBe('https://other.test/x/one.mp3');
    });

    it('never requests an address that is not a web address', async () => {
        const fetcher = vi.fn(serve(bytes(M3U)));

        for (const url of [
            'javascript:alert(1)',
            'data:text/plain,x',
            '//evil.test/a.m3u',
            'file:///etc/passwd',
        ]) {
            await expect(loadTracks(url, { fetcher }), url).rejects.toThrow(
                'not allowed',
            );
        }

        expect(fetcher).not.toHaveBeenCalled();
    });

    it('refuses a failed request with its status', async () => {
        await expect(
            loadTracks('https://site.test/a.m3u', {
                fetcher: serve(bytes(M3U), { status: 404 }),
            }),
        ).rejects.toThrow('tracks request failed (404)');
    });

    it('refuses a file past the ceiling the app lowered', async () => {
        await expect(
            loadTracks('https://site.test/a.m3u', {
                fetcher: serve(bytes(M3U)),
                maxBytes: 10,
            }),
        ).rejects.toThrow('too large');
    });

    it('sends cookies only to the page’s own site by default, and as the app says otherwise', async () => {
        const asked: RequestInit[] = [];
        const fetch = vi.fn((_url: string, init: RequestInit) => {
            asked.push(init);

            return serve(bytes(M3U))('');
        });
        vi.stubGlobal('fetch', fetch);
        const stop = new AbortController();

        await loadTracks('https://site.test/a.m3u');
        await loadTracks('https://site.test/a.m3u', {
            credentials: 'include',
            referrerPolicy: 'no-referrer',
            signal: stop.signal,
        });

        expect(asked[0].credentials).toBe('same-origin');
        expect(asked[1]).toMatchObject({
            credentials: 'include',
            referrerPolicy: 'no-referrer',
        });
        expect(asked[1].signal).toBe(stop.signal);
    });
});
