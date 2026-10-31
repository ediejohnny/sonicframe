/** Inline styles set through the CSSOM, never as text, so a strict CSP needs no `'unsafe-inline'`. */

/** Sets each `[property, value]` pair on the element's own style. */
export function css(
    element: HTMLElement | SVGElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}
