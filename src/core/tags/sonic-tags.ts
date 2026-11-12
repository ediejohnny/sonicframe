/**
 * SonicFrame's tags and the attributes each reads, for an HTML filter: a CMS that lets people write
 * pages (WordPress's KSES, DOMPurify, a server's own) allows these and nothing else, so its authors
 * can place players. No name starts with `on`: a filter never needs to allow an event handler. The
 * few that send a visitor's data to an address the author picks are marked `trustedOnly`.
 * The names are the default ones (`defineSonicPlayer('my-player')` registers another).
 */

import {
    NOW_PLAYING_ATTRIBUTES,
    PLAYER_ATTRIBUTES,
    PLAYLIST_ATTRIBUTES,
    PLAYLIST_LINK_ATTRIBUTES,
    RECORDER_ATTRIBUTES,
} from './tag-attributes';

/** A tag, the attributes it reads, the starts of the names it also reads, and its children that count. */
export type SonicTag = {
    readonly tag: string;
    readonly attributes: readonly string[];
    /**
     * The attributes (of `attributes`) to allow only to authors you trust: they send what a visitor
     * does to an address the author picks (`upload-url` sends a visitor's recording there).
     */
    readonly trustedOnly: readonly string[];
    /** A name that starts with one of these is read too (`icon-` + one of the recorder's `actions`). */
    readonly prefixes: readonly string[];
    readonly children: readonly SonicTag[];
};

function tag(
    name: string,
    attributes: readonly string[],
    more: {
        trustedOnly?: readonly string[];
        prefixes?: readonly string[];
        children?: readonly SonicTag[];
    } = {},
): SonicTag {
    return Object.freeze({
        tag: name,
        attributes: Object.freeze([...attributes]),
        trustedOnly: Object.freeze([...(more.trustedOnly ?? [])]),
        prefixes: Object.freeze([...(more.prefixes ?? [])]),
        children: Object.freeze([...(more.children ?? [])]),
    });
}

/** Every SonicFrame tag, with what an HTML filter must allow for it to work. */
export const SONIC_TAGS: readonly SonicTag[] = Object.freeze([
    tag('sonic-player', PLAYER_ATTRIBUTES),
    tag('sonic-playlist', PLAYLIST_ATTRIBUTES, {
        children: [tag('a', PLAYLIST_LINK_ATTRIBUTES)],
    }),
    tag('sonic-now-playing', NOW_PLAYING_ATTRIBUTES),
    tag('sonic-recorder', RECORDER_ATTRIBUTES, {
        trustedOnly: ['upload-url'],
        prefixes: ['icon-'],
    }),
]);
