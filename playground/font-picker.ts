/**
 * The header's font picker (the build writes it; see `fontPicker` in docs/plugin.ts): an "Aa" button
 * opens a panel of the library's own font stacks, each name written in its own font, and the font
 * chosen is the page's at once, remembered for the next visit. The panel is a group of radio
 * buttons, so the arrow keys move through it and say each font, leaving it open to compare. A press
 * on a font (mouse or finger) picks it and closes the panel; so do Escape, a press outside and focus
 * leaving, and Escape or a pick gives focus back to the button. The button's name carries the font
 * in use ("Font: Serif"), so a screen reader hears the choice as focus comes back.
 */

import { store } from './storage';

/** Where the choice is kept between visits; the page's early script reads it before painting. */
const FONT_KEY = 'sonicframe-docs-font';

/** Wires the picker; `repaint` runs after every change of font. */
export function setupFontPicker(repaint: () => void): void {
    const root = document.documentElement;
    const pick = document.querySelector<HTMLElement>('.font-pick');
    const button = pick?.querySelector<HTMLButtonElement>('.font-open');
    const name = button?.querySelector<HTMLElement>('.font-name');
    const panel = pick?.querySelector<HTMLElement>('.font-panel');

    if (!pick || !button || !name || !panel) {
        return;
    }

    const radios = [
        ...panel.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    const known = radios.map((radio) => radio.value);
    let open = false;
    // A press on a font picks it and closes the panel; the keys move through it and leave it open.
    let pressed = false;

    if (!known.includes(root.dataset.font ?? '')) {
        delete root.dataset.font;
    }

    const show = (): void => {
        const font = root.dataset.font ?? known[0];

        for (const radio of radios) {
            radio.checked = radio.value === font;
        }

        const label = radios.find((radio) => radio.checked)?.parentElement;
        name.textContent = `Font: ${label?.textContent?.trim() ?? ''}`;
    };
    const choose = (font: string): void => {
        if (root.dataset.font === font) {
            return;
        }

        root.dataset.font = font;
        store(FONT_KEY, font);
        show();
        repaint();
    };
    const setOpen = (next: boolean, focusButton = false): void => {
        open = next;
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));

        if (open) {
            (radios.find((radio) => radio.checked) ?? radios[0])?.focus();
        } else if (focusButton) {
            button.focus();
        }
    };

    button.addEventListener('click', () => setOpen(!open, true));
    panel.addEventListener('pointerdown', () => {
        pressed = true;
    });
    panel.addEventListener('keydown', () => {
        pressed = false;
    });
    panel.addEventListener('change', (event) => {
        choose((event.target as HTMLInputElement).value);
    });
    // The browser checks a pressed radio before this click, and says it changed only after: the
    // font is taken here, so the button already names it when focus comes back.
    panel.addEventListener('click', (event) => {
        if (pressed && event.target instanceof HTMLInputElement) {
            pressed = false;
            choose(event.target.value);
            setOpen(false, true);
        }
    });
    pick.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false, true);
        }
    });
    pick.addEventListener('focusout', (event) => {
        if (open && !pick.contains(event.relatedTarget as Node)) {
            setOpen(false);
        }
    });
    document.addEventListener('pointerdown', (event) => {
        if (open && !pick.contains(event.target as Node)) {
            setOpen(false);
        }
    });

    show();
}
