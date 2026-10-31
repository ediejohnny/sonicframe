/**
 * The host of a player under test: made 320 × 48 on the page, searched for the player, a part and
 * its name, and taken off after the test with what the test replaced (`cleanUp`). `host` is the
 * current one.
 */

import { vi } from 'vite-plus/test';
import { pageHost } from '../../support/helpers';

export let host: HTMLElement | null = null;

/** Takes the host off the page, and gives back the globals, the methods and the page's language. */
export function cleanUp(): void {
    host?.remove();
    host = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('lang');
}

/** Makes `element` (a tag on the page, say) the host taken off after the test. */
export function keep(element: HTMLElement): void {
    host = element;
}

/** The player's root element in the host. */
export function root(): HTMLElement {
    const element = (host as HTMLElement).querySelector<HTMLElement>(
        '.sonicframe-player',
    );

    if (element === null) {
        throw new Error('test: no player');
    }

    return element;
}

/** The palette the player wears, read back from its surface color. */
export function surface(): string {
    return root().style.getPropertyValue('--sonicframe-surface');
}

/** A new 320 × 48 host on the page, now the current one. */
export function container(): HTMLElement {
    host = pageHost({ left: 0, top: 0, width: 320, height: 48 });

    return host;
}

export function within(selector: string): HTMLElement {
    const element = (host as HTMLElement).querySelector<HTMLElement>(selector);

    if (element === null) {
        throw new Error(`test: nothing matches ${selector}`);
    }

    return element;
}

export function labelOf(selector: string): string | null {
    return within(selector).getAttribute('aria-label');
}
