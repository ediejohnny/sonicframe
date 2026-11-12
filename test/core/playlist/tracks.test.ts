/**
 * The tracks of a list, read from a list, SonicFrame's JSON or an M3U, and written back: every field
 * cleaned, every address checked, the counts and the text capped, and nothing a hostile list holds
 * ever reaching beyond its own track.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    MAX_TRACKS,
    readTracks,
    writeTracks,
    type Track,
} from '../../../src/core/playlist/tracks';

/** A track as `readTracks` gives one with only an address. */
function bare(src: string): Track {
    return {
        src,
        title: '',
        artist: '',
        album: '',
        artwork: null,
        peaks: null,
        duration: null,
        chapters: null,
        transcript: null,
        id: src,
    };
}

/** A track with every field, written by hand: what goes in, and what each reader and writer keeps. */
const FULL = {
    src: 'https://cdn.example/ep1.mp3',
    title: 'Episode 1',
    artist: 'Ana',
    album: 'Talks',
    artwork: '/covers/1.jpg',
    peaks: '/peaks/1.dat',
    duration: 1800.5,
    chapters: '/chapters/1.vtt',
    transcript: '/text/1.vtt',
    id: 'ep-1',
} as const;

describe('readTracks from a list', () => {
    it('keeps every field given, and names a track by its address when it has no id', () => {
        const [full, plain] = readTracks([{ ...FULL }, { src: 'ep2.mp3' }]);

        expect(full).toEqual(FULL);
        expect(plain).toEqual(bare('ep2.mp3'));
    });

    it('takes peaks as numbers, and none that are not all finite numbers', () => {
        const [numbers, broken, empty] = readTracks([
            { src: 'a.mp3', peaks: [0, 0.5, 1] },
            { src: 'b.mp3', peaks: [0, Number.NaN] },
            { src: 'c.mp3', peaks: [] },
        ]);

        expect(numbers.peaks).toEqual([0, 0.5, 1]);
        expect(broken.peaks).toBeNull();
        expect(empty.peaks).toBeNull();
        // -0 is read as 0, as JSON writes it, so a list written and read back stays the same.
        expect(
            Object.is(
                readTracks([{ src: 'a.mp3', peaks: [-0] }])[0].peaks?.[0],
                0,
            ),
        ).toBe(true);
    });

    it('keeps a length only when it is a number above zero', () => {
        const lengths = readTracks(
            [12, 0, -3, Number.NaN, Number.POSITIVE_INFINITY, '30'].map(
                (duration) => ({ src: 'a.mp3', duration }) as never,
            ),
        ).map((track) => track.duration);

        expect(lengths).toEqual([12, null, null, null, null, null]);
    });

    it('cleans every name to one safe line of at most 120 characters', () => {
        const [track] = readTracks([
            {
                src: 'a.mp3',
                title: '  Line one\nline‮two\u0000 ',
                artist: 'x'.repeat(500),
                id: 'id\twith\ttabs',
            },
        ]);

        expect(track.title).toBe('Line one line two');
        expect(track.artist).toBe('x'.repeat(120));
        expect(track.id).toBe('id with tabs');
    });
});

describe('readTracks against a hostile list', () => {
    it('leaves out a track whose address is no web address', () => {
        const kept = readTracks(
            [
                'javascript:alert(1)',
                'JAVASCRIPT:alert(1)',
                'data:audio/mp3;base64,AAAA',
                'vbscript:msgbox(1)',
                '//evil.example/a.mp3',
                '/\\evil.example/a.mp3',
                'a b.mp3',
                '#fragment',
                '',
                'https://ok.example/a.mp3',
            ].map((src) => ({ src })),
        );

        expect(kept.map((track) => track.src)).toEqual([
            'https://ok.example/a.mp3',
        ]);
    });

    it('drops a picture, peaks, chapters or transcript that is no web address, and keeps the track', () => {
        const [track] = readTracks([
            {
                src: 'a.mp3',
                artwork: 'javascript:alert(1)',
                peaks: 'data:text/plain,1',
                chapters: '//evil.example/c.vtt',
                transcript: 'vbscript:x',
            },
        ]);

        expect(track).toEqual(bare('a.mp3'));
    });

    it('keeps markup in a name as plain text, for the page to write as text', () => {
        const markup = '<img src=x onerror=alert(1)>"><svg onload=alert(1)>';
        const [track] = readTracks([{ src: 'a.mp3', title: markup }]);

        expect(track.title).toBe(markup);
    });

    it('never lets a list reach beyond its own tracks through __proto__ or constructor', () => {
        const tracks = readTracks(
            '{"tracks":[{"src":"a.mp3","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}],"__proto__":{"polluted":"yes"}}',
        );

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.keys(tracks[0]).sort()).toEqual(
            Object.keys(bare('a.mp3')).sort(),
        );
        expect(tracks[0].id).toBe('a.mp3');
    });

    it('keeps at most 1000 tracks, and refuses a text over 512 KB', () => {
        const many = Array.from({ length: MAX_TRACKS + 5 }, (_, at) => ({
            src: `t${at}.mp3`,
        }));

        expect(readTracks(many)).toHaveLength(1000);
        expect(() => readTracks('#EXTM3U\n' + 'a'.repeat(524_288))).toThrow(
            RangeError,
        );
    });

    it('reads a hostile M3U of the largest size in well under a second', () => {
        const lines = [
            `#EXTINF:${'1'.repeat(200_000)}`,
            `#EXTINF:1${' '.repeat(200_000)}x`,
            `#EXTART:${'-'.repeat(100_000)}`,
        ].join('\n');
        const started = performance.now();

        readTracks(lines.slice(0, 524_288));

        expect(performance.now() - started).toBeLessThan(1000);
    });

    it('refuses what is no list of tracks', () => {
        for (const input of [
            42,
            null,
            '{"tracks": "a.mp3"}',
            '{not json',
            '   ',
            { songs: [] },
        ]) {
            expect(() => readTracks(input), JSON.stringify(input)).toThrow(
                TypeError,
            );
        }
    });
});

describe('readTracks from text', () => {
    it("reads SonicFrame's JSON as text or parsed, with tracks or as a bare list", () => {
        const expected = [bare('a.mp3'), bare('b.mp3')];

        expect(
            readTracks('{"tracks":[{"src":"a.mp3"},{"src":"b.mp3"}]}'),
        ).toEqual(expected);
        expect(readTracks('﻿[{"src":"a.mp3"},{"src":"b.mp3"}]')).toEqual(
            expected,
        );
        expect(
            readTracks({ tracks: [{ src: 'a.mp3' }, { src: 'b.mp3' }] }),
        ).toEqual(expected);
    });

    it('reads an M3U: the length, "Artist - Title", the album and picture lines, and skips comments', () => {
        const tracks = readTracks(
            [
                '#EXTM3U',
                '# a comment',
                '#EXTINF:215,Ana Lua - Night Drive',
                '#EXTALB:Roads',
                '#EXTIMG:https://cdn.example/roads.jpg',
                'https://cdn.example/night.mp3',
                '',
                '#EXTINF:-1,Just a title',
                'b.mp3',
                'c.mp3',
            ].join('\r\n'),
        );

        expect(tracks).toEqual([
            {
                ...bare('https://cdn.example/night.mp3'),
                title: 'Night Drive',
                artist: 'Ana Lua',
                album: 'Roads',
                artwork: 'https://cdn.example/roads.jpg',
                duration: 215,
            },
            { ...bare('b.mp3'), title: 'Just a title' },
            bare('c.mp3'),
        ]);
    });

    it('skips an #EXTINF line without the comma before its text, or without its length', () => {
        const tracks = readTracks(
            '#EXTM3U\n#EXTINF:12 Ana - Song\na.mp3\n#EXTINF:,Ana - Song\nb.mp3\n',
        );

        expect(tracks).toEqual([bare('a.mp3'), bare('b.mp3')]);
    });

    it('takes the whole #EXTINF text as the title when #EXTART names the artist', () => {
        const [track] = readTracks(
            '#EXTM3U\n#EXTINF:10,Live - Part 1 - Encore\n#EXTART:Ana\na.mp3\n',
        );

        expect(track).toMatchObject({
            title: 'Live - Part 1 - Encore',
            artist: 'Ana',
        });
    });

    it('points the relative addresses of a list beside it, and checks them again', () => {
        const tracks = readTracks(
            '#EXTM3U\n#EXTIMG:../covers/a.jpg\nep1.mp3\nhttps://other.example/ep2.mp3\n',
            { base: 'https://cdn.example/shows/list.m3u' },
        );

        expect(tracks.map((track) => [track.src, track.artwork])).toEqual([
            [
                'https://cdn.example/shows/ep1.mp3',
                'https://cdn.example/covers/a.jpg',
            ],
            ['https://other.example/ep2.mp3', null],
        ]);
        // A base that is no web address gives no web address either: an address resolved beside a
        // file on the disk is a file address, refused like any other.
        expect(
            readTracks('ep1.mp3', { base: 'javascript:alert(1)//' }),
        ).toEqual([]);
        expect(
            readTracks('ep1.mp3', { base: 'file:///C:/music/list.m3u' }),
        ).toEqual([]);
    });
});

describe('writeTracks', () => {
    const tracks = readTracks([{ ...FULL }, { src: 'ep2.mp3' }]);

    it('writes M3U with the length, title, artist, album and picture of each track', () => {
        expect(writeTracks(tracks, 'm3u')).toBe(
            [
                '#EXTM3U',
                '#EXTINF:1800.5,Episode 1',
                '#EXTART:Ana',
                '#EXTALB:Talks',
                '#EXTIMG:/covers/1.jpg',
                'https://cdn.example/ep1.mp3',
                '#EXTINF:-1,',
                '#EXTART:',
                'ep2.mp3',
                '',
            ].join('\n'),
        );
    });

    it('writes JSON with only what each track has', () => {
        expect(JSON.parse(writeTracks(tracks))).toEqual({
            tracks: [FULL, { src: 'ep2.mp3' }],
        });
    });

    it('never lets a track built by hand break a line of the file or carry a refused address', () => {
        const handmade = [
            {
                ...bare('a.mp3'),
                title: 'Nice\n#EXTINF:1,Injected\nhttps://evil.example/x.mp3',
            },
            bare('javascript:alert(1)'),
            { ...bare('b.mp3'), duration: 1e21 },
        ];
        const m3u = writeTracks(handmade, 'm3u');

        expect(m3u.split('\n')).toEqual([
            '#EXTM3U',
            '#EXTINF:-1,Nice #EXTINF:1,Injected https://evil.example/x.mp3',
            '#EXTART:',
            'a.mp3',
            '#EXTINF:-1,',
            '#EXTART:',
            'b.mp3',
            '',
        ]);
        expect(readTracks(m3u).map((track) => track.src)).toEqual([
            'a.mp3',
            'b.mp3',
        ]);
    });
});

describe('writing and reading back', () => {
    /** Loose track inputs, with names that may hold anything and lengths of any size. */
    const inputs = fc.array(
        fc.record(
            {
                src: fc.stringMatching(/^[a-z0-9][a-z0-9/._-]{0,30}$/),
                title: fc.string({ maxLength: 40 }),
                artist: fc.string({ maxLength: 40 }),
                album: fc.string({ maxLength: 40 }),
                artwork: fc.stringMatching(/^[a-z0-9][a-z0-9/._-]{0,30}$/),
                duration: fc.double({ min: 0, max: 1e25, noNaN: true }),
                peaks: fc.array(
                    fc.double({ noNaN: true, noDefaultInfinity: true }),
                    {
                        minLength: 1,
                        maxLength: 5,
                    },
                ),
                id: fc.string({ maxLength: 20 }),
            },
            { requiredKeys: ['src'] },
        ),
        { maxLength: 8 },
    );

    it('reads back from JSON exactly the tracks it wrote', () => {
        fc.assert(
            fc.property(inputs, (list) => {
                const tracks = readTracks(list);

                expect(readTracks(writeTracks(tracks, 'json'))).toEqual(tracks);
            }),
        );
    });

    it('reads back from M3U the address, names, picture and length it wrote', () => {
        fc.assert(
            fc.property(inputs, (list) => {
                const tracks = readTracks(list);
                const kept = (track: Track): unknown => ({
                    src: track.src,
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    artwork: track.artwork,
                    // Plain digits only: a length that would need an exponent is written as unknown.
                    duration:
                        track.duration !== null &&
                        !/e/i.test(String(track.duration))
                            ? track.duration
                            : null,
                });

                expect(
                    readTracks(writeTracks(tracks, 'm3u')).map(kept),
                ).toEqual(tracks.map(kept));
            }),
        );
    });
});
