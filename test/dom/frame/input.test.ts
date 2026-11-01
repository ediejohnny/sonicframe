/**
 * Routing the pointer and the keyboard to plugins: a `'drag'` claim lets a tap still seek but keeps
 * a real drag, a `'take'` claim owns the press, and a plugin's `keyDown` runs before the slider
 * keys. Also the shared live region for `announce`.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { Plugin } from '../../../src/index';
import { firePointer, pressKey } from '../../support/events';
import { fakeMedia, mount } from '../../support/helpers';

/** A frame of a 40-second sound with `plugin`: its element and its media. */
function shown(plugin: Plugin): {
    container: HTMLElement;
    media: ReturnType<typeof fakeMedia>;
} {
    const media = fakeMedia({ duration: 40 });

    return { container: mount({ media, plugins: [plugin] }).container, media };
}

describe('routing the pointer to plugins', () => {
    it('lets a tap seek even when a plugin claims the drag', () => {
        const calls: string[] = [];
        const { container, media } = shown({
            name: 't',
            pointerDown: () => {
                calls.push('down');

                return 'drag';
            },
            pointerUp: () => calls.push('up'),
            pointerCancel: () => calls.push('cancel'),
        });

        firePointer(container, 'pointerdown', 50);
        firePointer(container, 'pointerup', 50);

        expect(media.currentTime).toBe(10);
        expect(calls).toEqual(['down', 'cancel']);
    });

    it('keeps a real drag for the plugin and does not seek', () => {
        const calls: string[] = [];
        const { container, media } = shown({
            name: 't',
            pointerDown: () => 'drag',
            pointerMove: () => calls.push('move'),
            pointerUp: () => calls.push('up'),
        });

        firePointer(container, 'pointerdown', 50);
        firePointer(container, 'pointermove', 80);
        firePointer(container, 'pointerup', 80);

        expect(calls).toContain('move');
        expect(calls).toContain('up');
        expect(media.currentTime).toBe(0);
    });

    it('gives a "take" claim the press at once', () => {
        const calls: string[] = [];
        const { container, media } = shown({
            name: 't',
            pointerDown: () => 'take',
            pointerUp: () => calls.push('up'),
        });

        firePointer(container, 'pointerdown', 50);
        firePointer(container, 'pointerup', 50);

        expect(calls).toEqual(['up']);
        expect(media.currentTime).toBe(0);
    });
});

describe('routing the keyboard to plugins', () => {
    it('runs a plugin key before the slider keys, and falls through otherwise', () => {
        const { container, media } = shown({
            name: 't',
            keyDown: (name) => name === 'r',
        });

        pressKey(container, 'r');
        expect(media.currentTime).toBe(0);

        pressKey(container, 'ArrowRight');
        expect(media.currentTime).toBeGreaterThan(0);
    });
});

describe('announcing to screen readers', () => {
    it('writes into a shared polite live region', () => {
        mount().frame.announce('region 2 of 3');

        const status = document.querySelector('[role="status"]');
        expect(status?.textContent).toBe('region 2 of 3');
    });
});
