/** Lengths an app writes with their unit. */

/** A length with its unit: `'1.25rem'` (of the page's root text size) or `'20px'` (CSS pixels). */
export type CssLength = `${number}rem` | `${number}px`;

/** The amount and unit of a written length, or null when `value` is not a number followed by `rem` or `px`. */
export function readLength(
    value: unknown,
): { amount: number; unit: 'rem' | 'px' } | null {
    if (typeof value !== 'string') {
        return null;
    }

    const match = /^(-?(?:\d+\.?\d*|\.\d+))(rem|px)$/.exec(value.trim());

    return match === null
        ? null
        : { amount: Number(match[1]), unit: match[2] === 'px' ? 'px' : 'rem' };
}
