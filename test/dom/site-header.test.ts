/**
 * The docs site's header, as a screen reader gets it: every control named by words, every drawing
 * hidden, so nothing is read as a picture or twice. How it looks is measured in the browser.
 */

import { describe, expect, it } from 'vite-plus/test';
import { dressPage } from '../../playground/docs/plugin';

const PAGE =
    '<html><head><title>Page</title></head><body><main class="content"><div class="doc"><h2>Part</h2></div></main></body></html>';

/** The header of a dressed page, alone (the page's stylesheet is not loaded here). */
function header(): HTMLElement {
    const page = dressPage(PAGE, 'page.html');
    const html = page.slice(
        page.indexOf('<header'),
        page.indexOf('</header>') + '</header>'.length,
    );

    return new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector('header.top') as HTMLElement;
}

/** What a screen reader says for a control: its words, without what is hidden from it. */
function nameOf(control: Element | null): string {
    const copy = control?.cloneNode(true) as Element | undefined;

    for (const hidden of copy?.querySelectorAll('[aria-hidden="true"]') ?? []) {
        hidden.remove();
    }

    return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('the docs header', () => {
    it('names every control by its words, the search without the keys it shows, the scheme switch as a toggle', () => {
        const top = header();

        expect(
            [
                '#menu',
                '#search-open',
                '.nav a[href*="github.com"]',
                '.nav a[href*="npmjs.com"]',
                '#font-open',
                '#scheme',
            ].map((selector) => nameOf(top.querySelector(selector))),
        ).toEqual([
            'Menu',
            // The keys are said by aria-keyshortcuts; the shown "Ctrl K" would run into the words.
            'Search the docs',
            'GitHub',
            'npm',
            'Font: Industrial',
            'Dark',
        ]);
        expect(top.querySelector('#scheme')?.getAttribute('aria-pressed')).toBe(
            'false',
        );
    });

    it('hides every drawing from screen readers and from the tab order', () => {
        const drawings = [...header().querySelectorAll('svg')];

        expect(drawings.length).toBeGreaterThan(0);

        for (const svg of drawings) {
            expect(svg.getAttribute('aria-hidden')).toBe('true');
            expect(svg.getAttribute('focusable')).toBe('false');
        }
    });
});
