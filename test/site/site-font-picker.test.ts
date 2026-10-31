/**
 * The docs site's font picker, in the header: a button with the font icon that opens a group of radio
 * buttons, one per font. Checked here is what a person relies on without seeing the page: the button's name
 * says the font in use, its state says whether the panel is open, focus goes into the panel and
 * comes back to the button, and a choice is the page's font at once, remembered for the next visit.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { fontPicker } from '../../playground/docs/plugin';
import { setupFontPicker } from '../../playground/font-picker';

/** Where the site keeps the choice; the page's early script reads it before painting. */
const KEY = 'sonicframe-docs-font';

let repaints = 0;

afterEach(() => {
    document.querySelector('.font-pick')?.remove();
    document.querySelector('#outside')?.remove();
    delete document.documentElement.dataset.font;
    localStorage.clear();
    repaints = 0;
});

type Picker = {
    button: HTMLButtonElement;
    panel: HTMLElement;
    /** The visually hidden words that name the button. */
    name: () => string;
    radio: (font: string) => HTMLInputElement;
};

/** The header's picker as the build writes it, after a visit that stored `stored`. */
function picker(stored: string | null = null): Picker {
    if (stored !== null) {
        localStorage.setItem(KEY, stored);
        document.documentElement.dataset.font = stored;
    }

    const page = new DOMParser().parseFromString(fontPicker(), 'text/html');
    document.body.append(...page.body.childNodes);
    setupFontPicker(() => {
        repaints += 1;
    });

    const button = document.querySelector<HTMLButtonElement>('.font-open');
    const panel = document.querySelector<HTMLElement>('.font-panel');

    if (button === null || panel === null) {
        throw new Error('test: the picker has no button or panel');
    }

    return {
        button,
        panel,
        name: () => button.querySelector('.font-name')?.textContent ?? '',
        radio: (font) =>
            panel.querySelector(`input[value="${font}"]`) as HTMLInputElement,
    };
}

/**
 * A font chosen with an arrow key: the browser moves focus to the next radio, checks it with a click
 * of its own (no pointer involved) and says it changed.
 */
function arrowTo(radio: HTMLInputElement): void {
    radio.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    radio.focus();
    radio.click();
}

function press(target: Element, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('the font picker', () => {
    it('is a closed button named by the font in use', () => {
        const { button, panel, name } = picker();

        expect(name()).toBe('Font: Industrial');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.hidden).toBe(true);
    });

    it('lists every font as a radio named by its label, in a group named Font', () => {
        const { panel } = picker();
        const options = [...panel.querySelectorAll('label')];

        expect(panel.querySelector('fieldset legend')?.textContent).toBe(
            'Font',
        );
        expect(
            options.map((label) => [
                label.textContent,
                label.querySelector('input')?.type,
            ]),
        ).toEqual([
            ['Industrial', 'radio'],
            ['System', 'radio'],
            ['Humanist', 'radio'],
            ['Geometric', 'radio'],
            ['Serif', 'radio'],
            ['Rounded', 'radio'],
        ]);
    });

    it('opens on the button with focus on the font in use, kept from the last visit', () => {
        const { button, panel, name, radio } = picker('serif');

        button.click();

        expect(name()).toBe('Font: Serif');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(panel.hidden).toBe(false);
        expect(document.activeElement).toBe(radio('serif'));
        expect(radio('serif').checked).toBe(true);
    });

    it('makes a font picked with the keys the page’s font at once, remembered, and stays open to compare', () => {
        const { button, panel, name, radio } = picker();
        button.click();

        arrowTo(radio('geometric'));

        expect(document.documentElement.dataset.font).toBe('geometric');
        expect(localStorage.getItem(KEY)).toBe('geometric');
        expect(name()).toBe('Font: Geometric');
        expect(repaints).toBe(1);
        expect(panel.hidden).toBe(false);
    });

    it('closes on Escape and gives focus back to the button, which now says the choice', () => {
        const { button, panel, name, radio } = picker();
        button.click();
        arrowTo(radio('rounded'));

        press(radio('rounded'), 'Escape');

        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(button);
        expect(name()).toBe('Font: Rounded');
    });

    it('picks a font pressed with the mouse or a finger and closes, its name already said', () => {
        const { button, panel, name, radio } = picker();
        button.click();
        const humanist = radio('humanist');
        let named = '';
        button.addEventListener('focus', () => {
            named = name();
        });

        humanist.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        humanist.click();

        expect(document.documentElement.dataset.font).toBe('humanist');
        expect(panel.hidden).toBe(true);
        expect(document.activeElement).toBe(button);
        // Focus arrives on a button that already names the new font, so it is what a reader hears.
        expect(named).toBe('Font: Humanist');
        expect(repaints).toBe(1);
    });

    it('keeps the keys from closing it after a press that picked nothing', () => {
        const { button, panel, radio } = picker();
        button.click();

        panel
            .querySelector('legend')
            ?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        arrowTo(radio('serif'));

        expect(document.documentElement.dataset.font).toBe('serif');
        expect(panel.hidden).toBe(false);
    });

    it('closes on a press outside it and when focus leaves it, leaving focus where it went', () => {
        const { button, panel } = picker();
        const outside = document.createElement('button');
        outside.id = 'outside';
        document.body.append(outside);

        button.click();
        outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');

        button.click();
        outside.focus();
        expect(panel.hidden).toBe(true);
        expect(document.activeElement).toBe(outside);
    });

    it('closes from its own button too, and opens again', () => {
        const { button, panel } = picker();

        button.click();
        button.click();
        expect(panel.hidden).toBe(true);
        expect(document.activeElement).toBe(button);

        button.click();
        expect(panel.hidden).toBe(false);
    });

    it('forgets a stored font it does not know and shows the first one', () => {
        const { name, radio } = picker('comic');

        expect(document.documentElement.dataset.font).toBeUndefined();
        expect(name()).toBe('Font: Industrial');
        expect(radio('industrial').checked).toBe(true);
    });
});
