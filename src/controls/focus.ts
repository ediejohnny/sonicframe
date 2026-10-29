/**
 * The keyboard focus ring of the controls. `:focus-visible` cannot be styled inline, so a control
 * draws the ring itself on focus; the color goes into `outline-color` alone, never into a shorthand.
 */

const RING: readonly (readonly [string, string])[] = [
    ['outline-style', 'solid'],
    ['outline-width', '0.125rem'],
    ['outline-offset', '0.125rem'],
];

export function showFocusRing(element: HTMLElement, color: string): void {
    for (const [name, value] of RING) {
        element.style.setProperty(name, value);
    }

    element.style.setProperty('outline-color', color);
}

export function hideFocusRing(element: HTMLElement): void {
    for (const [name] of RING) {
        element.style.removeProperty(name);
    }

    element.style.removeProperty('outline-color');
}
