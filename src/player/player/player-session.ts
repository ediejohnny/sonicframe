/**
 * The system's media controls for a player, made once so they outlive every rebuild: titled by the
 * player's name, skipping by the look's seconds as they are at each press, and, with chapters, the
 * previous and next track going to the chapter before and after while the controls list them. The
 * app's own choices win over each of these.
 */

import type { Chapter } from '../../core/chapters/chapters';
import type { PlayerLook } from '../../core/player/look';
import type { ChaptersPlugin } from '../../plugins/chapters/chapters-options';
import {
    mediaSession,
    type MediaSessionPlugin,
} from '../../plugins/media-session/media-session';
import type { PlayerOptions } from './player-options';

/** What the controls take from their player. */
export type SessionHost = {
    /** The look the player is built with now. */
    look(): PlayerLook;
    /** The player's chapters, or null while they are off. */
    readonly chapters: ChaptersPlugin | null;
};

export class PlayerSession {
    /** The media session plugin, or null while the option is off. */
    readonly plugin: MediaSessionPlugin | null;
    /** Whether the controls follow the player's chapters. */
    private readonly followChapters: boolean;

    constructor(options: PlayerOptions, host: SessionHost) {
        const asked = options.mediaSession;
        const { chapters: follow, ...own } =
            asked === true || !asked ? {} : asked;
        const chapters = follow === false ? null : host.chapters;

        this.followChapters = chapters !== null;
        this.plugin = asked
            ? mediaSession({
                  ...own,
                  title: own.title ?? options.label,
                  seekOffset: own.seekOffset ?? (() => host.look().skip),
                  onPrevious:
                      own.onPrevious ??
                      (chapters === null
                          ? undefined
                          : () => chapters.previous()),
                  onNext:
                      own.onNext ??
                      (chapters === null ? undefined : () => chapters.next()),
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
