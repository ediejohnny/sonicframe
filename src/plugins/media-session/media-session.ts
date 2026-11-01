/**
 * The system's media controls for a frame's media: the lock screen, the notification and the media
 * keys show the sound's title, artist, album and pictures (and its chapters, where the browser lists
 * them), and play, pause, skip, seek and stop it. A page has one session: the media that played last
 * owns it, and the others leave it alone until they play. The details are checked before they leave
 * (see `sessionMetadata`), and the position is sent only when the sound has a known length. Where the
 * browser has no session, the plugin does nothing.
 */

import {
    sessionMetadata,
    sessionPosition,
    type MediaSessionDetails,
} from '../../core/session/media-session';
import { isOneOf, within } from '../../core/shared/checked';
import { clamp01, positive } from '../../core/shared/math';
import { skipRatio } from '../../core/shared/steps';
import type { Plugin, PluginHost } from '../../types';

/** A control the plugin can offer, besides the previous and next track. */
export type MediaSessionActionName =
    | 'play'
    | 'pause'
    | 'seekbackward'
    | 'seekforward'
    | 'seekto'
    | 'stop';

/** The controls offered unless the app picks some. */
export const MEDIA_SESSION_ACTIONS: readonly MediaSessionActionName[] =
    Object.freeze([
        'play',
        'pause',
        'seekbackward',
        'seekforward',
        'seekto',
        'stop',
    ]);

/** Every control a session knows; those not offered are cleared, so another media's never linger. */
const EVERY_ACTION: readonly MediaSessionAction[] = [
    ...MEDIA_SESSION_ACTIONS,
    'previoustrack',
    'nexttrack',
];

export type MediaSessionOptions = MediaSessionDetails & {
    /**
     * The seconds a skip moves when the controls give no step of their own: 10 by default, from 1 to
     * 120. A function is asked at each skip.
     */
    seekOffset?: number | (() => number);
    /** The controls offered; all six (`MEDIA_SESSION_ACTIONS`) by default. */
    actions?: readonly MediaSessionActionName[];
    /** Called by the previous track control; without it, the controls leave that button out. */
    onPrevious?: () => void;
    /** Called by the next track control; without it, the controls leave that button out. */
    onNext?: () => void;
};

export type MediaSessionPlugin = Plugin & {
    /** Whether this frame's media owns the page's session now. */
    readonly active: boolean;
    /**
     * Changes the details given (those left out or undefined stay); the controls show them at once
     * while it owns the session.
     */
    set(details: MediaSessionDetails): void;
};

/** The plugin whose media owns the page's session, or null. */
let owner: MediaSessionPlugin | null = null;

/** The page's session, or null where the browser has none. */
function pageSession(): MediaSession | null {
    return typeof navigator !== 'undefined' &&
        'mediaSession' in navigator &&
        typeof MediaMetadata !== 'undefined'
        ? navigator.mediaSession
        : null;
}

/** Sets one control's handler; a control this browser does not know throws, and is left out. */
function handle(
    session: MediaSession,
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
): void {
    try {
        session.setActionHandler(action, handler);
    } catch {
        // Not known here: the controls simply lack it.
    }
}

/** Clears the page's session: the details, the state, the position and every control. */
function clear(session: MediaSession): void {
    for (const action of EVERY_ACTION) {
        handle(session, action, null);
    }

    session.metadata = null;
    session.playbackState = 'none';

    try {
        session.setPositionState();
    } catch {
        // A browser without positions has none to clear.
    }
}

export function mediaSession(
    options: MediaSessionOptions = {},
): MediaSessionPlugin {
    const offered = new Set(
        (options.actions ?? MEDIA_SESSION_ACTIONS).filter((action) =>
            isOneOf(action, MEDIA_SESSION_ACTIONS),
        ),
    );
    let details: MediaSessionDetails = {
        title: options.title,
        artist: options.artist,
        album: options.album,
        artwork: options.artwork,
        chapters: options.chapters,
    };
    let host: PluginHost | null = null;
    let stops: (() => void)[] = [];

    /** The session, while this plugin's media owns it. */
    function owned(): MediaSession | null {
        return owner === plugin && host !== null ? pageSession() : null;
    }

    /** The seconds of a skip: the controls' own step, or the plugin's. */
    function offset(asked: number | undefined): number {
        const own =
            typeof options.seekOffset === 'function'
                ? options.seekOffset()
                : options.seekOffset;

        return positive(asked) ?? within(own, 10, 1, 120);
    }

    /** Moves by `seconds` from the position shown (back when negative). */
    function skip(seconds: number): void {
        const known = positive(host?.duration);

        if (host !== null && known !== null) {
            host.seekTo(
                skipRatio(host.progress * known, seconds, known),
                'api',
            );
        }
    }

    /**
     * Goes to `time`, through the media's fast seek when the controls ask for it and it has one. A
     * fast seek skips the frame, so it first lets go of a stretch playing (a region's loop), which
     * would otherwise pull the sound back while the person drags.
     */
    function seek(time: number | undefined, fast: boolean): void {
        const media = host?.media ?? null;
        const known = positive(host?.duration);

        if (host === null || media === null || known === null) {
            return;
        }

        const ratio = clamp01((time ?? 0) / known);

        if (fast && typeof media.fastSeek === 'function') {
            host.stopRange();
            media.fastSeek(ratio * known);
        } else {
            host.seekTo(ratio, 'api');
        }
    }

    const actions: Record<MediaSessionActionName, MediaSessionActionHandler> = {
        play: () => {
            host?.media?.play().catch((error: unknown) => {
                host?.reportError(error);
            });
        },
        pause: () => host?.media?.pause(),
        seekbackward: (asked) => skip(-offset(asked.seekOffset)),
        seekforward: (asked) => skip(offset(asked.seekOffset)),
        seekto: (asked) => seek(asked.seekTime, asked.fastSeek === true),
        stop: () => {
            host?.media?.pause();
            host?.seekTo(0, 'api');
        },
    };

    /** The handler of a control, or null when it is not offered. */
    function handlerOf(
        action: MediaSessionAction,
    ): MediaSessionActionHandler | null {
        if (action === 'previoustrack' || action === 'nexttrack') {
            const call =
                action === 'previoustrack'
                    ? options.onPrevious
                    : options.onNext;

            return call === undefined ? null : () => call();
        }

        return isOneOf(action, MEDIA_SESSION_ACTIONS) && offered.has(action)
            ? actions[action]
            : null;
    }

    function showDetails(session: MediaSession): void {
        session.metadata = new MediaMetadata(
            sessionMetadata(details) as MediaMetadataInit,
        );
    }

    /** Playing or paused, and where the sound is. */
    function showState(session: MediaSession): void {
        const media = host?.media ?? null;

        if (media !== null) {
            session.playbackState = media.paused ? 'paused' : 'playing';
        }

        showPosition(session);
    }

    function showPosition(session: MediaSession): void {
        const media = host?.media ?? null;
        const position =
            media === null
                ? null
                : sessionPosition(
                      host?.duration ?? null,
                      media.currentTime,
                      media.playbackRate,
                  );

        if (position !== null) {
            try {
                session.setPositionState(position);
            } catch {
                // A browser without positions shows none.
            }
        }
    }

    /** The page's session becomes this media's: its details, its controls, its state. */
    function take(): void {
        const session = pageSession();

        if (session === null || host === null) {
            return;
        }

        owner = plugin;

        for (const action of EVERY_ACTION) {
            handle(session, action, handlerOf(action));
        }

        showDetails(session);
        showState(session);
    }

    /** Runs `show` on the session while this media owns it. */
    function whileOwned(show: (session: MediaSession) => void): () => void {
        return () => {
            const session = owned();

            if (session !== null) {
                show(session);
            }
        };
    }

    const plugin: MediaSessionPlugin = {
        name: 'media-session',

        get active(): boolean {
            return owner === plugin;
        },

        set(next): void {
            // A detail left undefined keeps the one before.
            const given = Object.entries(next).filter(
                ([, value]) => value !== undefined,
            );
            details = { ...details, ...Object.fromEntries(given) };
            whileOwned(showDetails)();
        },

        setup(frame): void {
            host = frame;
            const media = frame.media;

            if (media === null || pageSession() === null) {
                return;
            }

            const listen = (type: string, listener: () => void): void => {
                media.addEventListener(type, listener);
                stops.push(() => media.removeEventListener(type, listener));
            };

            listen('play', take);
            listen('pause', whileOwned(showState));
            listen('ended', whileOwned(showState));

            for (const type of ['seeked', 'ratechange', 'durationchange']) {
                listen(type, whileOwned(showPosition));
            }

            // The frame can know a duration the media does not yet (one given with the peaks).
            stops.push(frame.on('durationchange', whileOwned(showPosition)));

            if (!media.paused) {
                take();
            }
        },

        destroy(): void {
            for (const stop of stops.splice(0)) {
                stop();
            }

            if (owner === plugin) {
                owner = null;
                const session = pageSession();

                if (session !== null) {
                    clear(session);
                }
            }

            host = null;
        },
    };

    return plugin;
}
