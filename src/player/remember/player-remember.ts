/**
 * A player that remembers between visits: the volume, the mute and the speed come back when it is
 * built, and a sound resumes where it was left once its length is known (unless it is under way
 * already, or was left near its end). The position is kept on a pause, a seek, about every 5 seconds
 * of playing, when the page goes and when the player goes, and forgotten when the sound ends. The
 * storage is outside input and may fail at any call (a private window, a full or blocked storage):
 * then the player simply does not remember. With `announce`, the first play after a resume says where.
 */

import type { PlayerWords } from '../../core/player/labels';
import {
    forgetPosition,
    keepPosition,
    MIN_POSITION,
    readRemembered,
    resolveRemember,
    resumeAt,
    writeRemembered,
    type Remembered,
    type RememberSettings,
    type RememberStore,
} from '../../core/player/remember';
import { formatTime } from '../../core/shared/timing';
import { announce } from '../../dom/a11y/announce';
import type { SonicFrame } from '../../dom/frame/frame';
import type { PlayerOptions } from '../player/player-options';

/** What remembering needs from its player. */
export type MemoryHost = {
    readonly media: HTMLMediaElement | null;
    readonly words: PlayerWords;
    /** The wave built now; null while none is. */
    frame(): SonicFrame | null;
    /** Calls `listener` whenever the sound's length changes; returns the function that stops it. */
    onDuration(listener: () => void): () => void;
    /** Tells the player's listeners a sound resumed at `time` seconds. */
    resumed(time: number): void;
};

/** Seconds of playing between two positions kept. */
const EVERY = 5;

/** The page's own storage, or null where the page may not use it. */
function pageStore(): RememberStore | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/** The memory a player's options ask for, on `host`; null while it is off or there is nowhere to keep it. */
export function playerMemory(
    options: Pick<PlayerOptions, 'remember' | 'src' | 'a11y'>,
    host: MemoryHost,
): PlayerMemory | null {
    const settings = resolveRemember(options.remember);
    const own =
        typeof options.remember === 'object'
            ? options.remember.store
            : undefined;
    const store = own ?? pageStore();

    if (settings === null || store === null || host.media === null) {
        return null;
    }

    return new PlayerMemory(
        host,
        host.media,
        settings,
        store,
        settings.sound ?? options.src ?? (host.media.currentSrc || null),
        options.a11y?.remember?.announce === true,
    );
}

export class PlayerMemory {
    private readonly name: string;
    /** The time last kept, in seconds of the sound. */
    private keptAt = 0;
    /** Where the sound resumed, until the first play says it. */
    private toSay: number | null = null;
    private readonly stops: (() => void)[] = [];

    constructor(
        private readonly host: MemoryHost,
        private readonly media: HTMLMediaElement,
        private readonly settings: RememberSettings,
        private readonly store: RememberStore,
        /** The sound's name for its position, or null when it has none. */
        private readonly sound: string | null,
        private readonly announcing: boolean,
    ) {
        this.name = `sonicframe:${settings.key}`;
        this.bringBack(this.read());

        const listen = (type: string, listener: () => void): void => {
            media.addEventListener(type, listener);
            this.stops.push(() => media.removeEventListener(type, listener));
        };

        listen('volumechange', this.keepVolume);
        listen('ratechange', this.keepSpeed);
        listen('pause', this.keepPosition);
        listen('seeked', this.keepPosition);
        listen('timeupdate', this.keepWhilePlaying);
        listen('ended', this.forgetSound);
        listen('play', this.sayResumed);
        window.addEventListener('pagehide', this.keepPosition);
        this.stops.push(() =>
            window.removeEventListener('pagehide', this.keepPosition),
        );
        this.stops.push(host.onDuration(this.resume));
        this.resume();
    }

    /** Forgets everything kept under the player's name: positions, volume and speed. */
    forget(): void {
        try {
            this.store.removeItem(this.name);
        } catch {
            // A storage that refuses keeps what it had; nothing else depends on it.
        }
    }

    /** Keeps the position a last time and stops listening. */
    destroy(): void {
        this.keepPosition();

        for (const stop of this.stops.splice(0)) {
            stop();
        }
    }

    private read(): Remembered {
        try {
            return readRemembered(this.store.getItem(this.name));
        } catch {
            return readRemembered(null);
        }
    }

    private write(change: (kept: Remembered) => Remembered): void {
        try {
            this.store.setItem(this.name, writeRemembered(change(this.read())));
        } catch {
            // A full or blocked storage keeps nothing new; the player plays on.
        }
    }

    /** The volume, the mute and the speed kept before, on the media and on any load after. */
    private bringBack(kept: Remembered): void {
        const { media, settings } = this;

        if (settings.volume && kept.volume !== undefined) {
            media.volume = kept.volume;
        }

        if (settings.volume && kept.muted !== undefined) {
            media.muted = kept.muted;
        }

        if (settings.speed && kept.speed !== undefined) {
            media.defaultPlaybackRate = kept.speed;
            media.playbackRate = kept.speed;
        }
    }

    /** Goes where the sound was left, once its length is known and while it has not moved on its own. */
    private readonly resume = (): void => {
        const frame = this.host.frame();
        const duration = frame?.duration ?? null;

        if (
            !this.settings.position ||
            this.sound === null ||
            frame === null ||
            duration === null ||
            duration <= 0 ||
            this.media.currentTime >= MIN_POSITION
        ) {
            return;
        }

        const sound = this.sound;
        const saved =
            this.read().positions.find((kept) => kept.sound === sound)?.time ??
            null;
        const time = resumeAt(saved, duration, this.settings.nearEnd);

        if (time !== null) {
            frame.seekTo(time / duration);
            this.keptAt = time;
            this.toSay = time;
            queueMicrotask(() => this.host.resumed(time));
        }
    };

    private readonly keepVolume = (): void => {
        if (this.settings.volume) {
            const { volume, muted } = this.media;
            this.write((kept) => ({ ...kept, volume, muted }));
        }
    };

    private readonly keepSpeed = (): void => {
        if (this.settings.speed) {
            const speed = this.media.playbackRate;
            this.write((kept) => ({ ...kept, speed }));
        }
    };

    /** Keeps where the sound is; at its start, or once it ended, there is nothing to keep. */
    private readonly keepPosition = (): void => {
        const sound = this.sound;

        if (!this.settings.position || sound === null) {
            return;
        }

        const time = this.media.currentTime;
        this.keptAt = time;
        this.write((kept) =>
            time >= MIN_POSITION && !this.media.ended
                ? keepPosition(kept, sound, time, this.settings.sounds)
                : forgetPosition(kept, sound),
        );
    };

    private readonly keepWhilePlaying = (): void => {
        if (Math.abs(this.media.currentTime - this.keptAt) >= EVERY) {
            this.keepPosition();
        }
    };

    private readonly forgetSound = (): void => {
        const sound = this.sound;

        if (this.settings.position && sound !== null) {
            this.keptAt = 0;
            this.write((kept) => forgetPosition(kept, sound));
        }
    };

    private readonly sayResumed = (): void => {
        const time = this.toSay;
        this.toSay = null;

        if (this.announcing && time !== null) {
            announce(this.host.words.say('resume', { time: formatTime(time) }));
        }
    };
}
