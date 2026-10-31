/**
 * Values from outside (an app's options, a tag's attributes, the fields of a file) checked before
 * use: a number kept in its range, a name kept to its list. Anything else falls back.
 */

import { cleanText } from './text';

/** `value` when it is a finite number, otherwise `fallback`. */
export function finiteOr<Fallback>(
    value: unknown,
    fallback: Fallback,
): number | Fallback {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

/**
 * A number kept from `min` to `max`, after `whole` rounds it when given; anything that is not a
 * finite number is `fallback`, as it is.
 */
export function within<Fallback>(
    value: unknown,
    fallback: Fallback,
    min: number,
    max: number,
    whole?: (value: number) => number,
): number | Fallback {
    const number = finiteOr(value, null);

    return number === null
        ? fallback
        : Math.min(max, Math.max(min, whole ? whole(number) : number));
}

/** Whether `value` is one of the `allowed` names. */
export function isOneOf<Name extends string>(
    value: unknown,
    allowed: readonly Name[],
): value is Name {
    return (
        typeof value === 'string' &&
        (allowed as readonly string[]).includes(value)
    );
}

/** `value` when it is one of the `allowed` names, otherwise `fallback`. */
export function oneOf<Name extends string>(
    value: unknown,
    allowed: readonly Name[],
    fallback: Name,
): Name {
    return isOneOf(value, allowed) ? value : fallback;
}

/** The error for a name nothing has (a theme, a palette), the name cleaned and cut to one short line. */
export function unknownName(kind: string, name: string): Error {
    return new Error(`sonicframe: unknown ${kind} "${cleanText(name, 40)}"`);
}
