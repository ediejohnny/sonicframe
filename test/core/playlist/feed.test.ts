/**
 * A podcast feed read as a list of tracks: the show's name and picture, each episode's sound,
 * length, picture, chapters and transcript, newest first (or oldest), with a limit. The feed is
 * outside input: it is read by our own XML reader (no page, no script, no entity declarations),
 * names as text, addresses only http, https or relative, with ceilings on its size and its episodes.
 */

import { describe, expect, it } from 'vite-plus/test';
import { readFeed } from '../../../src/core/playlist/feed';
import { feed, ONE, TWO } from '../../support/feeds';

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

    it('takes the show’s picture from its image element when it has no itunes:image', () => {
        const read = readFeed(
            feed(TWO).replace(
                '<itunes:image href="https://cdn.test/show.jpg"/>',
                '<image><url>https://cdn.test/rss.png</url></image>',
            ),
        );

        expect(read.image).toBe('https://cdn.test/rss.png');
        expect(read.tracks[0].artwork).toBe('https://cdn.test/rss.png');
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

    it('keeps names from the feed as text only, entities and CDATA included', () => {
        const read = readFeed(
            feed(
                `<item><title>&lt;img src=x onerror=alert(1)&gt;</title><enclosure url="https://cdn.test/x.mp3"/></item>
<item><title><![CDATA["><svg onload=alert(2)>]]></title><enclosure url="https://cdn.test/y.mp3"/></item>`,
            ),
        );

        expect(read.tracks.map((track) => track.title)).toEqual([
            '<img src=x onerror=alert(1)>',
            '"><svg onload=alert(2)>',
        ]);
    });

    it('refuses a feed that declares entities, and one that is not a feed', () => {
        const bomb = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]><rss><channel><title>&b;</title></channel></rss>`;

        expect(() => readFeed(bomb)).toThrow('entities');
        expect(() => readFeed('<html><body>no</body></html>')).toThrow(
            'not a podcast feed',
        );
        expect(() => readFeed('<rss><title>no channel</title></rss>')).toThrow(
            'not a podcast feed',
        );
        expect(() => readFeed('<rss><channel>')).toThrow(SyntaxError);
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

    it('reads 5 MB by default, and takes maxSize from 1 KB to 20 MB', () => {
        const sized = (characters: number): string =>
            feed(TWO, `<description>${'x'.repeat(characters)}</description>`);

        expect(readFeed(sized(1100)).tracks).toHaveLength(1);
        expect(() => readFeed(sized(1100), { maxSize: 1024 })).toThrow(
            'too large',
        );
        expect(() => readFeed(sized(5_242_880))).toThrow('too large');
        expect(
            readFeed(sized(5_242_880), { maxSize: 20_971_520 }).tracks,
        ).toHaveLength(1);
        expect(() =>
            readFeed(' '.repeat(20_971_521), { maxSize: 20_971_520 }),
        ).toThrow('too large');
    });

    it('refuses a maxSize past 20 MB or under 1 KB, naming it', () => {
        expect(() => readFeed(feed(TWO), { maxSize: 20_971_521 })).toThrow(
            new RangeError(
                'sonicframe: maxSize goes past its most, 20971520 (20971521)',
            ),
        );
        expect(() => readFeed(feed(TWO), { maxSize: 10 })).toThrow(
            'maxSize goes under its least, 1024',
        );
    });

    it('passes the reader’s ceilings on to it', () => {
        expect(() => readFeed(feed(ONE), { maxElements: 5 })).toThrow(
            'maxElements (5)',
        );
        expect(() => readFeed(feed(ONE), { maxDepth: 2 })).toThrow(
            'maxDepth (2)',
        );
        expect(() => readFeed(feed(ONE), { maxAttributes: 1 })).toThrow(
            'maxAttributes (1)',
        );
        expect(() => readFeed(feed(ONE), { maxNameLength: 5 })).toThrow(
            'maxNameLength (5)',
        );
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
