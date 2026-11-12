/**
 * Where a playlist's players live (`layout`): one player on one media element, made anew for each
 * track (`OneStage`), or a player for each track, one under the other (`EachStage`). The playlist
 * says which track is current; the stage plays it and tells back what its media does. A track is
 * known by itself, not by its place, so tracks added or moved around it never stop it.
 */

import type { Track } from '../../core/playlist/tracks';
import type { Player } from '../../player/player/player';
import type { PlayerOptions } from '../../player/player/player-options';

/** What a stage needs from its playlist. */
export type StageHost = {
    /** The options of the player of track `index`, with its address and the tracks around it. */
    options(index: number): Omit<PlayerOptions, 'container' | 'media'>;
    /** The current track ended by itself. */
    ended(): void;
    /** A player of a stack started playing track `index` from its own play button. */
    started(index: number): void;
    /** The current track played so far, from 0 to 1, or null while its length is unknown. */
    progress(played: number | null): void;
};

export type Stage = {
    /** The stage's element, in the playlist. */
    readonly element: HTMLElement;
    /** The player of the current track, or null when there is none. */
    player(): Player | null;
    /** Takes the tracks as they are now, `index` the current one (-1 for none). */
    setTracks(tracks: readonly Track[], index: number): void;
    /** Makes track `index` the current one, playing it when asked; the track playing goes on. */
    show(index: number, play: boolean): void;
    /** Starts the current track over and plays it. */
    restart(): void;
    /** Tells each player the tracks around it again (the order or the repeat changed). */
    refresh(): void;
    destroy(): void;
};

/** Plays `media`, never failing out loud: a browser that refuses (no gesture yet) leaves it paused. */
export function start(media: HTMLMediaElement | null): void {
    media?.play()?.catch(() => undefined);
}

/** How much of `media` has played, from 0 to 1, or null while its length is unknown. */
export function playedOf(media: HTMLMediaElement): number | null {
    const duration = media.duration;

    return Number.isFinite(duration) && duration > 0
        ? media.currentTime / duration
        : null;
}
