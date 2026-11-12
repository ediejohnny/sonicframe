/**
 * A podcast feed (RSS) as a list of tracks: the show's name and picture, and each episode's sound
 * (`enclosure`), name, length (`itunes:duration`), picture (`itunes:image`), chapters
 * (`podcast:chapters`) and transcript (`podcast:transcript`), newest first or oldest first. The feed
 * is outside input: its size is capped (`maxSize`), it is read by our own small XML reader (`readXml`:
 * no page, no script, nothing loaded, no entity declarations, nesting and elements capped, and so it
 * works under Trusted Types and in Node), only text and attributes are taken from it, and every track
 * goes through `readTracks` (web addresses only, names cleaned, at most 1000).
 */

import { within } from '../shared/checked';
import { limitOf, type Limit } from '../shared/limits';
import { loadText, type LoadTextOptions } from '../shared/load-text';
import { cleanText } from '../shared/text';
import {
    address,
    readTracks,
    TRACK_COUNT,
    type Track,
    type TrackInput,
} from './tracks';
import { readXml, type XmlElement } from './xml';
import type { ReadXmlOptions } from './xml-limits';

export type ReadFeedOptions = ReadXmlOptions & {
    /** The feed's address, so relative addresses in it point beside it. */
    base?: string;
    /** `'newest'` (the default) or `'oldest'` first, by each episode's date. */
    order?: 'newest' | 'oldest';
    /** The most episodes kept: 1000, from 1 to 10 000 (past either end, kept at it, as it shipped). */
    limit?: number;
    /**
     * The longest feed read, in characters, and the largest fetched, in bytes: 5242880 (5 MB), from
     * 1024 to 20971520 (20 MB). Reading takes under 0.1 s for each MB on a desktop computer (more on a
     * phone), on the page's main thread.
     */
    maxSize?: number;
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

/** The longest feed read, in characters (and the largest fetched, in bytes): 5 MB, from 1 KB to 20 MB. */
export const FEED_SIZE: Limit = {
    value: 5_242_880,
    least: 1024,
    most: 20_971_520,
    whole: true,
};

function maxSizeOf(options: ReadFeedOptions): number {
    return limitOf('maxSize', options.maxSize, FEED_SIZE);
}

/** The longest show name kept, in characters, as a track's. */
const MAX_TITLE = 120;

/** An episode's length: seconds, or minutes and seconds, or hours, minutes and seconds. */
const DURATION = /^\d{1,7}(?::\d{1,2}){0,2}$/;

/** The child of `parent` named `name` (with its prefix, as `itunes:image`), or null. */
function childOf(parent: XmlElement, name: string): XmlElement | null {
    for (const child of parent.children) {
        if (child.name.toLowerCase() === name) {
            return child;
        }
    }

    return null;
}

function textOf(parent: XmlElement, name: string): string | undefined {
    return childOf(parent, name)?.text.trim() || undefined;
}

function attributeOf(
    parent: XmlElement,
    name: string,
    attribute: string,
): string | undefined {
    return (
        childOf(parent, name)?.attributes.get(attribute)?.trim() || undefined
    );
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

/** The feed's channel, or an error saying why it cannot be read. */
function channelOf(text: string, options: ReadFeedOptions): XmlElement {
    if (text.length > maxSizeOf(options)) {
        throw new RangeError('sonicframe: the feed is too large');
    }

    // `readXml` refuses entity declarations: they could grow a small text without end.
    const root = readXml(text, options);
    const channel = childOf(root, 'channel');

    if (root.name.toLowerCase() !== 'rss' || channel === null) {
        throw new TypeError('sonicframe: this is not a podcast feed');
    }

    return channel;
}

/** A feed's text, read (see `Feed`); refused when it is too large, declares entities or is no feed. */
export function readFeed(text: string, options: ReadFeedOptions = {}): Feed {
    const channel = channelOf(String(text), options);
    const show = textOf(channel, 'title') ?? '';
    const author = textOf(channel, 'itunes:author');
    const image = childOf(channel, 'image');
    const showImage =
        attributeOf(channel, 'itunes:image', 'href') ??
        (image === null ? undefined : textOf(image, 'url'));
    const limit = within(
        options.limit,
        TRACK_COUNT.value,
        TRACK_COUNT.least,
        TRACK_COUNT.most,
        Math.floor,
    );
    const newest = options.order !== 'oldest';
    const items = channel.children
        .filter((child) => child.name.toLowerCase() === 'item')
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
        tracks: readTracks(inputs, { base: options.base, maxTracks: limit }),
    };
}

/** The feed at `url`, fetched (see `loadText`) and read; relative addresses point beside it. */
export async function loadFeed(
    url: string,
    options: LoadFeedOptions = {},
): Promise<Feed> {
    const loaded = await loadText(url, options, 'feed', maxSizeOf(options));

    return readFeed(loaded.text, {
        ...options,
        base:
            options.base ??
            (/^https?:/i.test(loaded.url) ? loaded.url : undefined),
    });
}
