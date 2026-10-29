/**
 * Telling a tap from a drag. A press that never moves more than a few pixels is a tap (it seeks);
 * past that, it is a drag (a scrub, or a plugin's own gesture). Pure, so the threshold is one place.
 */

/** How far the pointer must move, in CSS pixels, before a press counts as a drag. */
export const DRAG_THRESHOLD = 4;

/** Whether the pointer has moved far enough from where it went down to count as a drag. */
export function isDrag(
    fromX: number,
    toX: number,
    threshold: number = DRAG_THRESHOLD,
): boolean {
    return Math.abs(toX - fromX) >= threshold;
}
