/**
 * A podcast feed (RSS) as a list of tracks: the show's name and picture, and each episode's sound
 * (`enclosure`), name, length (`itunes:duration`), picture (`itunes:image`), chapters
 * (`podcast:chapters`) and transcript (`podcast:transcript`), newest first or oldest first. The feed
 * is outside input: a text that declares entities is refused before it is read, it is read as XML (no
 * script runs, nothing is loaded), only text and attributes are taken from it, and every track goes
 * through `readTracks` (web addresses only, names cleaned, at most 1000).
 */

import { within } from '../../core/shared/checked';
import { loadText, type LoadTextOptions } from '../../core/shared/load-text';
import { cleanText } from '../../core/shared/text';
import {
    address,
    MAX_TRACKS,
    readTracks,
    type Track,
    type TrackInput,
} from '../../core/playlist/tracks';

export type ReadFeedOptions = {
    /** The feed's address, so relative addresses in it point beside it. */
    base?: string;
    /** `'newest'` (the default) or `'oldest'` first, by each episode's date. */
    order?: 'newest' | 'oldest';
    /** The most episodes kept: 1000, from 1. */
    limit?: number;
};

export type LoadFeedOptions = LoadTextOptions & ReadFeedOptions;

/** A feed, read. */
export type Feed = {
    /** The show's name. */
    title: string;
    /** The show's picture's address, or null. */
    image: string | null;
    tracks: Track[];
};

/** The longest feed read, in characters (and the largest fetched, in bytes): 5 MB. */
const MAX_TEXT = 5_242_880;

/** The longest show name kept, in characters, as a track's. */
const MAX_TITLE = 120;

/** An episode's length: seconds, or minutes and seconds, or hours, minutes and seconds. */
const DURATION = /^\d{1,7}(?::\d{1,2}){0,2}$/;

/** The child of `parent` named `name` (with its prefix, as `itunes:image`), or null. */
function childOf(parent: Element, name: string): Element | null {
    for (const child of Array.from(parent.children)) {
        if (child.nodeName.toLowerCase() === name) {
            return child;
        }
    }

    return null;
}

function textOf(parent: Element, name: string): string | undefined {
    return childOf(parent, name)?.textContent?.trim() || undefined;
}

function attributeOf(
    parent: Element,
    name: string,
    attribute: string,
): string | undefined {
    return childOf(parent, name)?.getAttribute(attribute)?.trim() || undefined;
}

/** An episode's length in seconds, or undefined when it is not one. */
function durationOf(text: string | undefined): number | undefined {
    if (text === undefined || !DURATION.test(text)) {
        return undefined;
    }

    return text
        .split(':')
        .reduce((total, part) => total * 60 + Number(part), 0);
}

/** The feed's document, or an error saying why it cannot be read. */
function documentOf(text: string): Element {
    if (text.length > MAX_TEXT) {
        throw new RangeError('sonicframe: the feed is too large');
    }

    // Entities could grow a small text without end, or reach outside: a feed never needs them.
    if (/<!ENTITY/i.test(text)) {
        throw new TypeError('sonicframe: a feed may not declare entities');
    }

    const document = new DOMParser().parseFromString(text, 'application/xml');
    const root = document.documentElement;

    if (
        root === null ||
        root.nodeName === 'parsererror' ||
        document.getElementsByTagName('parsererror').length > 0
    ) {
        throw new TypeError('sonicframe: the feed is not valid XML');
    }

    const channel = childOf(root, 'channel');

    if (root.nodeName.toLowerCase() !== 'rss' || channel === null) {
        throw new TypeError('sonicframe: this is not a podcast feed');
    }

    return channel;
}

/** A feed's text, read (see `Feed`); refused when it is too large, declares entities or is no feed. */
export function readFeed(text: string, options: ReadFeedOptions = {}): Feed {
    const channel = documentOf(String(text));
    const show = textOf(channel, 'title') ?? '';
    const author = textOf(channel, 'itunes:author');
    const showImage =
        attributeOf(channel, 'itunes:image', 'href') ??
        (childOf(channel, 'image') === null
            ? undefined
            : textOf(childOf(channel, 'image') as Element, 'url'));
    const limit = within(options.limit, MAX_TRACKS, 1, MAX_TRACKS, Math.floor);
    const newest = options.order !== 'oldest';
    const items = Array.from(channel.children)
        .filter((child) => child.nodeName.toLowerCase() === 'item')
        .map((item, at) => ({
            item,
            at,
            time: Date.parse(textOf(item, 'pubdate') ?? ''),
        }));

    // Undated episodes keep the feed's order, after the dated ones.
    items.sort((a, b) => {
        const known =
            Number(Number.isNaN(a.time)) - Number(Number.isNaN(b.time));

        if (known !== 0 || (Number.isNaN(a.time) && Number.isNaN(b.time))) {
            return known || a.at - b.at;
        }

        return (newest ? b.time - a.time : a.time - b.time) || a.at - b.at;
    });

    const inputs: TrackInput[] = [];

    for (const { item } of items) {
        const src = attributeOf(item, 'enclosure', 'url');

        if (src !== undefined) {
            inputs.push({
                src,
                title: textOf(item, 'title'),
                artist: textOf(item, 'itunes:author') ?? author,
                album: show || undefined,
                artwork: attributeOf(item, 'itunes:image', 'href') ?? showImage,
                duration: durationOf(textOf(item, 'itunes:duration')),
                chapters: attributeOf(item, 'podcast:chapters', 'url'),
                transcript: attributeOf(item, 'podcast:transcript', 'url'),
                id: textOf(item, 'guid'),
            });
        }
    }

    return {
        title: cleanText(show, MAX_TITLE),
        image: address(showImage, options.base),
        tracks: readTracks(inputs, { base: options.base }).slice(0, limit),
    };
}

/** The feed at `url`, fetched (see `loadText`) and read; relative addresses point beside it. */
export async function loadFeed(
    url: string,
    options: LoadFeedOptions = {},
): Promise<Feed> {
    const loaded = await loadText(url, options, 'feed', MAX_TEXT);

    return readFeed(loaded.text, {
        ...options,
        base:
            options.base ??
            (/^https?:/i.test(loaded.url) ? loaded.url : undefined),
    });
}
