/** Lengths as the page measures them. */

/** CSS pixels in `rem` of the page's root text size (16 when the page gives none). */
export function remPixels(rem: number): number {
    const root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
    );

    return rem * (root > 0 ? root : 16);
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
