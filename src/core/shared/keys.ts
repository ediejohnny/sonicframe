/**
 * Shortcut keys the app chooses: one character each, matched without regard to case, and a letter
 * that steps forward, or back with Shift; and lists of keys (a key name or several, or none), where
 * a single character matches whatever its case and a named key (`'ArrowUp'`) matches as written.
 */

import type { KeyModifiers } from '../frame/keys';
import { within } from './checked';

/** One key or several, as `KeyboardEvent.key` names them; false switches it off. */
export type KeyChoice = string | readonly string[] | false;

/** The keys of a choice: false gives none, a name or names give those, anything else `fallback`. */
export function keyList(
    value: KeyChoice | undefined,
    fallback: readonly string[],
): string[] {
    if (value === false) {
        return [];
    }

    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.filter((key): key is string => typeof key === 'string');
    }

    return [...fallback];
}

/** Whether `key` is one of `keys`: a single character whatever its case, a named key as written. */
export function keyIn(key: string, keys: readonly string[]): boolean {
    const letter = key.length === 1 ? key.toLowerCase() : null;

    return keys.some((chosen) =>
        letter !== null && chosen.length === 1
            ? chosen.toLowerCase() === letter
            : chosen === key,
    );
}

/** A key name as one lower-case character, or null for none (a word such as "Enter" is no letter). */
export function keyLetter(
    key: string | false | undefined,
    fallback: string,
): string | null {
    if (key === false) {
        return null;
    }

    const chosen = key ?? fallback;

    return chosen.length === 1 ? chosen.toLowerCase() : null;
}

/** The `keys` option of a plugin that steps with one letter: its own letter or false, and its grace. */
export type LetterKeys = { letter?: string | false; backGrace?: number };

/**
 * The letter and back grace of a stepping plugin's `keys`: on (true or left out) gives `fallback`
 * and 1 second; off (false) gives no letter. The grace, in seconds, is kept from `minGrace` up.
 */
export function letterKeys(
    keys: boolean | LetterKeys | undefined,
    fallback: string,
    minGrace: number = 0,
): { letter: string | null; backGrace: number } {
    const own = typeof keys === 'object' ? keys : {};

    return {
        letter: keys === false ? null : keyLetter(own.letter, fallback),
        backGrace: within(own.backGrace, 1, minGrace, Number.POSITIVE_INFINITY),
    };
}

/**
 * Which way a press of `letter` steps: 1 forward, or -1 back with Shift (Shift, not the letter's
 * case, picks it: Caps Lock flips the case). Null for another key, no letter, or a press with Ctrl,
 * Alt or Meta.
 */
export function letterStep(
    key: string,
    modifiers: KeyModifiers & { shiftKey?: boolean },
    letter: string | null,
): 1 | -1 | null {
    if (
        letter === null ||
        modifiers.ctrlKey === true ||
        modifiers.altKey === true ||
        modifiers.metaKey === true ||
        key.toLowerCase() !== letter
    ) {
        return null;
    }

    return modifiers.shiftKey === true ? -1 : 1;
}
