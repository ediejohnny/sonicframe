/**
 * Chapters: Podcasting 2.0 JSON, the limits on what comes in, where each chapter ends and which
 * one plays, and `loadChapters` fetching them with a byte ceiling.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    chapterAt,
    chapterEnds,
    loadChapters,
    MAX_CHAPTERS,
    nextChapter,
    readChapters,
} from '../../../src/core/chapters/chapters';
import type { Fetcher } from '../../../src/core/shared/fetch';
import { serve } from '../../support/responses';
import { starts, titles } from './chapter-fields';

/** A response that streams `text` as UTF-8 in two pieces. */
function respond(
    text: string,
    options: { status?: number; length?: number } = {},
): Fetcher {
    return serve(new TextEncoder().encode(text), options);
}

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

    it('keeps up to 10 000 chapters and reads up to 5 MB when asked, refusing past either by name', () => {
        const many = Array.from({ length: 10_001 }, (_, index) => ({
            start: index,
        }));
        const text = `WEBVTT\n\n${'x'.repeat(524_288)}`;

        expect(readChapters(many, { maxChapters: 10_000 })).toHaveLength(
            10_000,
        );
        expect(readChapters(many, { maxChapters: 3 })).toHaveLength(3);
        expect(readChapters(text, { maxText: 5_242_880 })).toEqual([]);
        expect(() => readChapters(many, { maxChapters: 10_001 })).toThrow(
            new RangeError(
                'sonicframe: maxChapters goes past its most, 10000 (10001)',
            ),
        );
        expect(() => readChapters(text, { maxText: 5_242_881 })).toThrow(
            'maxText goes past its most, 5242880',
        );
        expect(() => readChapters(many, { maxChapters: 0 })).toThrow(
            'maxChapters goes under its least, 1',
        );
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
        const fetcher: Fetcher = (url) => {
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

    it('takes maxBytes up to 5 MB (past it, 5 MB until 2.0), and maxChapters', async () => {
        const big = `WEBVTT\n\n00:00.000 --> 00:01.000\nA\n\n${'x'.repeat(600_000)}`;

        await expect(
            loadChapters('/raised.vtt', {
                fetcher: respond(big),
                maxBytes: 5_242_880,
            }),
        ).resolves.toHaveLength(1);
        await expect(
            loadChapters('/held.vtt', {
                fetcher: respond(big),
                maxBytes: 1e12,
            }),
        ).resolves.toHaveLength(1);
        await expect(
            loadChapters('/held.vtt', {
                fetcher: respond('WEBVTT\n', { length: 5_242_881 }),
                maxBytes: 1e12,
                shared: false,
            }),
        ).rejects.toThrow('too large');

        const two =
            'WEBVTT\n\n00:00.000 --> 00:01.000\nA\n\n00:01.000 --> 00:02.000\nB\n';

        await expect(
            loadChapters('/two.vtt', { fetcher: respond(two), maxChapters: 1 }),
        ).resolves.toHaveLength(1);
    });
});
