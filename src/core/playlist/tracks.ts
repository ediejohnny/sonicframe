/**
 * The tracks of a list, read from what an app hands over (a list of `TrackInput`, the JSON SonicFrame
 * writes, or an M3U/M3U8 playlist) and written back as JSON or M3U. Everything is outside input: the
 * text is capped before it is read, every address passes `safeUrl`, every name is cleaned to one safe
 * line, and the counts are capped. A track without a usable address is left out.
 */

import { cleanText } from '../shared/text';
import { safeUrl } from '../shared/url';
import { textLines } from '../shared/vtt';

/** One track of a list. Empty text and null mean "not given". */
export type Track = {
    /** The sound's address. */
    readonly src: string;
    readonly title: string;
    readonly artist: string;
    readonly album: string;
    /** A picture's address. */
    readonly artwork: string | null;
    /** The peaks: a waveform file's address (`.dat` or JSON) or the numbers themselves. */
    readonly peaks: string | readonly number[] | null;
    /** In seconds, above zero. */
    readonly duration: number | null;
    /** A chapters file's address (WebVTT or Podcasting 2.0 JSON). */
    readonly chapters: string | null;
    /** A transcript file's address. */
    readonly transcript: string | null;
    /** The app's own name for the track; its address when none is given. */
    readonly id: string;
};

/** A track as an app writes it, for `readTracks` and the playlist. */
export type TrackInput = {
    src: string;
    title?: string;
    artist?: string;
    album?: string;
    artwork?: string;
    peaks?: string | readonly number[];
    duration?: number;
    chapters?: string;
    transcript?: string;
    id?: string;
};

/** What `readTracks` reads besides the input. */
export type ReadTracksOptions = {
    /**
     * The address the list came from, so the relative addresses in it (an M3U's, say) point beside
     * it. Left out, relative addresses stay as they are, relative to the page.
     */
    base?: string;
};

/** The formats `writeTracks` writes. */
export type TracksFormat = 'json' | 'm3u';

/** The most tracks kept. */
export const MAX_TRACKS = 1000;

/** The longest list text read, in characters (512 KB). */
const MAX_TEXT = 524_288;

/** The longest title, artist, album or id, in characters. */
const MAX_NAME = 120;

/** The most peaks one track carries as numbers. */
const MAX_PEAKS = 1_000_000;

function notTracks(): TypeError {
    return new TypeError('sonicframe: not a list of tracks');
}

function tooLarge(): RangeError {
    return new RangeError('sonicframe: list of tracks is too large');
}

/** A text field cleaned to one safe line, or empty. */
function name(value: unknown): string {
    return typeof value === 'string' ? cleanText(value, MAX_NAME) : '';
}

/** An address that passes `safeUrl`, pointing beside `base` when it is relative and a base is given. */
function address(value: unknown, base: string | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const checked = safeUrl(value.trim());

    if (
        checked === null ||
        base === undefined ||
        /^[a-z][a-z0-9+.-]*:/i.test(checked)
    ) {
        return checked;
    }

    try {
        // Resolved, the address is checked again: the base itself may be anything.
        return safeUrl(new URL(checked, base).href);
    } catch {
        return null;
    }
}

/** A length in seconds above zero, or null. */
function seconds(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null;
}

/** Peaks as an address or a list of finite numbers (at most `MAX_PEAKS`), or null. */
function peaksOf(
    value: unknown,
    base: string | undefined,
): string | readonly number[] | null {
    if (typeof value === 'string') {
        return address(value, base);
    }

    if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= MAX_PEAKS &&
        value.every((peak) => typeof peak === 'number' && Number.isFinite(peak))
    ) {
        // -0 becomes 0, as JSON writes it, so a list written and read back is the same.
        return Object.freeze((value as number[]).map((peak) => peak + 0));
    }

    return null;
}

/**
 * A track from loose fields, or null without a usable address. An address that is only a fragment
 * (`#…`) names no sound, and an M3U would read it as a comment.
 */
function trackOf(
    fields: Readonly<Record<string, unknown>>,
    base: string | undefined,
): Track | null {
    const src = address(fields.src, base);

    if (src === null || src.startsWith('#')) {
        return null;
    }

    return Object.freeze({
        src,
        title: name(fields.title),
        artist: name(fields.artist),
        album: name(fields.album),
        artwork: address(fields.artwork, base),
        peaks: peaksOf(fields.peaks, base),
        duration: seconds(fields.duration),
        chapters: address(fields.chapters, base),
        transcript: address(fields.transcript, base),
        id: name(fields.id) || src,
    });
}

/** Up to `MAX_TRACKS` usable tracks from a list, read item by item. */
function collect(items: readonly unknown[], base: string | undefined): Track[] {
    const tracks: Track[] = [];

    for (const item of items) {
        if (tracks.length === MAX_TRACKS) {
            break;
        }

        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            const track = trackOf(item as Record<string, unknown>, base);

            if (track !== null) {
                tracks.push(track);
            }
        }
    }

    return tracks;
}

/** The tracks of parsed JSON: a list, or `{ tracks: [...] }`. */
function readJson(value: unknown, base: string | undefined): Track[] {
    if (Array.isArray(value)) {
        return collect(value, base);
    }

    if (typeof value === 'object' && value !== null) {
        const list = (value as { tracks?: unknown }).tracks;

        if (Array.isArray(list)) {
            return collect(list, base);
        }
    }

    throw notTracks();
}

/** An `#EXTINF` line's start, before `<seconds>[ attributes],<text>`. */
const EXTINF = '#EXTINF:';

/** The seconds at the start of an `#EXTINF` head; -1 means unknown. */
const SECONDS = /^-?\d+(?:\.\d+)?/;

/**
 * An `#EXTINF` line read as its length and its text, or null for another line. It is cut at its first
 * comma rather than matched whole: a pattern over the whole line would let a long line with no comma
 * take time that grows with its square (ReDoS).
 */
function extinf(line: string): { duration: number; info: string } | null {
    if (line.slice(0, EXTINF.length).toUpperCase() !== EXTINF) {
        return null;
    }

    const rest = line.slice(EXTINF.length);
    const comma = rest.indexOf(',');
    const seconds = SECONDS.exec(rest.trimStart());

    if (comma < 0 || seconds === null) {
        return null;
    }

    return { duration: Number(seconds[0]), info: rest.slice(comma + 1).trim() };
}

/** The extended M3U lines this reader knows besides `#EXTINF`. */
const EXTRA = /^#(EXTART|EXTALB|EXTIMG):(.*)$/i;

/**
 * The tracks of an M3U/M3U8 text whose lines end in `\n`: each address line is a track, with the
 * `#EXTINF` (length, then `Artist - Title`), `#EXTART`, `#EXTALB` and `#EXTIMG` lines before it. When
 * `#EXTART` names the artist, the `#EXTINF` text is the whole title.
 */
function readM3u(text: string, base: string | undefined): Track[] {
    const items: Record<string, unknown>[] = [];
    let pending: Record<string, unknown> = {};

    for (const raw of text.split('\n')) {
        const line = raw.trim();

        if (line === '') {
            continue;
        }

        const info = extinf(line);

        if (info !== null) {
            pending.duration = info.duration;
            pending.info = info.info;
            continue;
        }

        const extra = EXTRA.exec(line);

        if (extra !== null) {
            const key = extra[1].toUpperCase();
            const value = extra[2].trim();

            if (key === 'EXTART') {
                pending.artist = value;
            } else if (key === 'EXTALB') {
                pending.album = value;
            } else {
                pending.artwork = value;
            }

            continue;
        }

        if (line.startsWith('#')) {
            continue;
        }

        items.push({ ...titled(pending), src: line });
        pending = {};

        if (items.length === MAX_TRACKS) {
            break;
        }
    }

    return collect(items, base);
}

/** The `#EXTINF` text as the title, split as `Artist - Title` unless `#EXTART` named the artist. */
function titled(
    pending: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
    const { info, ...rest } = pending;

    if (typeof info !== 'string') {
        return rest;
    }

    if (rest.artist !== undefined) {
        return { ...rest, title: info };
    }

    const cut = info.indexOf(' - ');

    return cut > 0
        ? { ...rest, artist: info.slice(0, cut), title: info.slice(cut + 3) }
        : { ...rest, title: info };
}

/**
 * Reads tracks from a list of `TrackInput`, SonicFrame's JSON (`{ tracks: [...] }` or a list, as text
 * or already parsed) or an M3U/M3U8 text. They come back in the order written, at most
 * `MAX_TRACKS`, each one cleaned (see `Track`); one without a usable address is left out. Anything
 * else throws a `TypeError`; a text over 512 KB throws a `RangeError`.
 */
export function readTracks(
    input: unknown,
    options: ReadTracksOptions = {},
): Track[] {
    const base = typeof options.base === 'string' ? options.base : undefined;

    if (typeof input !== 'string') {
        return readJson(input, base);
    }

    if (input.length > MAX_TEXT) {
        throw tooLarge();
    }

    const text = textLines(input).trim();

    if (text.startsWith('{') || text.startsWith('[')) {
        let parsed: unknown;

        try {
            parsed = JSON.parse(text);
        } catch {
            throw notTracks();
        }

        return readJson(parsed, base);
    }

    if (text === '') {
        throw notTracks();
    }

    return readM3u(text, base);
}

/** A track as SonicFrame's JSON writes it: only what is given. */
function jsonTrack(track: Track): Record<string, unknown> {
    const out: Record<string, unknown> = { src: track.src };

    for (const key of ['title', 'artist', 'album'] as const) {
        if (track[key] !== '') {
            out[key] = track[key];
        }
    }

    for (const key of [
        'artwork',
        'peaks',
        'duration',
        'chapters',
        'transcript',
    ] as const) {
        if (track[key] !== null) {
            out[key] = track[key];
        }
    }

    if (track.id !== track.src) {
        out.id = track.id;
    }

    return out;
}

/** A length as `#EXTINF` writes it: plain digits, or -1 (unknown) for none or one too long for them. */
function m3uSeconds(duration: number | null): string {
    const written = duration === null ? '-1' : String(duration);

    return /e/i.test(written) ? '-1' : written;
}

/** One track as M3U lines; `#EXTART` is always written, so the title is never split on reading. */
function m3uTrack(track: Track): string[] {
    const lines = [
        `#EXTINF:${m3uSeconds(track.duration)},${track.title}`,
        `#EXTART:${track.artist}`,
    ];

    if (track.album !== '') {
        lines.push(`#EXTALB:${track.album}`);
    }

    if (track.artwork !== null) {
        lines.push(`#EXTIMG:${track.artwork}`);
    }

    lines.push(track.src);

    return lines;
}

/**
 * Writes tracks as SonicFrame's JSON or as M3U, which `readTracks` reads back the same. The tracks
 * are cleaned as `readTracks` cleans them first (at most `MAX_TRACKS`), so a track built by hand can
 * never break a line of the file nor carry an address `readTracks` would refuse. M3U keeps the
 * address, title, artist, album, picture and length (a length too long for plain digits is written
 * as unknown); the peaks, the chapters, the transcript and the id go only in JSON.
 */
export function writeTracks(
    tracks: readonly Track[],
    format: TracksFormat = 'json',
): string {
    const clean = collect(tracks, undefined);

    if (format === 'm3u') {
        return ['#EXTM3U', ...clean.flatMap(m3uTrack), ''].join('\n');
    }

    return `${JSON.stringify({ tracks: clean.map(jsonTrack) }, null, 2)}\n`;
}
