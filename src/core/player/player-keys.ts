/**
 * The player's own keys, without the page: which keys play, mute, skip, change the volume and the
 * speed, where they work, and the speed one step up or down the look's list. A key held with Ctrl,
 * Alt or ⌘ is the browser's, and a held key repeats a step but never a switch (play, mute).
 */

import type { KeyModifiers } from '../frame/keys';
import { oneOf, within } from '../shared/checked';
import { keyIn, keyList, type KeyChoice } from '../shared/keys';

/** The player's keys; each one key or several, as `KeyboardEvent.key` names them, or `false`. */
export type PlayerKeys = {
    /**
     * Where they work: with the focus anywhere in the player (`'player'`, the default), or also while
     * nothing on the page has the focus (`'page'`), for the player that played last.
     */
    scope?: 'player' | 'page';
    /** Plays and pauses: Space. */
    play?: KeyChoice;
    /** Mutes and unmutes: M. */
    mute?: KeyChoice;
    /** Goes back `seconds`: ←. */
    back?: KeyChoice;
    /** Goes forward `seconds`: →. */
    forward?: KeyChoice;
    /** How far back and forward go, in seconds: 5, from 1 to 120. */
    seconds?: number;
    /** Turns the volume up by `volumeStep`: ↑. */
    volumeUp?: KeyChoice;
    /** Turns the volume down by `volumeStep`: ↓. */
    volumeDown?: KeyChoice;
    /** How far the volume moves: 0.05, from 0.01 to 1. */
    volumeStep?: number;
    /** The next speed of the look's `speeds`: `>`. */
    faster?: KeyChoice;
    /** The speed before it: `<`. */
    slower?: KeyChoice;
};

/** What a player key does. */
export type PlayerKeyAction =
    | 'play'
    | 'mute'
    | 'back'
    | 'forward'
    | 'volumeUp'
    | 'volumeDown'
    | 'faster'
    | 'slower';

/** The player's keys, resolved: every key a list, every number in range. */
export type PlayerKeySettings = {
    scope: 'player' | 'page';
    seconds: number;
    volumeStep: number;
} & Record<PlayerKeyAction, string[]>;

const DEFAULT_KEYS: Readonly<Record<PlayerKeyAction, readonly string[]>> =
    Object.freeze({
        play: [' '],
        mute: ['m'],
        back: ['ArrowLeft'],
        forward: ['ArrowRight'],
        volumeUp: ['ArrowUp'],
        volumeDown: ['ArrowDown'],
        faster: ['>'],
        slower: ['<'],
    });

/** The actions in the order a key is looked up. */
const ACTIONS = Object.keys(DEFAULT_KEYS) as PlayerKeyAction[];

/** The switches, which a held key never repeats. */
const SWITCHES: readonly PlayerKeyAction[] = ['play', 'mute'];

/** The player's keys, or null while they are off (the default); strange values fall back to their defaults. */
export function resolvePlayerKeys(
    input: boolean | PlayerKeys | undefined,
): PlayerKeySettings | null {
    if (input === undefined || input === false) {
        return null;
    }

    const own: PlayerKeys = input === true ? {} : input;

    return {
        scope: oneOf(own.scope, ['player', 'page'], 'player'),
        play: keyList(own.play, DEFAULT_KEYS.play),
        mute: keyList(own.mute, DEFAULT_KEYS.mute),
        back: keyList(own.back, DEFAULT_KEYS.back),
        forward: keyList(own.forward, DEFAULT_KEYS.forward),
        seconds: within(own.seconds, 5, 1, 120),
        volumeUp: keyList(own.volumeUp, DEFAULT_KEYS.volumeUp),
        volumeDown: keyList(own.volumeDown, DEFAULT_KEYS.volumeDown),
        volumeStep: within(own.volumeStep, 0.05, 0.01, 1),
        faster: keyList(own.faster, DEFAULT_KEYS.faster),
        slower: keyList(own.slower, DEFAULT_KEYS.slower),
    };
}

/** What `key` does, or null: for a key that is no player key, a key with Ctrl, Alt or ⌘, or a held switch. */
export function playerKeyAction(
    key: string,
    modifiers: KeyModifiers,
    settings: PlayerKeySettings,
): PlayerKeyAction | null {
    if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) {
        return null;
    }

    const action = ACTIONS.find((name) => keyIn(key, settings[name]));

    if (
        action === undefined ||
        (modifiers.repeat === true && SWITCHES.includes(action))
    ) {
        return null;
    }

    return action;
}

/**
 * The speed one step from `rate` along `speeds` (in order, each once): the next one up (`1`) or down
 * (`-1`), or null past either end. A rate within a hundredth of a speed counts as that speed.
 */
export function speedAfter(
    rate: number,
    speeds: readonly number[],
    direction: 1 | -1,
): number | null {
    const order = [...new Set(speeds)].sort((a, b) => a - b);
    const next =
        direction === 1
            ? order.find((speed) => speed > rate + 0.01)
            : order.reverse().find((speed) => speed < rate - 0.01);

    return next ?? null;
}
