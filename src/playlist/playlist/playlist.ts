/**
 * A list of tracks played one after the other (`createPlaylist`): a player for the current track on
 * one media element, or a player for each track (`layout`), the list of tracks with shuffle and
 * repeat, and what comes next when a track ends (`advance`, `repeat`, `gap`). Tracks are read by
 * `readTracks` (every address checked), or fetched from `src`; the current track is said to screen
 * readers, and with `remember` the track, the shuffle and the repeat come back on the next visit.
 */

import { localeFor, wordsFor } from '../../core/languages/language';
import { mergeWords } from '../../core/languages/merge-words';
import type { PlaylistWords } from '../../core/languages/words';
import {
    nextTrack,
    previousRestarts,
    previousTrack,
    shuffledOrder,
    trackAfterEnd,
    writtenOrder,
    type Repeat,
} from '../../core/playlist/order';
import { loadTracks } from '../../core/playlist/load-tracks';
import { loadFeed } from '../../core/playlist/feed';
import {
    readTracks,
    TRACK_COUNT,
    type Track,
    type TrackInput,
} from '../../core/playlist/tracks';
import { oneOf } from '../../core/shared/checked';
import { limitOf, TEXT_LENGTH } from '../../core/shared/limits';
import { Emitter } from '../../core/shared/emitter';
import { cleanText, fillTemplate } from '../../core/shared/text';
import { announce } from '../../dom/a11y/announce';
import { pageLanguage } from '../../dom/a11y/page-language';
import { carryLook } from '../../player/chapters/chapter-panel';
import type { Player } from '../../player/player/player';
import type {
    PlayerOptions,
    PlayerTracks,
} from '../../player/player/player-options';
import { TrackList } from '../list/track-list';
import { NowPlaying } from '../now-playing/now-playing';
import { EachStage } from '../stage/each-stage';
import { OneStage } from '../stage/one-stage';
import type { Stage } from '../stage/stage';
import {
    playlistSettings,
    type PlaylistEvents,
    type PlaylistOptions,
    type PlaylistSettings,
} from './playlist-options';
import { PlaylistStore } from './playlist-store';
import { trackItem, trackOptions, trackTitle } from './track-options';

/** The longest word or name, in characters. */
const MAX_WORD = 120;

export class Playlist {
    /** The playlist's root element. */
    readonly element: HTMLDivElement;
    private readonly options: PlaylistOptions;
    private readonly settings: PlaylistSettings;
    private readonly events = new Emitter<PlaylistEvents>();
    private readonly abort = new AbortController();
    /** How the list's tracks are read: the most it keeps (`maxTracks`) and their longest names (`maxText`). */
    private readonly reading: { maxTracks: number; maxText: number };
    private readonly words: PlaylistWords;
    private readonly store: PlaylistStore | null;
    /** The media the playlist made itself, taken off with it; null for the app's or a stack's. */
    private readonly ownMedia: HTMLMediaElement | null = null;
    private readonly stage: Stage;
    private readonly list: TrackList | null = null;
    private readonly bar: NowPlaying | null;
    private trackList: Track[] = [];
    private orderList: number[] = [];
    private current = -1;
    private shuffleOn: boolean;
    private repeatMode: Repeat;
    private wait: ReturnType<typeof setTimeout> | null = null;
    private destroyed = false;

    constructor(options: PlaylistOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.options = options;
        this.reading = {
            maxTracks: limitOf('maxTracks', options.maxTracks, TRACK_COUNT),
            maxText: limitOf('maxText', options.maxText, TEXT_LENGTH),
        };
        this.settings = playlistSettings(options);
        this.shuffleOn = this.settings.shuffle;
        this.repeatMode = this.settings.repeat;
        const a11y = options.a11y ?? {};
        const lang =
            a11y.lang === 'auto' ? pageLanguage(options.container) : a11y.lang;
        this.words = mergeWords(wordsFor(lang).playlist, a11y.words, MAX_WORD);
        this.store = PlaylistStore.of(options.remember);

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-playlist';
        this.element.setAttribute('role', 'group');
        this.element.setAttribute(
            'aria-label',
            cleanText(a11y.label ?? this.words.playlist, MAX_WORD),
        );

        // A language the app chose marks the playlist, so a screen reader says its words in that voice.
        if (a11y.lang !== undefined) {
            this.element.setAttribute(
                'lang',
                localeFor(lang, a11y.words !== undefined),
            );
        }

        const host = {
            options: (index: number) => this.playerOptions(index),
            ended: () => this.ended(),
            started: (index: number) => this.go(index, false),
            progress: (played: number | null) =>
                this.list?.mark(this.current, played),
        };

        if (this.settings.layout === 'each') {
            this.stage = new EachStage(host);
        } else {
            let media = options.media ?? null;

            if (media === null) {
                media = document.createElement('audio');
                media.preload = 'metadata';
                this.ownMedia = media;
                this.element.append(media);
            }

            this.stage = new OneStage(media, host, this.abort.signal);

            if (options.list !== false) {
                this.list = new TrackList(
                    options.list ?? true,
                    this.settings.buttons,
                    {
                        words: this.words,
                        element: this.element,
                        choose: (index) =>
                            this.go(index, this.settings.playOnSelect),
                        shuffle: () => this.shuffleOn,
                        setShuffle: (on) => this.setShuffle(on),
                        repeat: () => this.repeatMode,
                        setRepeat: (repeat) => this.setRepeat(repeat),
                        reportError: (error) => this.fail(error),
                    },
                );
            }
        }

        if (this.list === null) {
            this.element.append(this.stage.element);
        } else if (this.settings.place === 'above') {
            this.element.append(this.list.element, this.stage.element);
        } else {
            this.element.append(this.stage.element, this.list.element);
        }

        options.container.append(this.element);
        this.bar =
            options.nowPlaying === undefined || options.nowPlaying === false
                ? null
                : new NowPlaying(
                      options.nowPlaying === true ? {} : options.nowPlaying,
                  );
        this.start(options);
    }

    /** The player of the current track, or null while there is none. */
    get player(): Player | null {
        return this.destroyed ? null : this.stage.player();
    }

    /** The tracks, in the order written. */
    get tracks(): readonly Track[] {
        return this.trackList;
    }

    /** The current track's place in `tracks`, or -1 while there is none. */
    get index(): number {
        return this.current;
    }

    /** The places of the tracks in the order they play (shuffled or written). */
    get order(): readonly number[] {
        return [...this.orderList];
    }

    get shuffle(): boolean {
        return this.shuffleOn;
    }

    get repeat(): Repeat {
        return this.repeatMode;
    }

    on<Name extends keyof PlaylistEvents>(
        event: Name,
        listener: (...args: PlaylistEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /** Plays track `index`, or the current one. */
    play(index?: number): void {
        this.go(index ?? this.current, true);
    }

    pause(): void {
        this.player?.media?.pause();
    }

    /** Makes track `index` the current one, without playing it. */
    select(index: number): void {
        this.go(index, false);
    }

    /** Plays the track after the current one in the order, when there is one. */
    next(): void {
        const to = nextTrack(this.orderList, this.current, this.repeatMode);

        if (to !== null) {
            this.go(to, true);
        }
    }

    /**
     * Plays the track before; starts the current one over instead once it has played past
     * `previousRestarts`, or when there is none before.
     */
    previous(): void {
        const to = previousTrack(this.orderList, this.current, this.repeatMode);
        const time = this.player?.media?.currentTime ?? 0;

        if (
            previousRestarts(time, this.settings.previousRestarts, to !== null)
        ) {
            this.stage.restart();
        } else if (to !== null) {
            this.go(to, true);
        }
    }

    /** Adds tracks at `at` (the end by default); the track playing goes on. */
    add(tracks: readonly TrackInput[] | string, at?: number): void {
        const added = readTracks(tracks, this.reading);
        const place =
            typeof at === 'number' && Number.isInteger(at)
                ? Math.min(Math.max(0, at), this.trackList.length)
                : this.trackList.length;
        const all = [...this.trackList];
        all.splice(place, 0, ...added);
        this.change(all.slice(0, this.reading.maxTracks));
    }

    /** Takes track `index` out; when it is the current one, the track that takes its place is. */
    remove(index: number): void {
        if (this.trackList[index] === undefined) {
            return;
        }

        const playing = this.player?.media?.paused === false;
        const all = this.trackList.filter((_, at) => at !== index);

        if (index !== this.current) {
            this.change(all);
        } else {
            this.change(all, all[Math.min(index, all.length - 1)] ?? null);

            if (this.current >= 0) {
                this.stage.show(this.current, playing);
            }

            this.changed();
        }
    }

    /** Moves track `from` to `to`; the track playing goes on. */
    move(from: number, to: number): void {
        const track = this.trackList[from];

        if (track === undefined || !Number.isInteger(to)) {
            return;
        }

        const all = this.trackList.filter((_, at) => at !== from);
        all.splice(Math.min(Math.max(0, to), all.length), 0, track);
        this.change(all);
    }

    /** Takes a new list of tracks, its first one current. */
    setTracks(tracks: readonly TrackInput[] | string): void {
        const all = readTracks(tracks, this.reading);
        this.change(all, all[0] ?? null);
        this.changed();
    }

    /** Turns the shuffle on (a new shuffled order, the current track first) or off. */
    setShuffle(on: boolean): void {
        this.shuffleOn = on === true;
        this.orderList = this.orderOf(this.trackList.length);
        this.stage.refresh();
        this.list?.update();
        this.keep();
    }

    setRepeat(repeat: Repeat): void {
        this.repeatMode = oneOf(repeat, ['none', 'all', 'one'], 'none');
        this.stage.refresh();
        this.list?.update();
        this.keep();
    }

    /** Forgets what `remember` kept. */
    forget(): void {
        this.store?.forget();
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.cancelWait();
        this.abort.abort();
        this.stage.destroy();
        this.list?.destroy();
        this.bar?.destroy();
        this.ownMedia?.pause();
        this.element.remove();
    }

    /** The first tracks, from the options or fetched from `src`, and where the list starts. */
    private start(options: PlaylistOptions): void {
        if (options.tracks !== undefined) {
            this.first(readTracks(options.tracks, this.reading));

            return;
        }

        const feed =
            typeof options.feed === 'string'
                ? { src: options.feed }
                : options.feed;
        const address = feed?.src ?? options.src;

        if (typeof address !== 'string') {
            this.first([]);

            return;
        }

        const load = {
            base: pageAddress(address),
            credentials: options.fetch?.credentials,
            referrerPolicy: options.fetch?.referrerPolicy,
            signal: this.abort.signal,
        };
        const loading =
            feed === undefined
                ? loadTracks(address, { ...load, ...this.reading })
                : // The feed's own options (order, limit, ceilings); how it is fetched comes from `load`.
                  loadFeed(address, { ...feed, ...load }).then(
                      (read) => read.tracks,
                  );

        loading.then(
            (tracks) => {
                if (!this.destroyed) {
                    this.first(tracks);
                }
            },
            (error: unknown) => this.fail(error),
        );
    }
    /** Takes the first tracks: the current one is the remembered one, or `start`. */
    private first(tracks: Track[]): void {
        const kept = this.store?.read();
        this.shuffleOn = kept?.shuffle ?? this.shuffleOn;
        this.repeatMode = kept?.repeat ?? this.repeatMode;
        const start = this.options.start;
        const remembered = tracks.find((track) => track.id === kept?.track);
        const index =
            remembered !== undefined
                ? tracks.indexOf(remembered)
                : typeof start === 'number' &&
                    Number.isInteger(start) &&
                    start >= 0 &&
                    start < tracks.length
                  ? start
                  : 0;
        this.list?.update();
        this.change(tracks, tracks[index] ?? null);
        this.changed();
    }

    /**
     * Takes `tracks` as the list: the current track is `current` (the one now, by default), the
     * order is made again, and the list, the players and the app are told.
     */
    private change(
        tracks: Track[],
        current: Track | null = this.trackList[this.current] ?? null,
    ): void {
        this.trackList = tracks;
        this.current = current === null ? -1 : tracks.indexOf(current);
        this.orderList = this.orderOf(tracks.length);
        this.stage.setTracks(tracks, this.current);
        this.list?.render(
            tracks.map((track, at) => trackItem(track, at, this.words)),
        );
        this.list?.mark(this.current, null);
        this.events.emit('trackschange', tracks);
    }

    /** The order the tracks play in: shuffled with the current track first, or as written. */
    private orderOf(count: number): number[] {
        return this.shuffleOn
            ? shuffledOrder(
                  count,
                  Math.max(0, this.current),
                  this.options.random,
              )
            : writtenOrder(count);
    }

    /** Makes track `index` the current one, playing it when asked. */
    private go(index: number, play: boolean): void {
        if (this.destroyed || this.trackList[index] === undefined) {
            return;
        }

        this.cancelWait();
        const moved = index !== this.current;
        this.current = index;
        this.stage.show(index, play);

        if (moved) {
            this.stage.refresh();
            this.changed();
        }
    }

    /** Tells the list, the screen reader, the storage and the app that the current track changed. */
    private changed(): void {
        const track = this.trackList[this.current];
        const player = this.stage.player();

        if (player !== null) {
            carryLook(player.element, this.element);
        }

        this.list?.mark(this.current, null);

        if (track === undefined) {
            return;
        }

        if (this.settings.announce) {
            announce(
                cleanText(
                    fillTemplate(this.words.playing, {
                        title: trackTitle(track, this.current, this.words),
                        place: String(this.current + 1),
                        count: String(this.trackList.length),
                    }),
                    200,
                ),
            );
        }

        this.keep();
        this.events.emit('trackchange', track, this.current);
    }

    /** What follows when the current track ends by itself. */
    private ended(): void {
        if (!this.settings.advance) {
            return;
        }

        const to = trackAfterEnd(this.orderList, this.current, this.repeatMode);

        if (to === null) {
            this.events.emit('listend');
        } else if (to === this.current) {
            this.stage.restart();
        } else if (this.settings.gap > 0) {
            this.wait = setTimeout(
                () => this.go(to, true),
                this.settings.gap * 1000,
            );
        } else {
            this.go(to, true);
        }
    }

    /** The options of the player of track `index`, with the ways to the tracks around it. */
    private playerOptions(
        index: number,
    ): Omit<PlayerOptions, 'container' | 'media'> {
        const track = this.trackList[index];
        const own = trackOptions(
            track,
            index,
            this.options.player ?? {},
            this.words,
        );

        return { ...own, tracks: this.ways(index) };
    }

    /** The tracks around track `index`, for its player's buttons, keys and media controls. */
    private ways(index: number): PlayerTracks {
        return {
            previous: () => this.previous(),
            next: () => this.next(),
            hasPrevious: () =>
                previousTrack(this.orderList, index, this.repeatMode) !== null,
            hasNext: () =>
                nextTrack(this.orderList, index, this.repeatMode) !== null,
        };
    }

    /** Keeps the current track, the shuffle and the repeat, when `remember` is on. */
    private keep(): void {
        const track = this.trackList[this.current];

        if (track !== undefined) {
            this.store?.keep({
                track: track.id,
                shuffle: this.shuffleOn,
                repeat: this.repeatMode,
            });
        }
    }

    private cancelWait(): void {
        if (this.wait !== null) {
            clearTimeout(this.wait);
            this.wait = null;
        }
    }

    /** Tells the app's listeners of an error, never while the playlist is gone. */
    private fail(error: unknown): void {
        if (!this.destroyed) {
            this.events.emit(
                'error',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }
}

/** `address` resolved against the page, or undefined when it cannot be. */
function pageAddress(address: string): string | undefined {
    try {
        return new URL(address, document.baseURI).href;
    } catch {
        return undefined;
    }
}

/** Makes a playlist (see `PlaylistOptions`). */
export function createPlaylist(options: PlaylistOptions): Playlist {
    return new Playlist(options);
}
