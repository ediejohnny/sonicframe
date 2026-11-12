/**
 * The playlist page's demos: a playlist built from a `data-demo="playlist"` element's `data-options`
 * (any playlist option that JSON can hold), over the site's three songs with their ready-made peaks,
 * and the `<sonic-playlist>` tag. A line after a demo, `[data-track]`, says the track playing.
 */

import { createPlaylist, defineSonicPlaylist } from '../src/playlist';
import type { PlaylistOptions, TrackInput } from '../src/playlist';
import { MUSIC } from './docs/sounds';

/** The site's songs as tracks: their titles, artists and peaks files. */
const SONGS: readonly TrackInput[] = MUSIC.map((song) => ({
    src: song.audio,
    title: song.title.replace(/[“”]/g, ''),
    artist: song.artist,
    peaks: song.peaks,
}));

/** Writes the track playing in the line that follows `demo`. */
function tell(demo: Element, text: string): void {
    const line = demo.nextElementSibling;

    if (line instanceof HTMLElement && line.hasAttribute('data-track')) {
        line.textContent = text;
    }
}

for (const demo of document.querySelectorAll<HTMLElement>(
    '[data-demo="playlist"]',
)) {
    let options: Partial<PlaylistOptions> = {};

    try {
        options = JSON.parse(demo.dataset.options ?? '{}');
    } catch {
        options = {};
    }

    const playlist = createPlaylist({
        ...options,
        container: demo,
        tracks: SONGS,
    });
    playlist.on('trackchange', (track, index) =>
        tell(
            demo,
            `Track ${index + 1} of ${playlist.tracks.length}: ${track.title}.`,
        ),
    );
}

defineSonicPlaylist();
