/**
 * Where a playlist keeps what it remembers (`remember`): the page's `localStorage` or the app's own
 * storage, under `sonicframe:playlist` (or `sonicframe:playlist:<key>`). The storage may fail at any call (a private window, a full or
 * blocked storage): then the playlist simply does not remember.
 */

import type { RememberStore } from '../../core/player/remember';
import type { Repeat } from '../../core/playlist/order';
import {
    readPlaylistMemory,
    writePlaylistMemory,
    type PlaylistMemory,
} from '../../core/playlist/playlist-memory';
import type { PlaylistRemember } from './playlist-options';

/** The longest key, in characters. */
const MAX_KEY = 2000;

/** The page's own storage, or null where the page may not use it. */
function pageStore(): RememberStore | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

export class PlaylistStore {
    private constructor(
        private readonly store: RememberStore,
        private readonly name: string,
    ) {}

    /** The storage `remember` asks for; null while it is off or there is nowhere to keep it. */
    static of(
        remember: boolean | PlaylistRemember | undefined,
    ): PlaylistStore | null {
        if (remember === undefined || remember === false) {
            return null;
        }

        const own = remember === true ? {} : remember;
        const store = own.store ?? pageStore();
        // Apart from the players' names (`sonicframe:<key>`), so one key can serve both.
        const name =
            typeof own.key === 'string' && own.key.trim() !== ''
                ? `sonicframe:playlist:${own.key.slice(0, MAX_KEY)}`
                : 'sonicframe:playlist';

        return store === null ? null : new PlaylistStore(store, name);
    }

    /** What was kept, each value checked; nothing when the storage fails. */
    read(): PlaylistMemory {
        try {
            return readPlaylistMemory(this.store.getItem(this.name));
        } catch {
            return readPlaylistMemory(null);
        }
    }

    keep(memory: { track: string; shuffle: boolean; repeat: Repeat }): void {
        try {
            this.store.setItem(this.name, writePlaylistMemory(memory));
        } catch {
            // Nowhere to keep it: the next visit starts as the options say.
        }
    }

    forget(): void {
        try {
            this.store.removeItem(this.name);
        } catch {
            // Nothing was kept.
        }
    }
}
