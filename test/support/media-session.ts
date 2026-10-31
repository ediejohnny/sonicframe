/**
 * Stand-ins for the system's media controls, which happy-dom lacks: a session that keeps what the
 * page told it and refuses what a browser refuses (an action it does not know, a position outside
 * the sound), and a media element that really plays and pauses. Each is taken off after the test.
 */

import { vi } from 'vite-plus/test';
import { afterTest, FakeMedia } from './helpers';

/** Every action a browser's session knows. */
export const ALL_ACTIONS: readonly string[] = [
    'play',
    'pause',
    'seekbackward',
    'seekforward',
    'seekto',
    'stop',
    'previoustrack',
    'nexttrack',
];

type Handler = (details: Record<string, unknown>) => void;

/** What the page put in `metadata`: the fields given to `MediaMetadata`. */
export type SentMetadata = {
    title: string;
    artist: string;
    album: string;
    artwork: { src: string; sizes?: string; type?: string }[];
    chapterInfo?: { title: string; startTime: number; artwork: unknown[] }[];
};

export class FakeSession {
    metadata: SentMetadata | null = null;
    playbackState: 'none' | 'paused' | 'playing' = 'none';
    /** The handler of each action, as last set (null: cleared). */
    readonly handlers: Map<string, Handler | null> = new Map();
    /** Every position sent, in order; undefined clears it. */
    readonly positions: (
        | { duration: number; position: number; playbackRate: number }
        | undefined
    )[] = [];

    constructor(private readonly known: readonly string[]) {}

    setActionHandler(action: string, handler: Handler | null): void {
        if (!this.known.includes(action)) {
            throw new TypeError(`test: unknown action "${action}"`);
        }

        this.handlers.set(action, handler);
    }

    setPositionState(state?: {
        duration: number;
        position: number;
        playbackRate: number;
    }): void {
        if (
            state !== undefined &&
            (!(state.duration >= 0) ||
                !(state.position >= 0) ||
                state.position > state.duration ||
                state.playbackRate === 0)
        ) {
            throw new TypeError('test: a position the session refuses');
        }

        this.positions.push(state);
    }

    /** Presses a control, as the system does: the handler hears the action and its details. */
    press(action: string, details: Record<string, unknown> = {}): void {
        const handler = this.handlers.get(action);

        if (typeof handler !== 'function') {
            throw new Error(`test: no handler for "${action}"`);
        }

        handler({ action, ...details });
    }
}

/** `MediaMetadata` keeps the fields it is given. */
class FakeMetadata {
    constructor(init: SentMetadata) {
        Object.assign(this, init);
    }
}

/** Gives the page a media session that knows `known` actions (all by default), until the test ends. */
export function stubSession(
    known: readonly string[] = ALL_ACTIONS,
): FakeSession {
    const session = new FakeSession(known);
    Object.defineProperty(navigator, 'mediaSession', {
        configurable: true,
        value: session,
    });
    vi.stubGlobal('MediaMetadata', FakeMetadata);
    afterTest({
        destroy: () => {
            Reflect.deleteProperty(navigator, 'mediaSession');
            vi.unstubAllGlobals();
        },
    });

    return session;
}

/** A media element that plays and pauses, with the events a browser fires. */
export class PlayableMedia extends FakeMedia {
    /** What `play()` rejects with; null plays. */
    refuse: Error | null = null;
    /** The times `fastSeek` was asked for. */
    readonly fastSeeks: number[] = [];
    private playing = false;

    override get paused(): boolean {
        return !this.playing;
    }

    play(): Promise<void> {
        if (this.refuse !== null) {
            return Promise.reject(this.refuse);
        }

        if (!this.playing) {
            this.playing = true;
            this.fire('play');
        }

        return Promise.resolve();
    }

    pause(): void {
        if (this.playing) {
            this.playing = false;
            this.fire('pause');
        }
    }

    fastSeek(time: number): void {
        this.fastSeeks.push(time);
        this.currentTime = time;
    }
}

/** A media element of `duration` seconds that plays; cast to the DOM type the options expect. */
export function playableMedia(
    duration: number = 100,
): HTMLMediaElement & PlayableMedia {
    return new PlayableMedia({ duration }) as HTMLMediaElement & PlayableMedia;
}
