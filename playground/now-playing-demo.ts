/**
 * The now-playing page's demo: a player of the site's first song in `data-demo="now-playing"`, and
 * the bar, which comes up when that player plays out of view.
 */

import { createPlayer, loadWaveform } from '../src/player';
import { nowPlaying } from '../src/playlist';
import { MUSIC } from './docs/sounds';

const demo = document.querySelector<HTMLElement>('[data-demo="now-playing"]');
const song = MUSIC[0];

if (demo !== null && song !== undefined) {
    createPlayer({
        container: demo,
        src: song.audio,
        peaks: () => loadWaveform(song.peaks),
        a11y: { label: `${song.title} by ${song.artist}` },
    });
    nowPlaying({
        parts: ['play', 'title', 'time', 'progress', 'back', 'close'],
    });
}
