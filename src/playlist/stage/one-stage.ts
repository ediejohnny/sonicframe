/**
 * The `'one'` layout: one media element and one player, made anew for each track. The media keeps
 * its volume and mute from track to track; the speed is put back after `load()`, which the browser
 * resets to the default speed. The keyboard focus inside the player goes to the same part of the
 * next one. The app's media stays the app's: the playlist never takes it off.
 */

import type { Track } from '../../core/playlist/tracks';
import { focusClass, focusedClass } from '../../dom/a11y/kept-focus';
import { css } from '../../dom/shared/css';
import { createPlayer, type Player } from '../../player/player/player';
import { playedOf, start, type Stage, type StageHost } from './stage';

/** The part that takes the focus when the focused one has no match: the play button. */
const PLAY = 'sonicframe-play';

export class OneStage implements Stage {
    readonly element: HTMLElement;
    private current: Player | null = null;
    private tracks: readonly Track[] = [];
    /** The track the media holds now, and its place in the tracks. */
    private loaded: Track | null = null;
    private index = -1;

    constructor(
        private readonly media: HTMLMediaElement,
        private readonly host: StageHost,
        signal: AbortSignal,
    ) {
        this.element = document.createElement('div');
        this.element.className = 'sonicframe-playlist-player';
        css(this.element, [['min-width', '0']]);
        media.addEventListener('ended', () => host.ended(), { signal });
        media.addEventListener(
            'timeupdate',
            () => host.progress(playedOf(media)),
            { signal },
        );
    }

    player(): Player | null {
        return this.current;
    }

    setTracks(tracks: readonly Track[], index: number): void {
        this.tracks = tracks;

        if (index < 0) {
            this.current?.destroy();
            this.current = null;
            this.loaded = null;
            this.index = -1;
        } else if (tracks[index] === this.loaded) {
            this.index = index;
            this.refresh();
        } else {
            this.load(index);
        }
    }

    show(index: number, play: boolean): void {
        if (this.tracks[index] !== this.loaded) {
            this.load(index);
        }

        if (play) {
            start(this.media);
        }
    }

    restart(): void {
        this.media.currentTime = 0;
        start(this.media);
    }

    refresh(): void {
        if (this.index >= 0) {
            this.current?.setTracks(this.host.options(this.index).tracks);
        }
    }

    destroy(): void {
        this.current?.destroy();
        this.current = null;
        this.element.remove();
    }

    /** The player of track `index` on the media, which loads the track's address. */
    private load(index: number): void {
        const media = this.media;
        const rate = media.playbackRate;
        const options = this.host.options(index);
        const focused =
            this.current === null
                ? null
                : focusedClass(this.current.element, PLAY);
        this.current?.destroy();
        this.loaded = this.tracks[index] ?? null;
        this.index = index;
        // The track's address passed `safeUrl` when the tracks were read.
        media.src = options.src ?? '';
        // `load()` puts the speed back to the default one: the speed playing becomes the default.
        media.defaultPlaybackRate = rate;
        media.load();
        this.current = createPlayer({
            ...options,
            container: this.element,
            media,
        });

        if (focused !== null) {
            focusClass(this.current.element, focused, PLAY);
        }
    }
}
