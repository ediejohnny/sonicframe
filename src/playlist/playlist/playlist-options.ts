/**
 * The options of a playlist (`createPlaylist`), its events, and the options checked: unknown names
 * fall back to their defaults, numbers stay in their ranges.
 */

import type { LanguageTag } from '../../core/languages/language';
import type { PlaylistWords } from '../../core/languages/words';
import type { RememberStore } from '../../core/player/remember';
import type { ReadFeedOptions } from '../../core/playlist/feed';
import type { Repeat } from '../../core/playlist/order';
import type { Track, TrackInput } from '../../core/playlist/tracks';
import type { NowPlayingOptions } from '../now-playing/now-playing-options';
import { oneOf, within } from '../../core/shared/checked';
import type {
    PlayerChapterList,
    PlayerOptions,
} from '../../player/player/player-options';

/** `'one'`: one player and the list; `'each'`: a player for each track, one under the other. */
export type PlaylistLayout = 'one' | 'each';

/** The buttons over the list. */
export type PlaylistButton = 'shuffle' | 'repeat';

/** The options every track's player is made with; what the track brings wins. */
export type PlaylistPlayer = Omit<
    PlayerOptions,
    'container' | 'media' | 'src' | 'tracks' | 'duration'
>;

/** How the list of tracks shows and looks, as the player's list of chapters does. */
export type PlaylistList = Omit<
    PlayerChapterList,
    'open' | 'swipe' | 'swipeDirection' | 'style'
> & {
    /** Where the list goes in the playlist: `'below'` the player (the default) or `'above'` it. */
    place?: 'below' | 'above';
};

/** What a playlist remembers between visits: the track it was on, the shuffle and the repeat. */
export type PlaylistRemember = {
    /**
     * The name it is kept under (`sonicframe:playlist:<key>`, apart from the players' own); give
     * each playlist of a site its own. One name for all by default.
     */
    key?: string;
    /** Where it is kept: the page's `localStorage` by default, or any storage of your own. */
    store?: RememberStore;
};

export type PlaylistA11y = {
    /** The playlist's accessible name: its `playlist` word by default. */
    label?: string;
    /** Says the track that starts ("Playing: Title, 3 of 12"). On by default. */
    announce?: boolean;
    /** The language of its words: a tag, or `'auto'` for the page's; English by default. */
    lang?: LanguageTag;
    /** Your own words, over the language's. */
    words?: Partial<PlaylistWords>;
};

export type PlaylistOptions = {
    /** The element the playlist is added to. */
    container: HTMLElement;
    /** The tracks: a list, or the text of a JSON or M3U list (see `readTracks`). */
    tracks?: readonly TrackInput[] | string;
    /** The address of a JSON or M3U list, fetched when `tracks` is left out. */
    src?: string;
    /**
     * The address of a podcast feed (RSS), fetched when `tracks` is left out: its episodes, newest first.
     * Or `{ src, ...options }`, with the options of `readFeed`: `order` `'newest'` or `'oldest'`,
     * `limit` at most 1000, and the reader's ceilings (`maxSize`, `maxDepth`, `maxElements`,
     * `maxAttributes`, `maxNameLength`).
     */
    feed?: string | ({ src: string } & Omit<ReadFeedOptions, 'base'>);
    /** How `src` and `feed` are fetched: cookies only to the page's own site by default. */
    fetch?: {
        credentials?: RequestCredentials;
        referrerPolicy?: ReferrerPolicy;
    };
    /** The track to start on: 0 by default. */
    start?: number;
    /** With `layout: 'one'`, your audio or video element; the playlist makes an `<audio>` otherwise. */
    media?: HTMLMediaElement | null;
    /** The options of every track's player; the track's address, title, peaks and chapters win. */
    player?: PlaylistPlayer;
    /** `'one'` (the default) or `'each'`. */
    layout?: PlaylistLayout;
    /** Goes on to the next track when one ends. On by default. */
    advance?: boolean;
    /** `'none'` (the default), `'all'` (the list starts over) or `'one'` (the track starts over). */
    repeat?: Repeat;
    /** Plays the tracks in a shuffled order. Off by default. */
    shuffle?: boolean;
    /** The shuffle's random numbers, from 0 up to 1: `Math.random` by default. */
    random?: () => number;
    /** "Previous" starts the track over when it has played more than this, in seconds: 3, from 0 (never) to 30. */
    previousRestarts?: number;
    /** A track chosen in the list starts playing. On by default. */
    playOnSelect?: boolean;
    /** The pause between two tracks, in seconds: 0, from 0 to 10. */
    gap?: number;
    /** The list of tracks: true (the default), false, or its options. Not shown with `layout: 'each'`. */
    list?: boolean | PlaylistList;
    /** The buttons over the list: shuffle and repeat by default; `[]` for none. */
    buttons?: readonly PlaylistButton[];
    /** The now-playing bar for the playlist's player: true or its options. Off by default. */
    nowPlaying?: boolean | NowPlayingOptions;
    /** Remembers the track, the shuffle and the repeat between visits. Off by default. */
    remember?: boolean | PlaylistRemember;
    a11y?: PlaylistA11y;
};

export type PlaylistEvents = {
    /** A track became the current one. */
    trackchange: [track: Track, index: number];
    /** The last track ended and nothing follows. */
    listend: [];
    /** The tracks changed (loaded, added, removed, moved). */
    trackschange: [tracks: readonly Track[]];
    /** The list could not be loaded. */
    error: [error: Error];
};

/** The options that are plain settings, checked. */
export type PlaylistSettings = {
    layout: PlaylistLayout;
    advance: boolean;
    repeat: Repeat;
    shuffle: boolean;
    /** In seconds. */
    previousRestarts: number;
    playOnSelect: boolean;
    /** In seconds. */
    gap: number;
    place: 'below' | 'above';
    buttons: readonly PlaylistButton[];
    announce: boolean;
};

export function playlistSettings(options: PlaylistOptions): PlaylistSettings {
    const list = typeof options.list === 'object' ? options.list : {};

    return {
        layout: oneOf(options.layout, ['one', 'each'], 'one'),
        advance: options.advance !== false,
        repeat: oneOf(options.repeat, ['none', 'all', 'one'], 'none'),
        shuffle: options.shuffle === true,
        previousRestarts: within(options.previousRestarts, 3, 0, 30),
        playOnSelect: options.playOnSelect !== false,
        gap: within(options.gap, 0, 0, 10),
        place: oneOf(list.place, ['below', 'above'], 'below'),
        buttons: Array.isArray(options.buttons)
            ? (['shuffle', 'repeat'] as const).filter((name) =>
                  options.buttons?.includes(name),
              )
            : ['shuffle', 'repeat'],
        announce: options.a11y?.announce !== false,
    };
}
