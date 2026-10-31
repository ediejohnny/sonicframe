/** Inline styles set through the CSSOM, never as text, so a strict CSP needs no `'unsafe-inline'`. */

/** Style as `[property, value]` pairs. */
export type Styles = readonly (readonly [string, string])[];

/** Hidden from the eye and still read by screen readers: a box of 1 px, clipped away. */
export const VISUALLY_HIDDEN: Styles = [
    ['position', 'absolute'],
    ['width', '1px'],
    ['height', '1px'],
    ['margin', '-1px'],
    ['padding', '0'],
    ['overflow', 'hidden'],
    ['clip-path', 'inset(50%)'],
    ['white-space', 'nowrap'],
];

/** Sets each `[property, value]` pair on the element's own style. */
export function css(element: HTMLElement | SVGElement, pairs: Styles): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}
