/**
 * The docs site's controls, as a person who cannot see the page gets them: the drawer of pages keeps
 * the page behind it out of reach while open, each search result says its place apart from its
 * title, a copy button says which code it copies and that it copied, and a code block too wide for
 * the screen can be scrolled from the keyboard. How they look is measured in Chrome.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { setupCodeBlocks } from '../../playground/code-blocks';
import { dressPage } from '../../playground/docs/plugin';
import { setupHeader } from '../../playground/site';
import { nextFrame } from './helpers';

const PAGE = [
    '<html><head><title>Markers</title></head><body><main class="content">',
    '<div class="page-head"><h1>Markers</h1></div>',
    '<div class="doc"><section class="section"><h2>Adding markers</h2>',
    '<div class="code"><pre><code>frame.use(markers());</code></pre><button class="button small" type="button">Copy</button></div>',
    '</section></div></main></body></html>',
].join('');

afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

/** The Markers page as the build writes it, with the screen as wide as `wide` says. */
function mountPage(wide = true): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('min-width') ? wide : false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    }));
    // Without the stylesheet: happy-dom would try to fetch it.
    const page = new DOMParser().parseFromString(
        dressPage(PAGE, 'markers.html').replace(
            /<link rel="stylesheet"[^>]*>/,
            '',
        ),
        'text/html',
    );
    document.body.replaceChildren(...page.body.childNodes);
}

function find<Found extends HTMLElement = HTMLElement>(
    selector: string,
): Found {
    const element = document.querySelector<Found>(selector);

    if (element === null) {
        throw new Error(`test: the page has no ${selector}`);
    }

    return element;
}

/** What a screen reader says for an element: its words, without what is hidden from it. */
function nameOf(element: Element | null): string {
    const copy = element?.cloneNode(true) as Element | undefined;

    for (const hidden of copy?.querySelectorAll('[aria-hidden="true"]') ?? []) {
        hidden.remove();
    }

    return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('the drawer of pages', () => {
    it('keeps the page behind it out of reach while open, and gives it back on Escape', () => {
        mountPage(false);
        setupHeader(() => undefined);
        const menu = find<HTMLButtonElement>('#menu');
        const behind = [find('main'), find('#foot')];

        menu.click();

        expect(behind.map((part) => part.hasAttribute('inert'))).toEqual([
            true,
            true,
        ]);
        expect(document.activeElement?.closest('#side')).not.toBeNull();

        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );

        expect(behind.map((part) => part.hasAttribute('inert'))).toEqual([
            false,
            false,
        ]);
        expect(document.activeElement).toBe(menu);
    });
});

describe('the search', () => {
    it('names each result by its title, then its place, apart', async () => {
        mountPage();
        vi.stubGlobal('fetch', async () => ({
            json: async () => [
                {
                    file: 'zoom.html',
                    name: 'Zoom and scroll',
                    group: 'Long sounds',
                    lede: '',
                    headings: [{ id: 'zoom-keys', text: 'Zoom keys' }],
                },
            ],
        }));
        setupHeader(() => undefined);
        find<HTMLButtonElement>('#search-open').click();
        const input = find<HTMLInputElement>('.search-input');
        input.value = 'zoom';
        input.dispatchEvent(new Event('input'));

        await vi.waitFor(() =>
            expect(document.querySelectorAll('[role="option"]')).toHaveLength(
                2,
            ),
        );
        expect(
            [...document.querySelectorAll('[role="option"]')].map(nameOf),
        ).toEqual([
            'Zoom and scroll, Long sounds',
            'Zoom keys, Long sounds › Zoom and scroll',
        ]);
    });
});

describe('a code block', () => {
    it('describes its copy button by the heading over the code, and says when it copied', async () => {
        mountPage();
        const copied: string[] = [];
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: async (text: string) => {
                    copied.push(text);
                },
            },
        });
        setupCodeBlocks();
        const button = find<HTMLButtonElement>('.code button');
        const described = document.getElementById(
            button.getAttribute('aria-describedby') ?? '',
        );

        expect(nameOf(described)).toBe('Adding markers');

        button.click();

        await vi.waitFor(() =>
            expect(find('[role="status"]').textContent).toBe('Copied.'),
        );
        expect(copied).toEqual(['frame.use(markers());']);
    });

    it('can be reached from the keyboard while it is too wide for the screen, and only then', async () => {
        mountPage();
        const pre = find('.code pre');
        let scrollWidth = 900;
        Object.defineProperty(pre, 'scrollWidth', { get: () => scrollWidth });
        Object.defineProperty(pre, 'clientWidth', { get: () => 300 });
        setupCodeBlocks();

        expect([
            pre.tabIndex,
            pre.getAttribute('role'),
            pre.getAttribute('aria-label'),
            nameOf(
                document.getElementById(
                    pre.getAttribute('aria-describedby') ?? '',
                ),
            ),
        ]).toEqual([0, 'region', 'Code', 'Adding markers']);

        scrollWidth = 300;
        window.dispatchEvent(new Event('resize'));
        await nextFrame();

        expect([
            pre.hasAttribute('tabindex'),
            pre.hasAttribute('role'),
        ]).toEqual([false, false]);
    });
});
