/**
 * Chapters: named stretches of a long sound, from the two formats podcasts and players already use,
 * WebVTT (`kind="chapters"`) and the Podcasting 2.0 JSON chapters, or from a plain list. The format
 * comes from the content, never from the address. Everything read is treated as untrusted: a ceiling
 * on the text and the count, titles cleaned to one safe line, and images and links kept only when
 * they are web or relative addresses. Nothing here touches the page.
 */

import { readCapped, type FetchedResponse } from './fetch';
import { positive } from './math';
import { LANDING, stepIndex } from './steps';
import { cleanText } from './text';
import { safeUrl } from './url';

/** One chapter, in seconds. */
export type Chapter = {
    readonly start: number;
    /** Its own end, or null when it runs to the next chapter (or the end of the sound). */
    readonly end: number | null;
    /** One line, at most 120 characters; may be empty. */
    readonly title: string;
    /** A picture for it: a web or relative address, or null. */
    readonly image: string | null;
    /** A page about it: a web or relative address, or null. */
    readonly url: string | null;
    /** Whether it belongs in a table of contents (false marks a chapter that only changes the picture). */
    readonly toc: boolean;
};

/** A chapter as an app writes it, for `readChapters` and the chapters plugin. */
export type ChapterInput = {
    start: number;
    end?: number | null;
    title?: string;
    image?: string | null;
    url?: string | null;
    toc?: boolean;
};

/** The part of `fetch` that `loadChapters` uses, so tests and apps can bring their own. */
export type ChaptersFetcher = (url: string) => Promise<FetchedResponse>;

export type LoadChaptersOptions = {
    /** The same address is fetched once per page. On by default. */
    shared?: boolean;
    /** The app's own `fetch`. */
    fetcher?: ChaptersFetcher;
    /** A larger file is refused. Only lowers 524 288 bytes. */
    maxBytes?: number;
};

/** The most chapters kept. */
export const MAX_CHAPTERS = 1000;

/** The longest chapters text read, in characters (and the largest file fetched, in bytes). */
const MAX_TEXT = 524_288;

/** The longest title, in characters. */
const MAX_TITLE = 120;

function notChapters(): TypeError {
    return new TypeError(
        'sonicframe: chapters must be WebVTT or JSON chapters',
    );
}

function tooLarge(): RangeError {
    return new RangeError('sonicframe: chapters file is too large');
}

/** A time in seconds when it is a finite number from 0 on, otherwise null. */
function startOf(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

function address(value: unknown): string | null {
    return typeof value === 'string' ? safeUrl(value) : null;
}

/** A chapter cleaned from loose fields, or null without a usable start. */
function chapterOf(fields: {
    start: unknown;
    end: unknown;
    title: unknown;
    image: unknown;
    url: unknown;
    toc: unknown;
}): Chapter | null {
    const start = startOf(fields.start);

    if (start === null) {
        return null;
    }

    const end = startOf(fields.end);

    return {
        start,
        end: end !== null && end > start ? end : null,
        title:
            typeof fields.title === 'string'
                ? cleanText(fields.title, MAX_TITLE)
                : '',
        image: address(fields.image),
        url: address(fields.url),
        toc: fields.toc !== false,
    };
}

/** In order of their starts; of two equal starts, the first one written stays. */
function ordered(chapters: Chapter[]): Chapter[] {
    const sorted = [...chapters].sort((a, b) => a.start - b.start);

    return sorted.filter(
        (chapter, index) =>
            index === 0 || chapter.start !== sorted[index - 1].start,
    );
}

/** Up to `MAX_CHAPTERS` usable chapters from a list, read item by item. */
function collect<Item>(
    items: readonly Item[],
    read: (item: Item) => Chapter | null,
): Chapter[] {
    const kept: Chapter[] = [];

    for (const item of items) {
        if (kept.length >= MAX_CHAPTERS) {
            break;
        }

        const chapter =
            typeof item === 'object' && item !== null ? read(item) : null;

        if (chapter !== null) {
            kept.push(chapter);
        }
    }

    return ordered(kept);
}

/**
 * A WebVTT timestamp in seconds, read as the specification's parser reads it, or null: `h:mm:ss.ttt`
 * (hours of any length) or `mm:ss.ttt`, where a first part that is not two digits up to 59 counts
 * as hours and then needs the seconds after it.
 */
function timestamp(text: string): number | null {
    const match = /^(\d+):(\d{2})(?::(\d{2}))?\.(\d{3})$/.exec(text);

    if (match === null) {
        return null;
    }

    const [, first, second, third, thousandths] = match;
    const hoursFirst = first.length !== 2 || Number(first) > 59;

    if (hoursFirst && third === undefined) {
        return null;
    }

    const [hours, minutes, seconds] =
        third === undefined
            ? [0, Number(first), Number(second)]
            : [Number(first), Number(second), Number(third)];

    if (minutes > 59 || seconds > 59) {
        return null;
    }

    // Counted in whole thousandths and divided once, the time is the nearest number to the one
    // written; adding the thousandths to the seconds would leave float noise (1.5030000000000001).
    const thousandthsInAll =
        ((hours * 60 + minutes) * 60 + seconds) * 1000 + Number(thousandths);

    return thousandthsInAll / 1000;
}

const ENTITIES: Readonly<Record<string, string>> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    lrm: '‎',
    rlm: '‏',
};

/** A code point as text, or the replacement character when it is not a character. */
function character(code: number): string {
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code)
        : '�';
}

/** A cue's text without its tags, with its character references decoded (after, so `&lt;b&gt;` stays text). */
function cueText(lines: readonly string[]): string {
    return lines
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .replace(
            /&(?:#x([0-9a-f]{1,6})|#(\d{1,7})|([a-z]+));/gi,
            (whole, hex?: string, decimal?: string, name?: string) => {
                if (hex !== undefined) {
                    return character(parseInt(hex, 16));
                }

                if (decimal !== undefined) {
                    return character(Number(decimal));
                }

                return ENTITIES[(name ?? '').toLowerCase()] ?? whole;
            },
        );
}

/** A timing line: two timestamps around an arrow, then any cue settings. */
const TIMING = /^[ \t]*([\d:.]+)[ \t]*-->[ \t]*([\d:.]+)(?:[ \t].*)?$/;

/** A block that is no cue: a comment, a style sheet or a region. */
const NOT_A_CUE = /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/;

function readVtt(text: string): Chapter[] {
    const blocks = text.split(/\n{2,}/);
    const cues: { start: number; end: number; title: string }[] = [];

    // The first block is the header (`WEBVTT` and anything after it on its lines).
    for (const block of blocks.slice(1)) {
        const lines = block.split('\n');

        if (NOT_A_CUE.test(lines[0])) {
            continue;
        }

        // An identifier may come first; the timing line is the first or the second.
        const at = lines[0].includes('-->') ? 0 : 1;
        const timing = TIMING.exec(lines[at] ?? '');

        if (timing === null) {
            continue;
        }

        const start = timestamp(timing[1]);
        const end = timestamp(timing[2]);

        if (start === null || end === null || end <= start) {
            continue;
        }

        const payload: string[] = [];

        for (const line of lines.slice(at + 1)) {
            if (line.includes('-->')) {
                break;
            }

            payload.push(line);
        }

        cues.push({ start, end, title: cueText(payload) });
    }

    return collect(cues, (cue) =>
        chapterOf({ ...cue, image: null, url: null, toc: true }),
    );
}

/** The Podcasting 2.0 chapters: `{ chapters: [{ startTime, endTime, title, img, url, toc }] }`. */
function readJson(value: unknown): Chapter[] {
    const list: unknown =
        typeof value === 'object' && value !== null
            ? (value as { chapters?: unknown }).chapters
            : undefined;

    if (!Array.isArray(list)) {
        throw notChapters();
    }

    return collect(list as Record<string, unknown>[], (item) =>
        chapterOf({
            start: item.startTime,
            end: item.endTime,
            title: item.title,
            image: item.img,
            url: item.url,
            toc: item.toc,
        }),
    );
}

/**
 * Reads chapters from WebVTT text, Podcasting 2.0 JSON (as text or already parsed) or a list of
 * `ChapterInput`. They come back in order of their starts, at most `MAX_CHAPTERS`, with a cue or an
 * item that has no usable start (or a WebVTT cue that ends before it starts) left out. Anything
 * else throws a `TypeError`; a text over 512 KB throws a `RangeError`.
 */
export function readChapters(input: unknown): Chapter[] {
    if (Array.isArray(input)) {
        return collect(input as ChapterInput[], (item) =>
            chapterOf({
                start: item.start,
                end: item.end,
                title: item.title,
                image: item.image,
                url: item.url,
                toc: item.toc,
            }),
        );
    }

    if (typeof input !== 'string') {
        return readJson(input);
    }

    if (input.length > MAX_TEXT) {
        throw tooLarge();
    }

    // A byte-order mark (U+FEFF) may open the file.
    const text = (
        input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
    ).replace(/\r\n?/g, '\n');

    if (/^WEBVTT(?:[ \t\n]|$)/.test(text)) {
        return readVtt(text);
    }

    if (!text.trimStart().startsWith('{')) {
        throw notChapters();
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(text);
    } catch {
        throw notChapters();
    }

    return readJson(parsed);
}

/**
 * Where each chapter ends, in seconds: its own end, otherwise the next chapter's start, otherwise
 * the duration; never after the duration when it is known, and null when nothing tells.
 */
export function chapterEnds(
    chapters: readonly Chapter[],
    duration: number | null,
): (number | null)[] {
    const known = positive(duration);

    return chapters.map((chapter, index) => {
        const end = chapter.end ?? chapters[index + 1]?.start ?? known;

        return end !== null && known !== null ? Math.min(end, known) : end;
    });
}

/**
 * The index of the chapter playing at `time`, or -1 before the first one or in a gap between two.
 * A time up to `LANDING` before a chapter's start is in it already (a seek to that start can land a
 * hair early), and the last chapter keeps its own end.
 */
export function chapterAt(
    chapters: readonly Chapter[],
    time: number,
    duration: number | null = null,
): number {
    const ends = chapterEnds(chapters, duration);

    for (let index = chapters.length - 1; index >= 0; index--) {
        const end = ends[index];
        const last = index === chapters.length - 1;

        if (
            time >= chapters[index].start - LANDING &&
            (end === null || time < end || (last && time <= end))
        ) {
            return index;
        }
    }

    return -1;
}

/**
 * The chapter a step from `time` lands on, or null when there is none: forward, the next one to
 * start; back, like a previous track, the start of the current one once more than `grace` seconds
 * into it, otherwise the one before.
 */
export function nextChapter(
    chapters: readonly Chapter[],
    time: number,
    direction: 1 | -1,
    grace: number = 1,
): number | null {
    return stepIndex(
        chapters.map((chapter) => chapter.start),
        time,
        direction,
        grace,
    );
}

const loading = new Map<string, Promise<Chapter[]>>();

/**
 * Fetches a chapters file and reads it (see `readChapters`), as UTF-8. Unless `shared` is false, an
 * address is fetched once per page however many players show it; a failed fetch is forgotten, so it
 * can be tried again.
 */
export function loadChapters(
    url: string,
    options: LoadChaptersOptions = {},
): Promise<Chapter[]> {
    const asked = options.maxBytes;
    const maxBytes =
        typeof asked === 'number' && Number.isFinite(asked)
            ? Math.min(MAX_TEXT, Math.max(1, Math.floor(asked)))
            : MAX_TEXT;
    const fetcher = options.fetcher ?? ((address: string) => fetch(address));
    const load = (): Promise<Chapter[]> =>
        fetcher(url).then(async (response) => {
            if (!response.ok) {
                throw new Error(
                    `sonicframe: chapters request failed (${response.status})`,
                );
            }

            const bytes = await readCapped(response, maxBytes, tooLarge);

            return readChapters(new TextDecoder('utf-8').decode(bytes));
        });

    if (options.shared === false) {
        return load();
    }

    const key = JSON.stringify([url, maxBytes]);
    let pending = loading.get(key);

    if (!pending) {
        pending = load();
        pending.catch(() => loading.delete(key));
        loading.set(key, pending);
    }

    return pending;
}
