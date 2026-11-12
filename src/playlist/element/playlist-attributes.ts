/**
 * What a `<sonic-playlist>` says, as the playlist's options. Attributes and links are untrusted
 * input: a number counts only when it is one, a word only when the playlist knows it, and every
 * address goes through `readTracks`, which keeps only web addresses. The tracks are the tag's own
 * links (`<a href data-artist>Title</a>`), which work as plain links where scripts never run, or the
 * list at `src`. Every attribute of `<sonic-player>` but the sound's own sets each track's player.
 */

import type { TrackInput } from '../../core/playlist/tracks';
import { attributeNumber } from '../../dom/shared/custom-element';
import { optionsOf } from '../../player/element/element-attributes';
import { PLAYER_ATTRIBUTES } from '../../player/element/element';
import type {
    PlaylistButton,
    PlaylistList,
    PlaylistOptions,
    PlaylistPlayer,
} from '../playlist/playlist-options';

/** The playlist's own attributes. */
const OWN_ATTRIBUTES = [
    'src',
    'start',
    'layout',
    'advance',
    'repeat',
    'shuffle',
    'gap',
    'previous-restarts',
    'play-on-select',
    'list',
    'list-place',
    'list-placement',
    'list-side',
    'list-width',
    'list-max-height',
    'list-header',
    'list-stay-open',
    'list-backdrop',
    'list-animation',
    'list-palette',
    'buttons',
    'remember-key',
    'fetch-credentials',
    'a11y-label',
    'a11y-announce',
    'a11y-lang',
] as const;

/** The player's attributes that belong to the sound, which each track brings instead. */
const SOUND_ATTRIBUTES = new Set([
    'src',
    'preload',
    'peaks',
    'label',
    'chapters',
]);

/** Every attribute the tag reads. */
export const PLAYLIST_ATTRIBUTES: readonly string[] = Object.freeze([
    ...new Set([
        ...OWN_ATTRIBUTES,
        ...PLAYER_ATTRIBUTES.filter((name) => !SOUND_ATTRIBUTES.has(name)),
    ]),
]);

/** An on-or-off attribute that is on unless it says `false`; undefined without it. */
function onUnlessFalse(value: string | null): boolean | undefined {
    return value === null ? undefined : value.trim() !== 'false';
}

/** The tag's own links (its children with an address), in order. */
export function ownLinks(element: Element): HTMLAnchorElement[] {
    return [...element.children].filter(
        (child): child is HTMLAnchorElement =>
            child instanceof HTMLAnchorElement && child.hasAttribute('href'),
    );
}

/** The tag's own links, as tracks: their address, their text as the title, the rest from `data-`. */
function linkTracks(element: Element): TrackInput[] {
    return ownLinks(element).map((link) => {
        const data = (name: string): string | undefined =>
            link.getAttribute(`data-${name}`) ?? undefined;

        return {
            src: link.getAttribute('href') ?? '',
            title: link.textContent ?? undefined,
            artist: data('artist'),
            album: data('album'),
            artwork: data('artwork'),
            peaks: data('peaks'),
            duration: attributeNumber(link.getAttribute('data-duration')),
            chapters: data('chapters'),
            id: data('id'),
        };
    });
}

/** The list's options from the `list-` attributes; false with `list="false"`. */
function listOf(element: Element): boolean | PlaylistList {
    const get = (name: string): string | null => element.getAttribute(name);
    const list = get('list');

    if (list?.trim() === 'false') {
        return false;
    }

    // The playlist checks each word and number and falls back on its own.
    return {
        type: (list ?? undefined) as PlaylistList['type'],
        place: (get('list-place') ?? undefined) as PlaylistList['place'],
        placement: (get('list-placement') ??
            undefined) as PlaylistList['placement'],
        side: (get('list-side') ?? undefined) as PlaylistList['side'],
        width: attributeNumber(get('list-width')),
        maxHeight: attributeNumber(get('list-max-height')),
        header: onUnlessFalse(get('list-header')),
        stayOpen: element.hasAttribute('list-stay-open'),
        backdrop: element.hasAttribute('list-backdrop'),
        animation: element.hasAttribute('list-animation'),
        palette: (get('list-palette') ?? undefined) as PlaylistList['palette'],
    };
}

/**
 * The options of every track's player, from the player's attributes: those of the sound are left to
 * the tracks, and `a11y-label` names the playlist, while each player is named by its track.
 */
function playerOf(element: Element): PlaylistPlayer {
    const options: Record<string, unknown> = { ...optionsOf(element) };

    for (const name of ['src', 'preload', 'peaks', 'label', 'chapters']) {
        delete options[name];
    }

    const player = options as PlaylistPlayer;

    return { ...player, a11y: { ...player.a11y, label: undefined } };
}

/** Everything the tag says, as the playlist's options (all but the container). */
export function playlistOptionsOf(
    element: Element,
): Omit<PlaylistOptions, 'container'> {
    const get = (name: string): string | null => element.getAttribute(name);
    const src = get('src');
    const buttons = get('buttons');
    const remember = element.hasAttribute('remember');

    return {
        tracks: src === null ? linkTracks(element) : undefined,
        src: src ?? undefined,
        fetch: {
            credentials: (get('fetch-credentials') ??
                undefined) as RequestCredentials,
        },
        start: attributeNumber(get('start')),
        layout: (get('layout') ?? undefined) as PlaylistOptions['layout'],
        advance: onUnlessFalse(get('advance')),
        repeat: (get('repeat') ?? undefined) as PlaylistOptions['repeat'],
        shuffle: element.hasAttribute('shuffle'),
        gap: attributeNumber(get('gap')),
        previousRestarts: attributeNumber(get('previous-restarts')),
        playOnSelect: onUnlessFalse(get('play-on-select')),
        list: listOf(element),
        buttons:
            buttons === null
                ? undefined
                : (buttons.split(/\s+/) as PlaylistButton[]),
        remember: remember
            ? { key: get('remember-key') ?? undefined }
            : undefined,
        player: playerOf(element),
        a11y: {
            label: get('a11y-label') ?? undefined,
            announce: onUnlessFalse(get('a11y-announce')),
            lang: get('a11y-lang') ?? undefined,
        },
    };
}
