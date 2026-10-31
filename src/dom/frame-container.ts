/**
 * The element a frame draws in, made ready and given back. A frame that seeks makes it a slider, in
 * the tab order, with the styles a drag needs; a frame that only shows makes it an image. Either way
 * it gets its accessible name and a position the canvas can be placed against; what the element had
 * before comes back when the frame goes.
 */

import { applyStyles } from '../core/styles';

/** The attributes a frame sets on its element, saved first so they can be put back. */
const ATTRIBUTES = [
    'role',
    'tabindex',
    'aria-label',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'aria-valuetext',
];

/** Prepares `container` for a frame named `label`; returns the function that gives it back as it was. */
export function prepareContainer(
    container: HTMLElement,
    interact: boolean,
    label: string,
): () => void {
    const computed = getComputedStyle(container);
    const saved = new Map<string, string | null>();
    const styles: [string, string][] = [];

    for (const name of ATTRIBUTES) {
        saved.set(name, container.getAttribute(name));
    }

    // The canvas is placed against the element; a static element would let it escape.
    if (computed.position === 'static') {
        styles.push(['position', 'relative']);
    }

    if (interact) {
        styles.push(
            ['touch-action', 'pan-y'],
            ['user-select', 'none'],
            ['-webkit-user-select', 'none'],
        );

        if (computed.cursor === 'auto') {
            styles.push(['cursor', 'pointer']);
        }
    }

    const restoreStyles = applyStyles(container.style, styles);
    const restore = (): void => {
        for (const [name, value] of saved) {
            if (value === null) {
                container.removeAttribute(name);
            } else {
                container.setAttribute(name, value);
            }
        }

        restoreStyles();
    };

    if (!interact) {
        container.setAttribute('role', 'img');
        container.setAttribute('aria-label', label);

        return restore;
    }

    container.setAttribute('role', 'slider');
    container.setAttribute('aria-label', label);
    container.setAttribute('aria-valuemin', '0');
    container.setAttribute('aria-valuemax', '100');

    if (container.getAttribute('tabindex') === null) {
        container.setAttribute('tabindex', '0');
    }

    return restore;
}
