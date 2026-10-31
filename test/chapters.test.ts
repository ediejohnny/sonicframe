import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    chapterAt,
    chapterEnds,
    loadChapters,
    MAX_CHAPTERS,
    nextChapter,
    readChapters,
    type Chapter,
    type ChaptersFetcher,
} from '../src/core/chapters';

/** A response that streams `text` as UTF-8 in two pieces. */
function respond(
    text: string,
    options: { status?: number; length?: number } = {},
): ChaptersFetcher {
    const bytes = new TextEncoder().encode(text);
    const status = options.status ?? 200;

    return () =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
                get: (name: string) =>
                    name === 'content-length' && options.length !== undefined
                        ? String(options.length)
                        : null,
            },
            body: new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(bytes.slice(0, 5));
                    controller.enqueue(bytes.slice(5));
                    controller.close();
                },
            }),
            arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
        });
}

const starts = (chapters: readonly Chapter[]): number[] =>
    chapters.map((chapter) => chapter.start);
const titles = (chapters: readonly Chapter[]): string[] =>
    chapters.map((chapter) => chapter.title);

describe('readChapters: WebVTT', () => {
    it('reads cues with and without hours, an identifier and a cue without one', () => {
        const chapters = readChapters(
            [
                'WEBVTT - podcast chapters',
                '',
                'intro',
                '00:00.000 --> 01:30.500',
                'Welcome',
                '',
                '01:30.500 --> 1:02:03.250 align:start',
                'The interview',
                '',
                '01:02:03.250 --> 01:10:00.000',
                'Goodbye',
            ].join('\n'),
        );

        expect(chapters).toEqual([
            {
                start: 0,
                end: 90.5,
                title: 'Welcome',
                image: null,
                url: null,
                toc: true,
            },
            {
                start: 90.5,
                end: 3723.25,
                title: 'The interview',
                image: null,
                url: null,
                toc: true,
            },
            {
                start: 3723.25,
                end: 4200,
                title: 'Goodbye',
                image: null,
                url: null,
                toc: true,
            },
        ]);
    });

    it('skips NOTE, STYLE and REGION blocks, and takes CRLF and a byte-order mark', () => {
        const chapters = readChapters(
            String.fromCharCode(0xfeff) +
                'WEBVTT\r\n\r\nNOTE written by hand\r\n00:01.000 --> 00:02.000\r\n\r\n' +
                'STYLE\r\n::cue { color: red }\r\n\r\nREGION\r\nid:fred\r\n\r\n' +
                '00:05.000 --> 00:09.000\r\nOnly cue\r\n',
        );

        expect(titles(chapters)).toEqual(['Only cue']);
        expect(starts(chapters)).toEqual([5]);
    });

    it('joins the lines of a title, drops the tags and decodes the entities after them', () => {
        const [chapter] = readChapters(
            'WEBVTT\n\n00:00.000 --> 00:10.000\n<v Ana><b>Rock</b> &amp; roll\n&lt;b&gt; is &#x41;&#66; &nbsp;fine</v>',
        );

        expect(chapter.title).toBe('Rock & roll <b> is AB fine');
    });

    it('skips a cue whose timing is broken or runs backwards, and keeps the rest', () => {
        const chapters = readChapters(
            [
                'WEBVTT',
                '',
                '00:00.000 --> 00:10.000',
                'Good',
                '',
                '00:61.000 --> 01:10.000',
                'Bad seconds',
                '',
                '00:30.000 --> 00:20.000',
                'Backwards',
                '',
                '5:00.000 --> 06:00.000',
                'Hours without seconds',
                '',
                '00:10:00.0 --> 00:11:00.000',
                'Short fraction',
                '',
                'no timing here',
                'Not a cue',
                '',
                '00:40.000-->00:50.000',
                'Tight arrow',
                '',
                '00:50.000 --> 00:55.000',
                'Title ends',
                '00:51.000 --> 00:52.000',
                'at a timing line',
            ].join('\n'),
        );

        expect(titles(chapters)).toEqual(['Good', 'Tight arrow', 'Title ends']);
    });

    it('cleans a title: one line, no control or bidi characters, at most 120 characters', () => {
        const [chapter] = readChapters(
            `WEBVTT\n\n00:00.000 --> 00:10.000\nA‮b\u0007 ${'x'.repeat(500)}`,
        );

        expect(chapter.title.startsWith('A b x')).toBe(true);
        expect(chapter.title).toHaveLength(120);
    });
});

describe('readChapters: Podcasting 2.0 JSON', () => {
    it('reads start, end, title, image, link and the table-of-contents flag', () => {
        const chapters = readChapters(
            JSON.stringify({
                version: '1.2.0',
                chapters: [
                    {
                        startTime: 0,
                        title: 'Intro',
                        img: 'https://example.com/a.jpg',
                    },
                    {
                        startTime: 62.5,
                        endTime: 120,
                        title: 'Song',
                        url: '/notes#song',
                    },
                    { startTime: 90, title: 'Picture only', toc: false },
                ],
            }),
        );

        expect(chapters).toEqual([
            {
                start: 0,
                end: null,
                title: 'Intro',
                image: 'https://example.com/a.jpg',
                url: null,
                toc: true,
            },
            {
                start: 62.5,
                end: 120,
                title: 'Song',
                image: null,
                url: '/notes#song',
                toc: true,
            },
            {
                start: 90,
                end: null,
                title: 'Picture only',
                image: null,
                url: null,
                toc: false,
            },
        ]);
    });

    it('takes JSON already parsed, sorts it and keeps the first of two equal starts', () => {
        const chapters = readChapters({
            chapters: [
                { startTime: 30, title: 'B' },
                { startTime: 10, title: 'A' },
                { startTime: 30, title: 'B again' },
            ],
        });

        expect(titles(chapters)).toEqual(['A', 'B']);
    });

    it('skips an item without a usable start and drops an unsafe image or link', () => {
        const chapters = readChapters({
            chapters: [
                { title: 'No start' },
                { startTime: -1, title: 'Negative' },
                { startTime: '5', title: 'Text' },
                { startTime: Number.NaN, title: 'NaN' },
                {
                    startTime: 1,
                    title: 'Kept',
                    img: 'javascript:alert(1)',
                    url: '//evil.example/x',
                },
                {
                    startTime: 2,
                    title: 'Data',
                    img: 'data:image/png;base64,AA',
                },
                { startTime: 3, title: 'Slash', url: '\\\\evil.example' },
            ],
        });

        expect(titles(chapters)).toEqual(['Kept', 'Data', 'Slash']);
        expect(chapters.map((chapter) => [chapter.image, chapter.url])).toEqual(
            [
                [null, null],
                [null, null],
                [null, null],
            ],
        );
    });

    it('ignores an end that is not after the start', () => {
        const [chapter] = readChapters({
            chapters: [{ startTime: 10, endTime: 10, title: 'Same' }],
        });

        expect(chapter.end).toBeNull();
    });
});

describe('readChapters: limits and other input', () => {
    it('reads a plain list in its own field names', () => {
        expect(
            readChapters([
                { start: 4, title: 'Two', url: 'https://example.com' },
                { start: 0, end: 4, title: 'One', toc: false },
            ]),
        ).toEqual([
            {
                start: 0,
                end: 4,
                title: 'One',
                image: null,
                url: null,
                toc: false,
            },
            {
                start: 4,
                end: null,
                title: 'Two',
                image: null,
                url: 'https://example.com',
                toc: true,
            },
        ]);
    });

    it('refuses what is neither WebVTT nor JSON chapters', () => {
        expect(() =>
            readChapters('1\n00:00:01,000 --> 00:00:02,000\nSRT'),
        ).toThrow('sonicframe: chapters must be WebVTT or JSON chapters');
        expect(() =>
            readChapters('WEBVTTX\n\n00:00.000 --> 00:01.000\nA'),
        ).toThrow(TypeError);
        expect(() => readChapters({ items: [] })).toThrow(TypeError);
        expect(() => readChapters(42)).toThrow(TypeError);
        expect(() => readChapters('{ not json')).toThrow(TypeError);
    });

    it('refuses a text over 512 KB before reading it', () => {
        expect(() => readChapters(`WEBVTT\n\n${'x'.repeat(524_288)}`)).toThrow(
            RangeError,
        );
    });

    it(`keeps at most ${MAX_CHAPTERS} chapters`, () => {
        const many = Array.from({ length: 1500 }, (_, index) => ({
            start: index,
            title: `C${index}`,
        }));

        expect(readChapters(many)).toHaveLength(1000);
    });

    it('reads back the cues a WebVTT writer wrote, whatever their times and titles', () => {
        /** Our own writer, independent of the reader: h:mm:ss.ttt or mm:ss.ttt. */
        const stamp = (ms: number, hours: boolean): string => {
            const h = Math.floor(ms / 3_600_000);
            const m = Math.floor((ms % 3_600_000) / 60_000);
            const s = Math.floor((ms % 60_000) / 1000);
            const t = ms % 1000;
            const pad = (value: number, size: number): string =>
                String(value).padStart(size, '0');
            const tail = `${pad(m, 2)}:${pad(s, 2)}.${pad(t, 3)}`;

            return hours || h > 0 ? `${pad(h, 2)}:${tail}` : tail;
        };

        fc.assert(
            fc.property(
                fc.uniqueArray(fc.integer({ min: 0, max: 20_000_000 }), {
                    minLength: 1,
                    maxLength: 30,
                }),
                fc.array(
                    fc.stringMatching(
                        /^[A-Za-z0-9][A-Za-z0-9 ]{0,30}[A-Za-z0-9]$/,
                    ),
                    {
                        minLength: 30,
                        maxLength: 30,
                    },
                ),
                fc.boolean(),
                (times, names, hours) => {
                    const sorted = [...times].sort((a, b) => a - b);
                    const cues = sorted.map(
                        (ms, index) =>
                            `${stamp(ms, hours)} --> ${stamp(ms + 500, hours)}\n${names[index]}`,
                    );
                    const chapters = readChapters(
                        `WEBVTT\n\n${cues.join('\n\n')}\n`,
                    );

                    expect(starts(chapters)).toEqual(
                        sorted.map((ms) => ms / 1000),
                    );
                    expect(chapters.map((chapter) => chapter.end)).toEqual(
                        sorted.map((ms) => (ms + 500) / 1000),
                    );
                    expect(titles(chapters)).toEqual(
                        names
                            .slice(0, sorted.length)
                            .map((name) => name.replace(/\s+/g, ' ')),
                    );
                },
            ),
        );
    });
});

describe('where a chapter ends and which one plays', () => {
    const chapters = readChapters([
        { start: 0, title: 'A' },
        { start: 10, end: 15, title: 'B' },
        { start: 20, title: 'C' },
    ]);

    it('ends a chapter at its own end, the next start, or the duration', () => {
        expect(chapterEnds(chapters, 60)).toEqual([10, 15, 60]);
        expect(chapterEnds(chapters, null)).toEqual([10, 15, null]);
        expect(chapterEnds(chapters, 12)).toEqual([10, 12, 12]);
    });

    it('finds the chapter playing, none in a gap, and the next one for a seek landing a hair early', () => {
        expect(chapterAt(chapters, 5, 60)).toBe(0);
        expect(chapterAt(chapters, 17, 60)).toBe(-1);
        expect(chapterAt(chapters, 9.97, 60)).toBe(1);
        expect(chapterAt(chapters, 60, 60)).toBe(2);
        expect(chapterAt(chapters, 600, null)).toBe(2);
        expect(chapterAt([], 5, 60)).toBe(-1);
    });

    it('agrees with a search through every chapter', () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), {
                    minLength: 1,
                    maxLength: 12,
                }),
                fc.array(fc.option(fc.integer({ min: 1, max: 50 })), {
                    minLength: 12,
                    maxLength: 12,
                }),
                fc.option(fc.integer({ min: 1, max: 1100 })),
                fc.double({ min: -5, max: 1200, noNaN: true }),
                (times, lengths, duration, time) => {
                    const sorted = [...times].sort((a, b) => a - b);
                    const list = readChapters(
                        sorted.map((start, index) => ({
                            start,
                            end:
                                lengths[index] === null
                                    ? null
                                    : start + (lengths[index] as number),
                        })),
                    );
                    let expected = -1;

                    sorted.forEach((start, index) => {
                        const own =
                            lengths[index] === null
                                ? null
                                : start + (lengths[index] as number);
                        let end: number | null =
                            own ?? sorted[index + 1] ?? duration ?? null;

                        if (end !== null && duration !== null) {
                            end = Math.min(end, duration);
                        }

                        const last = index === sorted.length - 1;
                        const inside =
                            time >= start - 0.05 &&
                            (end === null ||
                                time < end ||
                                (last && time <= end));

                        if (inside) {
                            expected = index;
                        }
                    });

                    expect(chapterAt(list, time, duration)).toBe(expected);
                },
            ),
        );
    });

    it('steps to the next chapter and, like a previous track, back to the start of this one', () => {
        expect(nextChapter(chapters, 5, 1)).toBe(1);
        expect(nextChapter(chapters, 9.98, 1)).toBe(2);
        expect(nextChapter(chapters, 25, 1)).toBeNull();
        expect(nextChapter(chapters, 25, -1)).toBe(2);
        expect(nextChapter(chapters, 20.5, -1)).toBe(1);
        expect(nextChapter(chapters, 20.5, -1, 0)).toBe(2);
        // Just landed on a start by a back step: the next back step leaves it, even with no grace.
        expect(nextChapter(chapters, 20.02, -1, 0)).toBe(1);
        expect(nextChapter(chapters, 0.5, -1)).toBeNull();
    });
});

describe('loadChapters', () => {
    it('fetches a file and reads it as UTF-8, split across pieces', async () => {
        const chapters = await loadChapters('/a.vtt', {
            fetcher: respond('WEBVTT\n\n00:00.000 --> 00:05.000\nCoração'),
        });

        expect(titles(chapters)).toEqual(['Coração']);
    });

    it('fetches an address once per page unless it is not shared', async () => {
        let calls = 0;
        const fetcher: ChaptersFetcher = (url) => {
            calls++;

            return respond('{"chapters":[{"startTime":0,"title":"A"}]}')(url);
        };

        const [a, b] = await Promise.all([
            loadChapters('/shared.json', { fetcher }),
            loadChapters('/shared.json', { fetcher }),
        ]);
        expect(b).toBe(a);
        expect(calls).toBe(1);

        await loadChapters('/shared.json', { fetcher, shared: false });
        expect(calls).toBe(2);
    });

    it('forgets a failed fetch so it can be tried again', async () => {
        await expect(
            loadChapters('/retry.vtt', {
                fetcher: respond('WEBVTT\n', { status: 404 }),
            }),
        ).rejects.toThrow('sonicframe: chapters request failed (404)');
        await expect(
            loadChapters('/retry.vtt', {
                fetcher: respond('WEBVTT\n\n00:00.000 --> 00:01.000\nA'),
            }),
        ).resolves.toHaveLength(1);
    });

    it('refuses a file announced or grown past maxBytes', async () => {
        await expect(
            loadChapters('/big.vtt', {
                fetcher: respond('WEBVTT\n', { length: 600_000 }),
            }),
        ).rejects.toThrow(RangeError);
        await expect(
            loadChapters('/grown.vtt', {
                fetcher: respond(`WEBVTT\n\n${'x'.repeat(200)}`),
                maxBytes: 100,
            }),
        ).rejects.toThrow('too large');
    });
});
