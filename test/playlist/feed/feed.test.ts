/**
 * A podcast feed read as a list of tracks: the show's name and picture, each episode's sound,
 * length, picture, chapters and transcript, newest first (or oldest), with a limit. The feed is
 * outside input: it is read as XML (no script, no entity declarations), names as text, addresses
 * only http, https or relative, with ceilings on its size and its episodes.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineSonicPlaylist, loadFeed, readFeed } from '../../../src/playlist';
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

function feed(items: string, channel = ''): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
<title>The Show</title>
<itunes:author>Ana</itunes:author>
<itunes:image href="https://cdn.test/show.jpg"/>
${channel}
${items}
</channel>
</rss>`;
}

const ONE = `<item>
<title>Pilot</title>
<guid>ep-1</guid>
<pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate>
<enclosure url="https://cdn.test/ep1.mp3" type="audio/mpeg" length="1"/>
<itunes:duration>1:02:03</itunes:duration>
<itunes:image href="https://cdn.test/ep1.jpg"/>
<podcast:chapters url="https://cdn.test/ep1.json" type="application/json+chapters"/>
<podcast:transcript url="https://cdn.test/ep1.vtt" type="text/vtt"/>
</item>`;

const TWO = `<item>
<title>Second</title>
<pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate>
<enclosure url="ep2.mp3" type="audio/mpeg"/>
<itunes:duration>754</itunes:duration>
</item>`;

describe('readFeed', () => {
    it('reads the show and each episode, newest first', () => {
        const read = readFeed(feed(ONE + TWO), {
            base: 'https://site.test/feeds/show.xml',
        });

        expect(read.title).toBe('The Show');
        expect(read.image).toBe('https://cdn.test/show.jpg');
        expect(read.tracks.map((track) => track.title)).toEqual([
            'Second',
            'Pilot',
        ]);

        const [second, pilot] = read.tracks;

        expect(second.src).toBe('https://site.test/feeds/ep2.mp3');
        expect(second.duration).toBe(754);
        expect(second.artwork).toBe('https://cdn.test/show.jpg');
        expect(pilot).toMatchObject({
            src: 'https://cdn.test/ep1.mp3',
            artist: 'Ana',
            album: 'The Show',
            artwork: 'https://cdn.test/ep1.jpg',
            duration: 3723,
            chapters: 'https://cdn.test/ep1.json',
            transcript: 'https://cdn.test/ep1.vtt',
            id: 'ep-1',
        });
    });

    it('gives the oldest first, and at most the limit', () => {
        const read = readFeed(feed(ONE + TWO), { order: 'oldest', limit: 1 });

        expect(read.tracks.map((track) => track.title)).toEqual(['Pilot']);
    });

    it('leaves out an episode without a sound, or with one that is not a web address', () => {
        const read = readFeed(
            feed(
                `<item><title>None</title></item>
<item><title>Bad</title><enclosure url="javascript:alert(1)"/></item>
<item><title>Data</title><enclosure url="data:audio/mpeg,x"/></item>` + TWO,
            ),
        );

        expect(read.tracks.map((track) => track.title)).toEqual(['Second']);
    });

    it('keeps names from the feed as text only', () => {
        const read = readFeed(
            feed(
                `<item><title>&lt;img src=x onerror=alert(1)&gt;</title><enclosure url="https://cdn.test/x.mp3"/></item>`,
            ),
        );

        expect(read.tracks[0].title).toBe('<img src=x onerror=alert(1)>');
    });

    it('refuses a feed that declares entities, and one that is not a feed', () => {
        const bomb = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]><rss><channel><title>&b;</title></channel></rss>`;

        expect(() => readFeed(bomb)).toThrow('entities');
        expect(() => readFeed('<html><body>no</body></html>')).toThrow(
            'not a podcast feed',
        );
        expect(() => readFeed('<rss><channel>')).toThrow();
    });

    it('refuses a feed past the size ceiling, and keeps at most 1000 episodes', () => {
        expect(() => readFeed(' '.repeat(5_242_881))).toThrow('too large');

        const many = Array.from(
            { length: 1005 },
            (_, at) =>
                `<item><title>E${at}</title><enclosure url="https://cdn.test/${at}.mp3"/></item>`,
        ).join('');

        expect(readFeed(feed(many)).tracks).toHaveLength(1000);
    });

    it('never takes a picture of the show that is not a web address', () => {
        const read = readFeed(
            feed(TWO).replace(
                'https://cdn.test/show.jpg',
                'javascript:alert(1)',
            ),
        );

        expect(read.image).toBeNull();
        expect(read.tracks[0].artwork).toBeNull();
    });

    it('reads a strange duration as unknown', () => {
        const read = readFeed(
            feed(
                `<item><title>A</title><enclosure url="https://cdn.test/a.mp3"/><itunes:duration>1:02:03:04</itunes:duration></item>`,
            ),
        );

        expect(read.tracks[0].duration).toBeNull();
    });
});

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

    it('never fetches a feed address that is not a web address', async () => {
        await expect(loadFeed('javascript:alert(1)')).rejects.toThrow(
            'not allowed',
        );
    });
});
