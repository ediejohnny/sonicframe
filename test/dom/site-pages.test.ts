/**
 * What the docs build draws around every page, as a screen reader gets it: each heading reachable by
 * an address no other element holds, the previous and next pages named with the word apart from the
 * page, and the landmark of links elsewhere holding links only. How it looks is measured in Chrome.
 */

import { describe, expect, it } from 'vite-plus/test';
import { dressPage } from '../../playground/docs/plugin';

/** A page as the build reads it, with its own `<main>`. */
function dressed(main: string): Document {
    const page = `<html><head><title>Words</title></head><body><main class="content">${main}</main></body></html>`;

    // Without the stylesheet: happy-dom would try to fetch it.
    return new DOMParser().parseFromString(
        dressPage(page, 'markers.html').replace(
            /<link rel="stylesheet"[^>]*>/,
            '',
        ),
        'text/html',
    );
}

/** What a screen reader says for an element: its words, without what is hidden from it. */
function nameOf(element: Element | null): string {
    const copy = element?.cloneNode(true) as Element | undefined;

    for (const hidden of copy?.querySelectorAll('[aria-hidden="true"]') ?? []) {
        hidden.remove();
    }

    return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('a dressed docs page', () => {
    it('gives a heading an address of its own when the page already uses its words for another element', () => {
        const page = dressed(
            '<div class="doc"><section class="section" id="keys"><h2>Keys</h2></section></div>',
        );
        const link = page.querySelector<HTMLAnchorElement>('.toc-list a');
        const target = link?.getAttribute('href')?.slice(1) ?? '';

        expect(page.querySelectorAll(`[id="${target}"]`)).toHaveLength(1);
        expect(page.getElementById(target)?.tagName).toBe('H2');
    });

    it('names the previous and the next page with the word apart from the page', () => {
        const page = dressed('<div class="doc"><h2>Part</h2></div>');

        expect(
            ['.pager-prev', '.pager-next'].map((selector) =>
                nameOf(page.querySelector(selector)),
            ),
        ).toEqual(['Previous: Overview', 'Next: Regions']);
    });

    it('keeps only links in the landmark of links elsewhere, the page’s own switches out of it', () => {
        const page = dressed('<div class="doc"><h2>Part</h2></div>');
        const elsewhere = page.querySelector('nav[aria-label="Elsewhere"]');

        expect(
            [...(elsewhere?.querySelectorAll('a, button, input') ?? [])].map(
                (control) => `${control.tagName} ${nameOf(control)}`,
            ),
        ).toEqual(['A GitHub', 'A npm']);
        expect(page.querySelector('header #font-open')).not.toBeNull();
        expect(page.querySelector('header #scheme')).not.toBeNull();
    });
});
