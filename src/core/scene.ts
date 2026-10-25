/**
 * What changes from one picture to the next (the played part, the hover band, the cursor), in device
 * pixels, so a frame can skip drawing when nothing visible moved.
 */

import { clamp01 } from './math';

export type Overlay = {
    /** Device-pixel x where the played part ends. */
    progress: number;
    /** Device-pixel x under the mouse pointer, or null. */
    hover: number | null;
    /** Whether the pointer is over the frame (used to recolor the bars). */
    hovered?: boolean;
};

export type RegionKind = 'progress' | 'hover' | 'wave';

/** A vertical strip of the frame, from `from` (included) to `to` (excluded). */
export type Region = { kind: RegionKind; from: number; to: number };

/** Where a position from 0 to 1 falls, in whole device pixels. */
export function xAt(ratio: number, width: number): number {
    return Math.round(clamp01(ratio) * Math.max(0, width));
}

/** Where a pointer sits along the frame, from 0 (start) to 1 (end). */
export function ratioAt(offset: number, width: number): number {
    return width > 0 ? clamp01(offset / width) : 0;
}

export function overlayOf(
    progress: number,
    hover: number | null,
    width: number,
    hovered: boolean = false,
): Overlay {
    return {
        progress: xAt(progress, width),
        hover: hover === null ? null : xAt(hover, width),
        hovered,
    };
}

export function sameOverlay(a: Overlay | null, b: Overlay): boolean {
    return (
        a !== null &&
        a.progress === b.progress &&
        a.hover === b.hover &&
        (a.hovered ?? false) === (b.hovered ?? false)
    );
}

/**
 * Splits the frame into strips that never overlap: played, hover band (between the played part and
 * the pointer, on either side) and not yet played. Empty strips are left out.
 */
export function regions(overlay: Overlay, width: number): Region[] {
    const hover = overlay.hover ?? overlay.progress;
    const start = Math.min(overlay.progress, hover);
    const end = Math.max(overlay.progress, hover);
    const strips: Region[] = [
        { kind: 'progress', from: 0, to: start },
        { kind: 'hover', from: start, to: end },
        { kind: 'wave', from: end, to: width },
    ];

    return strips.filter((strip) => strip.to > strip.from);
}

/** The cursor line: `size` device pixels wide, centered on the played edge, never outside the frame. */
export function cursorSpan(
    progress: number,
    size: number,
    width: number,
): { x: number; width: number } {
    const lineWidth = Math.max(0, Math.min(size, width));

    return {
        x: Math.min(
            width - lineWidth,
            Math.max(0, progress - Math.floor(lineWidth / 2)),
        ),
        width: lineWidth,
    };
}
