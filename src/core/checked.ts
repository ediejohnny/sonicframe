/**
 * Values from outside (an app's options, a tag's attributes, the fields of a file) checked before
 * use: a number kept in its range, a name kept to its list. Anything else falls back.
 */

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
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, whole ? whole(value) : value));
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
