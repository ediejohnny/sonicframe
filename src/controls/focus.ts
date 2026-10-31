/**
 * The keyboard focus ring of the controls. `:focus-visible` cannot be styled inline, so a control
 * draws the ring itself on focus; the color goes into `outline-color` alone, never into a shorthand.
 * The ring is one line: on a border of the control's own it takes the border's place, so the two
 * never stand side by side; without one it keeps 2 px out, where the control's own fill cannot hide it.
 */

/** The ring's properties, set on focus and taken off on blur. */
const RING = [
    'outline-style',
    'outline-width',
    'outline-offset',
    'outline-color',
] as const;

export function showFocusRing(element: HTMLElement, color: string): void {
    const border = parseFloat(getComputedStyle(element).borderTopWidth) || 0;

    element.style.setProperty('outline-style', 'solid');
    element.style.setProperty('outline-width', '0.125rem');
    element.style.setProperty(
        'outline-offset',
        border > 0 ? `${-border}px` : '0.125rem',
    );
    element.style.setProperty('outline-color', color);
}

export function hideFocusRing(element: HTMLElement): void {
    for (const name of RING) {
        element.style.removeProperty(name);
    }
}
