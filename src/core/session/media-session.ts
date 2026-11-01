/**
 * What a page tells the system's media controls (the lock screen, the notification, the media keys)
 * about the sound playing, checked before it leaves: words in one clean line, pictures only from a
 * web, relative or `blob:` address with well-formed sizes and type, at most eight of them, chapters
 * of the table of contents with a real start, and a position sent only when the sound has a known
 * length and a speed the controls can follow.
 */

import type { Chapter } from '../chapters/chapters';
import { finiteOr } from '../shared/checked';
import { positive } from '../shared/math';
import { cleanText } from '../shared/text';
import { safeUrl } from '../shared/url';

/** A picture for the controls: its address, and optionally its sizes (`'96x96 128x128'`) and type. */
export type MediaSessionArtwork = {
    src: string;
    /** Space-separated `WIDTHxHEIGHT`, or `'any'`; anything else is left out. */
    sizes?: string;
    /** An image type (`'image/png'`); anything else is left out. */
    type?: string;
};

/** What the controls show about the sound. */
export type MediaSessionDetails = {
    title?: string;
    artist?: string;
    album?: string;
    /** One address, or pictures in several sizes. */
    artwork?: string | readonly MediaSessionArtwork[];
    /** The chapters, for the controls that list them; those out of the table of contents are left out. */
    chapters?: readonly Chapter[];
};

/** A chapter as the controls take it. */
export type MediaSessionChapter = {
    title: string;
    startTime: number;
    artwork: MediaSessionArtwork[];
};

/** The details, checked: what the page hands to the controls. */
export type MediaSessionMetadata = {
    title: string;
    artist: string;
    album: string;
    artwork: MediaSessionArtwork[];
    chapterInfo: MediaSessionChapter[];
};

/** Where the sound is, as the controls take it. */
export type MediaSessionPosition = {
    duration: number;
    position: number;
    playbackRate: number;
};

/** The longest word taken, in characters. */
const MAX_WORD = 120;

/** The most pictures sent. */
const MAX_ARTWORK = 8;

/** The schemes a picture's address may have, besides a relative address. */
const PICTURE_SCHEMES: readonly string[] = ['http', 'https', 'blob'];

/** `'any'`, or one or more `WIDTHxHEIGHT` separated by single spaces. */
const SIZES = /^(any|\d{1,5}x\d{1,5}( \d{1,5}x\d{1,5}){0,7})$/;

/** An image type, short. */
const IMAGE_TYPE = /^image\/[a-z0-9.+-]{1,40}$/;

/** A word from the app as one clean line, or empty when it is not text. */
function word(value: unknown): string {
    return typeof value === 'string' ? cleanText(value, MAX_WORD) : '';
}

/** One picture, or null when its address is not safe; sizes and type only when well formed. */
function picture(value: unknown): MediaSessionArtwork | null {
    const given =
        typeof value === 'string'
            ? { src: value }
            : typeof value === 'object' && value !== null
              ? (value as Partial<MediaSessionArtwork>)
              : null;
    const src =
        typeof given?.src === 'string'
            ? safeUrl(given.src, PICTURE_SCHEMES)
            : null;

    if (given === null || src === null) {
        return null;
    }

    const checked: MediaSessionArtwork = { src };

    if (typeof given.sizes === 'string' && SIZES.test(given.sizes)) {
        checked.sizes = given.sizes;
    }

    if (typeof given.type === 'string' && IMAGE_TYPE.test(given.type)) {
        checked.type = given.type;
    }

    return checked;
}

/** The safe pictures, at most eight. */
function pictures(value: unknown): MediaSessionArtwork[] {
    const list = Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value];
    const kept: MediaSessionArtwork[] = [];

    for (const item of list) {
        const one = picture(item);

        if (one !== null) {
            kept.push(one);
        }

        if (kept.length === MAX_ARTWORK) {
            break;
        }
    }

    return kept;
}

/** The chapters of the table of contents with a start at or after zero, as the controls take them. */
function chapterInfo(value: unknown): MediaSessionChapter[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return (value as readonly Partial<Chapter>[])
        .filter(
            (chapter) =>
                chapter.toc !== false && finiteOr(chapter.start, -1) >= 0,
        )
        .map((chapter) => ({
            title: word(chapter.title),
            startTime: chapter.start as number,
            artwork: pictures(chapter.image ?? undefined),
        }));
}

/** The details checked for the controls (see the file's header). */
export function sessionMetadata(
    details: MediaSessionDetails,
): MediaSessionMetadata {
    return {
        title: word(details.title),
        artist: word(details.artist),
        album: word(details.album),
        artwork: pictures(details.artwork),
        chapterInfo: chapterInfo(details.chapters),
    };
}

/**
 * Where the sound is, for the controls: null without a duration above zero or a speed above zero;
 * the position kept from 0 to the duration (0 when it is not a number).
 */
export function sessionPosition(
    duration: number | null,
    position: number,
    rate: number,
): MediaSessionPosition | null {
    const length = positive(duration);
    const speed = positive(rate);

    if (length === null || speed === null) {
        return null;
    }

    return {
        duration: length,
        position: Math.min(length, Math.max(0, finiteOr(position, 0))),
        playbackRate: speed,
    };
}
