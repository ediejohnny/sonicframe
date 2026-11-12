/**
 * The system's media controls for a player, made once so they outlive every rebuild: titled by the
 * player's name, skipping by the look's seconds as they are at each press, and stepping with the
 * previous and next track buttons through the player's tracks or, without them, its chapters (while
 * the controls list those). `previousNext` picks which, and the app's own choices win over each of
 * these.
 */

import type { Chapter } from '../../core/chapters/chapters';
import { oneOf } from '../../core/shared/checked';
import type { PlayerLook } from '../../core/player/look';
import type { ChaptersPlugin } from '../../plugins/chapters/chapters-options';
import {
    mediaSession,
    type MediaSessionPlugin,
} from '../../plugins/media-session/media-session';
import { goTrack } from '../parts/track-buttons';
import type { PlayerOptions, PlayerTracks } from './player-options';

/** What the controls take from their player. */
export type SessionHost = {
    /** The look the player is built with now. */
    look(): PlayerLook;
    /** The player's chapters, or null while they are off. */
    readonly chapters: ChaptersPlugin | null;
    /** The tracks around the sound now, while the player has them. */
    tracks(): PlayerTracks | undefined;
};

/** What the previous and next track controls step through, when they step at all. */
const STEPS = ['auto', 'tracks', 'chapters'] as const;

type Steps = (typeof STEPS)[number] | false;

export class PlayerSession {
    /** The media session plugin, or null while the option is off. */
    readonly plugin: MediaSessionPlugin | null;
    /** Whether the controls follow the player's chapters. */
    private readonly followChapters: boolean;

    constructor(options: PlayerOptions, host: SessionHost) {
        const asked = options.mediaSession;
        const {
            chapters: follow,
            previousNext,
            ...own
        } = asked === true || !asked ? {} : asked;
        const chapters = follow === false ? null : host.chapters;
        const steps: Steps =
            previousNext === false ? false : oneOf(previousNext, STEPS, 'auto');

        /**
         * The control that steps `way`: through the tracks when they are asked for (or, on `'auto'`,
         * when the player has that way at the press), otherwise through the chapters. The control is
         * there only when the player is made with tracks that go that way, or with chapters: a
         * button that does nothing never shows on the lock screen.
         */
        const step = (way: 'previous' | 'next'): (() => void) | undefined => {
            const byTracks =
                (steps === 'tracks' || steps === 'auto') &&
                host.tracks()?.[way] !== undefined;
            const byChapters =
                (steps === 'chapters' || steps === 'auto') && chapters !== null;

            if (!byTracks && !byChapters) {
                return undefined;
            }

            return () => {
                const tracks = host.tracks();
                const part = way === 'previous' ? 'previousTrack' : 'nextTrack';

                if (byTracks && tracks?.[way] !== undefined) {
                    goTrack(tracks, part);
                } else if (byChapters) {
                    if (way === 'previous') {
                        chapters?.previous();
                    } else {
                        chapters?.next();
                    }
                }
            };
        };

        this.followChapters = chapters !== null;
        this.plugin = asked
            ? mediaSession({
                  ...own,
                  title: own.title ?? options.a11y?.label ?? options.label,
                  artist: own.artist ?? options.artist,
                  seekOffset: own.seekOffset ?? (() => host.look().skip),
                  onPrevious: own.onPrevious ?? step('previous'),
                  onNext: own.onNext ?? step('next'),
              })
            : null;
    }

    /** Hands the chapters the player shows to the controls, while they follow them. */
    listed(chapters: readonly Chapter[]): void {
        if (this.followChapters) {
            this.plugin?.set({ chapters });
        }
    }
}
