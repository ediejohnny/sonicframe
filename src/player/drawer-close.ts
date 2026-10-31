/**
 * The chapters drawer's close button: a cross drawn in SVG, so its middle is the button's whatever
 * the font, set on the list's head with its middle on the head's name and its right edge on the
 * list's; without a head, in the list's top corner.
 */

import { css } from '../dom/css';
import { iconElement, iconPath } from '../dom/icon';

export class DrawerClose {
    readonly element: HTMLButtonElement = document.createElement('button');

    /** A button named `label` that calls `onPress` when pressed. */
    constructor(label: string, onPress: () => void) {
        const button = this.element;
        const icon = iconElement();
        button.type = 'button';
        button.className = 'sonicframe-chapter-close';
        button.setAttribute('aria-label', label);
        button.title = label;
        icon.append(
            iconPath({
                d: 'M6 6 18 18M18 6 6 18',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '2',
                'stroke-linecap': 'round',
            }),
        );
        button.append(icon);
        css(button, [
            // On the list's head, set by `place` when the list opens.
            ['position', 'absolute'],
            ['top', '0'],
            ['right', '0'],
            ['z-index', '1'],
            ['display', 'inline-grid'],
            ['place-items', 'center'],
            ['width', '1.75rem'],
            ['height', '1.75rem'],
            ['margin', '0'],
            ['padding', '0'],
            ['border-width', '0'],
            ['border-radius', '0.25rem'],
            ['background-color', 'transparent'],
            ['color', 'inherit'],
            ['cursor', 'pointer'],
        ]);
        css(icon, [
            ['width', '1.125rem'],
            ['height', '1.125rem'],
            ['display', 'block'],
        ]);
        button.addEventListener('click', onPress);
    }

    /**
     * Places the button in the drawer `box`, against the list `content`. Measured when the list
     * opens, since the list's look may change its padding, border and font.
     */
    place(box: HTMLElement, content: HTMLElement): void {
        const button = this.element;
        // The button is placed from inside the drawer's border.
        const style = getComputedStyle(box);
        const outer = box.getBoundingClientRect();
        const top = outer.top + (parseFloat(style.borderTopWidth) || 0);
        const right = outer.right - (parseFloat(style.borderRightWidth) || 0);
        const list = content.getBoundingClientRect();
        const size = button.getBoundingClientRect();
        const name =
            content.querySelector('.sonicframe-chapters-head')
                ?.firstElementChild ?? null;
        let middle = list.top + size.height / 2;

        if (name !== null) {
            const line = name.getBoundingClientRect();
            middle = line.top + line.height / 2;
        }

        css(button, [
            ['top', `${middle - size.height / 2 - top}px`],
            ['right', `${right - list.right}px`],
        ]);
    }
}
