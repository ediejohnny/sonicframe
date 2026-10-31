/**
 * Icons drawn in SVG element by element, never parsed from text. An icon is hidden from screen
 * readers: the control that holds it carries the name.
 */

/** The SVG namespace: a name the browser needs to create SVG elements; it is never fetched. */
const SVG = 'http://www.w3.org/2000/svg';

/** An empty icon on a `grid` × `grid` square (24 × 24 by default), for its paths. */
export function iconElement(grid: number = 24): SVGSVGElement {
    const icon = document.createElementNS(SVG, 'svg');
    icon.setAttribute('viewBox', `0 0 ${grid} ${grid}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');

    return icon;
}

/** A path of an icon, with its drawing attributes (`d`, `fill`, `stroke`…). */
export function iconPath(
    attributes: Readonly<Record<string, string>>,
): SVGPathElement {
    const path = document.createElementNS(SVG, 'path');

    for (const [name, value] of Object.entries(attributes)) {
        path.setAttribute(name, value);
    }

    return path;
}
