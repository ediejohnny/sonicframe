/**
 * The ceilings on what comes from outside (sizes, counts, lengths of time), each an option: a safe
 * default, which an app's code may raise up to a fixed most (the most open that mature projects and
 * the browsers settled on) and lower down to a least. Past either end the option is refused with a
 * `RangeError` that names it, never cut to a number the app did not ask for. A tag's attribute, which
 * a page's author may write, only lowers the default.
 */

/** A ceiling: its default, the least and the most it may be set to, and whether it counts whole things. */
export type Limit = {
    readonly value: number;
    readonly least: number;
    readonly most: number;
    /** A count (rounded down), not a length that may hold a fraction. */
    readonly whole: boolean;
};

/**
 * The ceiling the app asks for as `name`: its default when `given` is no finite number, the value
 * asked for from the least to the most, and a `RangeError` past either end.
 */
export function limitOf(name: string, given: unknown, limit: Limit): number {
    if (typeof given !== 'number' || !Number.isFinite(given)) {
        return limit.value;
    }

    const value = limit.whole ? Math.floor(given) : given;

    if (value > limit.most) {
        throw new RangeError(
            `sonicframe: ${name} goes past its most, ${limit.most} (${given})`,
        );
    }

    if (value < limit.least) {
        throw new RangeError(
            `sonicframe: ${name} goes under its least, ${limit.least} (${given})`,
        );
    }

    return value;
}

/**
 * A tag's attribute for a ceiling: the number it holds, kept from the least up to the default (a
 * page's author may lower a ceiling, never raise it); undefined without the attribute or a number.
 */
export function tagLimit(
    attribute: string | null,
    limit: Limit,
): number | undefined {
    const text = attribute?.trim() ?? '';
    const number = Number(text);

    if (text === '' || !Number.isFinite(number)) {
        return undefined;
    }

    const value = limit.whole ? Math.floor(number) : number;

    return Math.min(limit.value, Math.max(limit.least, value));
}
