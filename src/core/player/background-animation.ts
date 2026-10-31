/**
 * How a player's background moves, as the look takes it: off unless asked, `true` for the defaults,
 * and only known names and numbers in range kept. It moves only while the sound plays unless the
 * look says always, and the page never starts it with reduced motion.
 */

import { isRecord, oneOf, within } from '../shared/checked';

export type BackgroundAnimationType = 'pan' | 'zoom' | 'pulse' | 'hue' | 'flow';

/** How the background moves: off unless the look has one; `true` gives the defaults. */
export type BackgroundAnimation = {
    /**
     * `'pan'` (the default) glides the background, `'zoom'` swells it slowly, `'pulse'` breathes its
     * opacity, `'hue'` turns its colors round, `'flow'` drifts a gradient's colors.
     */
    type?: BackgroundAnimationType;
    /** Seconds for one way, 2 to 600; 20 by default. */
    duration?: number;
    /** How far it moves, 0 to 1; 0.5 by default. */
    strength?: number;
    /** It moves only while the sound plays (the default), or always. */
    while?: 'playing' | 'always';
    /** It stops while the mouse or the focus is on the player; off by default. */
    pauseOnHover?: boolean;
};

export type ResolvedBackgroundAnimation = Required<BackgroundAnimation>;

/** An animation checked and filled in; null (off) for anything but `true` or an object. */
export function resolveBackgroundAnimation(
    value: unknown,
): ResolvedBackgroundAnimation | null {
    if (value !== true && !isRecord(value)) {
        return null;
    }

    const given = isRecord(value) ? value : {};

    return {
        type: oneOf(
            given.type,
            ['pan', 'zoom', 'pulse', 'hue', 'flow'] as const,
            'pan',
        ),
        duration: within(given.duration, 20, 2, 600),
        strength: within(given.strength, 0.5, 0, 1),
        while: oneOf(given.while, ['playing', 'always'] as const, 'playing'),
        pauseOnHover: given.pauseOnHover === true,
    };
}

/**
 * The animation a look gives laid over the base's: kept when left out, off with null or false, the
 * base's (or the defaults) with true, and otherwise checked after the merge.
 */
export function animationOver(
    base: BackgroundAnimation | boolean | null,
    given: unknown,
): BackgroundAnimation | boolean | null {
    if (given === undefined) {
        return base;
    }

    const kept = isRecord(base) ? base : {};

    if (given === true) {
        return resolveBackgroundAnimation(kept);
    }

    return resolveBackgroundAnimation(
        isRecord(given) ? { ...kept, ...given } : given,
    );
}
