/**
 * Regions on the page: Shift-drag creates one (a plain drag still scrubs), Enter plays the selected
 * region, and Delete removes it.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { regions, type RegionsPlugin } from '../../src/index';
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
    shiftKey = false,
): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), {
            clientX,
            clientY: 0,
            pointerId: 1,
            isPrimary: true,
            button: 0,
            pointerType: 'mouse',
            shiftKey,
        }),
    );
}

describe('regions on the page', () => {
    it('creates a region on a Shift-drag', () => {
        const plugin: RegionsPlugin = regions();
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        pointer(mounted.container, 'pointerdown', 40, true);
        pointer(mounted.container, 'pointermove', 100, true);
        pointer(mounted.container, 'pointerup', 100, true);

        expect(plugin.list()).toHaveLength(1);
        expect(media.currentTime).toBe(0);
    });

    it('still scrubs on a plain drag', () => {
        const plugin: RegionsPlugin = regions();
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        pointer(mounted.container, 'pointerdown', 40);
        pointer(mounted.container, 'pointermove', 100);
        pointer(mounted.container, 'pointerup', 100);

        expect(plugin.list()).toHaveLength(0);
        expect(media.currentTime).toBe(20);
    });

    it('plays the selected region on Enter', () => {
        const plugin: RegionsPlugin = regions({
            items: [{ start: 8, end: 12 }],
        });
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        plugin.select(plugin.list()[0].id);
        mounted.container.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );

        expect(media.currentTime).toBe(8);
    });

    it('removes the selected region on Delete', () => {
        const plugin: RegionsPlugin = regions({
            items: [{ start: 8, end: 12 }],
        });
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        plugin.select(plugin.list()[0].id);
        mounted.container.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
        );

        expect(plugin.list()).toHaveLength(0);
    });
});
