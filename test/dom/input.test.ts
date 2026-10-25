/**
 * Routing the pointer and the keyboard to plugins: a `'drag'` claim lets a tap still seek but keeps
 * a real drag, a `'take'` claim owns the press, and a plugin's `keyDown` runs before the slider
 * keys. Also the shared live region for `announce`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { Plugin } from '../../src/index';
import { fakeMedia, mount, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

function pointer(
    target: HTMLElement,
    type: string,
    clientX: number,
    pointerType = 'mouse',
): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), {
            clientX,
            clientY: 0,
            pointerId: 1,
            isPrimary: true,
            button: 0,
            pointerType,
            shiftKey: false,
        }),
    );
}

function key(target: HTMLElement, name: string): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true }),
    );
}

describe('routing the pointer to plugins', () => {
    it('lets a tap seek even when a plugin claims the drag', () => {
        const calls: string[] = [];
        const plugin: Plugin = {
            name: 't',
            pointerDown: () => {
                calls.push('down');

                return 'drag';
            },
            pointerUp: () => calls.push('up'),
            pointerCancel: () => calls.push('cancel'),
        };
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        pointer(mounted.container, 'pointerdown', 50);
        pointer(mounted.container, 'pointerup', 50);

        expect(media.currentTime).toBe(10);
        expect(calls).toEqual(['down', 'cancel']);
    });

    it('keeps a real drag for the plugin and does not seek', () => {
        const calls: string[] = [];
        const plugin: Plugin = {
            name: 't',
            pointerDown: () => 'drag',
            pointerMove: () => calls.push('move'),
            pointerUp: () => calls.push('up'),
        };
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        pointer(mounted.container, 'pointerdown', 50);
        pointer(mounted.container, 'pointermove', 80);
        pointer(mounted.container, 'pointerup', 80);

        expect(calls).toContain('move');
        expect(calls).toContain('up');
        expect(media.currentTime).toBe(0);
    });

    it('gives a "take" claim the press at once', () => {
        const calls: string[] = [];
        const plugin: Plugin = {
            name: 't',
            pointerDown: () => 'take',
            pointerUp: () => calls.push('up'),
        };
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        pointer(mounted.container, 'pointerdown', 50);
        pointer(mounted.container, 'pointerup', 50);

        expect(calls).toEqual(['up']);
        expect(media.currentTime).toBe(0);
    });
});

describe('routing the keyboard to plugins', () => {
    it('runs a plugin key before the slider keys, and falls through otherwise', () => {
        const plugin: Plugin = {
            name: 't',
            keyDown: (name) => name === 'r',
        };
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        key(mounted.container, 'r');
        expect(media.currentTime).toBe(0);

        key(mounted.container, 'ArrowRight');
        expect(media.currentTime).toBeGreaterThan(0);
    });
});

describe('announcing to screen readers', () => {
    it('writes into a shared polite live region', () => {
        mounted = mount();

        mounted.frame.announce('region 2 of 3');

        const status = document.querySelector('[role="status"]');
        expect(status?.textContent).toBe('region 2 of 3');
    });
});
