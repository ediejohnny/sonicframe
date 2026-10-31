/** Lengths as the page measures them. */

/** CSS pixels in `rem` of the page's root text size (16 when the page gives none). */
export function remPixels(rem: number): number {
    const root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
    );

    return rem * (root > 0 ? root : 16);
}
