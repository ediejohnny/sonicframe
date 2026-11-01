/** Lengths as the page measures them. */

import { readLength } from '../../core/shared/length';

/** CSS pixels in `rem` of the page's root text size (16 when the page gives none). */
export function remPixels(rem: number): number {
    const root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
    );

    return rem * (root > 0 ? root : 16);
}

/** CSS pixels of a size given in pixels (a number) or in rem (`'2.5rem'`), rounded to whole pixels. */
export function sizePixels(size: number | `${number}rem`): number {
    return Math.round(
        typeof size === 'number' ? size : remPixels(parseFloat(size)),
    );
}

/**
 * A length in CSS pixels: a number counts in `unit`, a written `CssLength` in its own; anything else
 * is undefined, so the caller's default applies.
 */
export function lengthPixels(
    length: unknown,
    unit: 'px' | 'rem',
): number | undefined {
    const written =
        typeof length === 'number'
            ? { amount: length, unit }
            : readLength(length);

    if (written === null || !Number.isFinite(written.amount)) {
        return undefined;
    }

    return written.unit === 'rem' ? remPixels(written.amount) : written.amount;
}

/**
 * The room the page shows, in CSS pixels: its own width and height leave its scrollbars out, the
 * window's would not (the window's are kept for a page that measures none).
 */
export function pageSize(): { width: number; height: number } {
    const page = document.documentElement;

    return {
        width: page.clientWidth || window.innerWidth,
        height: page.clientHeight || window.innerHeight,
    };
}
