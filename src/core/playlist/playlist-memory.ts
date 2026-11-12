/**
 * What a playlist remembers between visits, without the page: the track it was on (by its id), the
 * shuffle and the repeat. The storage is outside input, so each value is read back checked on its own.
 */

import { isRecord } from '../shared/checked';
import { REPEATS, type Repeat } from './order';

/** What a playlist kept, each value null when nothing good was kept. */
export type PlaylistMemory = {
    track: string | null;
    shuffle: boolean | null;
    repeat: Repeat | null;
};

/** The longest track id read back, in characters. */
const MAX_ID = 2000;

/** What a storage holds, read back: anything that is not what it should be is null. */
export function readPlaylistMemory(text: string | null): PlaylistMemory {
    let value: unknown = null;

    try {
        value = JSON.parse(text ?? 'null');
    } catch {
        value = null;
    }

    if (!isRecord(value)) {
        return { track: null, shuffle: null, repeat: null };
    }

    const { track, shuffle, repeat } = value;

    return {
        track:
            typeof track === 'string' && track !== '' && track.length <= MAX_ID
                ? track
                : null,
        shuffle: typeof shuffle === 'boolean' ? shuffle : null,
        repeat: REPEATS.find((name) => name === repeat) ?? null,
    };
}

/** What a playlist keeps, as text for the storage. */
export function writePlaylistMemory(memory: {
    track: string;
    shuffle: boolean;
    repeat: Repeat;
}): string {
    return JSON.stringify(memory);
}
