/**
 * A track as its player's options and as an item of the list: the playlist's player options with the
 * track's address, title, peaks, length and chapters over them. The title names the player and the
 * media controls; a track without one is "Track 3".
 */

import type { PlaylistWords } from '../../core/languages/words';
import { loadWaveform } from '../../core/peaks/read-waveform';
import type { Track } from '../../core/playlist/tracks';
import { formatTime } from '../../core/shared/timing';
import { cleanText, fillTemplate } from '../../core/shared/text';
import type { MediaListItem } from '../../dom/list/media-list';
import type {
    PlayerChapters,
    PlayerOptions,
} from '../../player/player/player-options';
import type { PlaylistPlayer } from './playlist-options';

/** The longest title said or shown, in characters. */
const MAX_TITLE = 120;

/** The track's title, or "Track 3" for the third track without one. */
export function trackTitle(
    track: Track,
    index: number,
    words: PlaylistWords,
): string {
    return (
        track.title ||
        cleanText(
            fillTemplate(words.untitled, { place: String(index + 1) }),
            MAX_TITLE,
        )
    );
}

/** The track as an item of the list: its title, artist, picture and length. */
export function trackItem(
    track: Track,
    index: number,
    words: PlaylistWords,
): MediaListItem {
    return {
        title: trackTitle(track, index, words),
        span: track.artist || null,
        image: track.artwork,
        length: track.duration === null ? null : formatTime(track.duration),
        link: null,
    };
}

/** The chapters of the track's player: the track's file, with the playlist's chapter options. */
function chaptersOf(
    own: PlaylistPlayer['chapters'],
    file: string | null,
): PlayerOptions['chapters'] {
    if (file === null) {
        return own;
    }

    if (own === undefined || typeof own === 'string' || Array.isArray(own)) {
        return file;
    }

    const options = own as PlayerChapters;

    return { ...options, src: file, items: undefined, text: undefined };
}

/** The options of the track's player, but its place and media. */
export function trackOptions(
    track: Track,
    index: number,
    own: PlaylistPlayer,
    words: PlaylistWords,
): Omit<PlayerOptions, 'container' | 'media' | 'tracks'> {
    const title = trackTitle(track, index, words);
    const peaks = track.peaks;
    const session = own.mediaSession;

    return {
        ...own,
        src: track.src,
        peaks:
            peaks === null
                ? own.peaks
                : typeof peaks === 'string'
                  ? () => loadWaveform(peaks)
                  : peaks,
        duration: track.duration,
        chapters: chaptersOf(own.chapters, track.chapters),
        a11y: { ...own.a11y, label: own.a11y?.label ?? title },
        mediaSession:
            session === undefined || session === false
                ? session
                : {
                      ...(session === true ? {} : session),
                      title,
                      artist: track.artist || undefined,
                      album: track.album || undefined,
                      artwork: track.artwork ?? undefined,
                  },
    };
}
