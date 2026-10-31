/**
 * Where the sound's description shows: a hidden element the wave's slider points to through
 * `aria-describedby` (next to the page's own ids, which it never removes), and an element of the app
 * that shows the text and is given back as it was. Text only ever goes in as text.
 */

import { addDescribedBy, removeDescribedBy } from '../dom/describedby';

let counter = 0;

export class DescriptionDisplay {
    private readonly id = `sonicframe-description-${++counter}`;
    private element: HTMLSpanElement | null = null;
    /** The app element's text and language before the description came. */
    private readonly saved: { text: string | null; lang: string | null } | null;

    /** `describedBy` points the slider at the text; `target` is the app's element, or null. */
    constructor(
        private readonly describedBy: boolean,
        private readonly target: HTMLElement | null,
    ) {
        this.saved =
            target === null
                ? null
                : {
                      text: target.textContent,
                      lang: target.getAttribute('lang'),
                  };
    }

    /** Shows `text` in `locale` on the frame's `container` and in the app's element; null shows none. */
    show(container: HTMLElement, text: string | null, locale: string): void {
        if (this.describedBy) {
            if (this.element === null) {
                this.element = document.createElement('span');
                this.element.id = this.id;
                this.element.hidden = true;
                this.element.style.setProperty('display', 'none');
                container.append(this.element);
            }

            this.element.textContent = text ?? '';
            this.element.setAttribute('lang', locale);

            if (text === null) {
                removeDescribedBy(container, this.id);
            } else {
                addDescribedBy(container, this.id);
            }
        }

        if (this.target !== null) {
            this.target.textContent = text ?? '';
            this.target.setAttribute('lang', locale);
        }
    }

    /** Takes the text off the frame's `container` (when there is one) and gives the app's element back. */
    destroy(container: HTMLElement | null): void {
        if (container !== null) {
            removeDescribedBy(container, this.id);
        }

        this.element?.remove();
        this.element = null;

        const { target, saved } = this;

        if (target !== null && saved !== null) {
            target.textContent = saved.text;

            if (saved.lang === null) {
                target.removeAttribute('lang');
            } else {
                target.setAttribute('lang', saved.lang);
            }
        }
    }
}
