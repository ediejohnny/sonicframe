/**
 * The `'each'` layout: a player for each track, one under the other, each on its own media (a feed
 * of voice messages, say). One plays at a time: the one that starts pauses the others, and takes
 * their volume, mute and speed. Players are kept by track, so tracks added or moved around them go
 * on playing.
 */

import type { Track } from '../../core/playlist/tracks';
import { css } from '../../dom/shared/css';
import { createPlayer, type Player } from '../../player/player/player';
import { playedOf, start, type Stage, type StageHost } from './stage';

type Kept = { player: Player; stop: AbortController };

export class EachStage implements Stage {
    readonly element: HTMLElement;
    private readonly kept = new Map<Track, Kept>();
    private tracks: readonly Track[] = [];
    private current: Track | null = null;

    constructor(private readonly host: StageHost) {
        this.element = document.createElement('div');
        this.element.className = 'sonicframe-playlist-players';
        css(this.element, [
            ['display', 'flex'],
            ['flex-direction', 'column'],
            ['gap', '0.5rem'],
            ['min-width', '0'],
        ]);
    }

    player(): Player | null {
        return this.current === null
            ? null
            : (this.kept.get(this.current)?.player ?? null);
    }

    setTracks(tracks: readonly Track[], index: number): void {
        this.tracks = tracks;

        for (const [track, { player, stop }] of this.kept) {
            if (!tracks.includes(track)) {
                stop.abort();
                player.destroy();
                this.kept.delete(track);
            }
        }

        tracks.forEach((track, at) => {
            const kept = this.kept.get(track) ?? this.make(track, at);
            this.element.append(kept.player.element);
        });
        this.current = tracks[index] ?? null;
        this.refresh();
    }

    show(index: number, play: boolean): void {
        const before = this.player()?.media ?? null;
        this.current = this.tracks[index] ?? null;
        const media = this.player()?.media ?? null;

        if (before !== null && media !== null && before !== media) {
            media.volume = before.volume;
            media.muted = before.muted;
            media.playbackRate = before.playbackRate;
            before.pause();
        }

        if (play) {
            start(media);
        }
    }

    restart(): void {
        const media = this.player()?.media ?? null;

        if (media !== null) {
            media.currentTime = 0;
            start(media);
        }
    }

    refresh(): void {
        this.tracks.forEach((track, at) =>
            this.kept
                .get(track)
                ?.player.setTracks(this.host.options(at).tracks),
        );
    }

    destroy(): void {
        for (const { player, stop } of this.kept.values()) {
            stop.abort();
            player.destroy();
        }

        this.kept.clear();
        this.element.remove();
    }

    /** The player of `track` (at `at` now), listened to for as long as it is kept. */
    private make(track: Track, at: number): Kept {
        const player = createPlayer({
            ...this.host.options(at),
            container: this.element,
        });
        const stop = new AbortController();
        const media = player.media;
        const mine = (): boolean => this.current === track;

        media?.addEventListener(
            'play',
            () => {
                if (!mine()) {
                    this.host.started(this.tracks.indexOf(track));
                }
            },
            { signal: stop.signal },
        );
        media?.addEventListener(
            'ended',
            () => {
                if (mine()) {
                    this.host.ended();
                }
            },
            { signal: stop.signal },
        );
        media?.addEventListener(
            'timeupdate',
            () => {
                if (mine() && media !== null) {
                    this.host.progress(playedOf(media));
                }
            },
            { signal: stop.signal },
        );
        const kept = { player, stop };
        this.kept.set(track, kept);

        return kept;
    }
}
