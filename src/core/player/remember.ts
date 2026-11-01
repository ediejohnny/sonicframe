/**
 * What a player remembers between visits, without the page: which choices it keeps, what was kept
 * (read back with every value checked, since the storage is outside input), the positions of the last
 * sounds, newest first, and where a sound resumes.
 */

import { finiteOr, isRecord, within } from '../shared/checked';

/** A storage of text by name, as `localStorage` and `sessionStorage` are. */
export type RememberStore = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

/** What the player remembers, and where. */
export type PlayerRemember = {
    /** Where each sound was left: it resumes there. On with `remember: true`. */
    position?: boolean;
    /** The volume and the mute. On with `remember: true`. */
    volume?: boolean;
    /** The speed. On with `remember: true`. */
    speed?: boolean;
    /** The name the choices are kept under: players with the same name share their volume and speed. */
    key?: string;
    /** The sound's own name for its position (an episode's id); its address by default. */
    sound?: string;
    /** Where it is kept: the page's `localStorage` by default, or any storage of your own. */
    store?: RememberStore;
    /** How many sounds keep their position, the oldest dropped first: 50, from 1 to 500. */
    sounds?: number;
    /** A sound left this many seconds or less from its end starts over: 5, from 0 to 60. */
    nearEnd?: number;
};

/** What to remember, resolved. */
export type RememberSettings = {
    position: boolean;
    volume: boolean;
    speed: boolean;
    key: string;
    sound: string | null;
    sounds: number;
    nearEnd: number;
};

/** What is kept under one name: the volume, the mute, the speed, and the last sounds' positions. */
export type Remembered = {
    volume?: number;
    muted?: boolean;
    speed?: number;
    /** Newest first. */
    positions: { sound: string; time: number }[];
};

/** A position under this many seconds is the start of the sound: nothing to resume. */
export const MIN_POSITION = 1;

/** The longest name of a group or a sound, in characters. */
const MAX_NAME = 2000;

/** The most positions read back from the storage. */
const MAX_SOUNDS = 500;

/** A name from outside, or null when it is not one. */
function nameOf(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== ''
        ? value.slice(0, MAX_NAME)
        : null;
}

/** What to remember, or null while it is off (the default); strange values fall back to their defaults. */
export function resolveRemember(
    input: boolean | PlayerRemember | undefined,
): RememberSettings | null {
    if (input === undefined || input === false) {
        return null;
    }

    const own: PlayerRemember = input === true ? {} : input;

    return {
        position: own.position !== false,
        volume: own.volume !== false,
        speed: own.speed !== false,
        key: nameOf(own.key) ?? 'player',
        sound: nameOf(own.sound),
        sounds: within(own.sounds, 50, 1, MAX_SOUNDS, Math.round),
        nearEnd: within(own.nearEnd, 5, 0, 60),
    };
}

/** What a storage holds, read back: anything that is not what it should be is left out. */
export function readRemembered(text: string | null): Remembered {
    let value: unknown = null;

    try {
        value = JSON.parse(text ?? 'null');
    } catch {
        value = null;
    }

    const kept: Remembered = { positions: [] };

    if (!isRecord(value)) {
        return kept;
    }

    const volume = within(value.volume, null, 0, 1);
    const speed = within(value.speed, null, 0.25, 4);

    if (volume !== null) {
        kept.volume = volume;
    }

    if (typeof value.muted === 'boolean') {
        kept.muted = value.muted;
    }

    if (speed !== null) {
        kept.speed = speed;
    }

    const positions = Array.isArray(value.positions) ? value.positions : [];

    for (const saved of positions.slice(0, MAX_SOUNDS)) {
        const sound = isRecord(saved) ? nameOf(saved.sound) : null;
        const time = isRecord(saved) ? finiteOr(saved.time, -1) : -1;

        if (sound !== null && time >= 0) {
            kept.positions.push({ sound, time });
        }
    }

    return kept;
}

/** What is kept, as text for the storage. */
export function writeRemembered(kept: Remembered): string {
    return JSON.stringify(kept);
}

/** `kept` with `sound` at `time`, newest first and once, at most `max` sounds. */
export function keepPosition(
    kept: Remembered,
    sound: string,
    time: number,
    max: number,
): Remembered {
    return {
        ...kept,
        positions: [
            { sound, time },
            ...kept.positions.filter((saved) => saved.sound !== sound),
        ].slice(0, max),
    };
}

/** `kept` without the position of `sound`. */
export function forgetPosition(kept: Remembered, sound: string): Remembered {
    return {
        ...kept,
        positions: kept.positions.filter((saved) => saved.sound !== sound),
    };
}

/**
 * Where a sound `duration` seconds long resumes, from the position `saved`: there, unless that is its
 * start (under `MIN_POSITION`) or `nearEnd` seconds or less from its end; then null, from the start.
 */
export function resumeAt(
    saved: number | null,
    duration: number,
    nearEnd: number,
): number | null {
    return saved !== null && saved >= MIN_POSITION && saved < duration - nearEnd
        ? saved
        : null;
}
