/**
 * Regions on the page: Shift-drag creates one (a plain drag still scrubs), Enter plays the selected
 * region, and Delete removes it.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { regions, type Region, type RegionsPlugin } from '../../src/index';
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

function press(target: HTMLElement, key: string, shiftKey = false): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
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

    it('shows an open hand over a region, a closed one while moving it, and the open one after', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({
            media,
            plugins: [regions({ items: [{ start: 8, end: 16 }] })],
        });
        const cursor = (): string =>
            mounted?.container.style.getPropertyValue('cursor') ?? '';

        // 8 s to 16 s of 40 s across 200 px: 40 px to 80 px, its edges 12 px wide.
        pointer(mounted.container, 'pointermove', 60);
        expect(cursor()).toBe('grab');

        pointer(mounted.container, 'pointerdown', 60);
        expect(cursor()).toBe('grabbing');

        pointer(mounted.container, 'pointermove', 70);
        expect(cursor()).toBe('grabbing');

        pointer(mounted.container, 'pointerup', 70);
        expect(cursor()).toBe('grab');
        expect(media.currentTime).toBe(0);
    });

    it('takes your own cursors', () => {
        mounted = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [
                regions({
                    items: [{ start: 8, end: 16 }],
                    cursors: {
                        body: 'move',
                        moving: 'copy',
                        edge: 'col-resize',
                    },
                }),
            ],
        });
        const cursor = (): string =>
            mounted?.container.style.getPropertyValue('cursor') ?? '';

        pointer(mounted.container, 'pointermove', 40);
        expect(cursor()).toBe('col-resize');

        pointer(mounted.container, 'pointermove', 60);
        expect(cursor()).toBe('move');

        pointer(mounted.container, 'pointerdown', 60);
        expect(cursor()).toBe('copy');
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

    it('steps by the Shift key, not the letter case, so Caps Lock changes nothing', () => {
        const selected: (number | undefined)[] = [];
        const plugin: RegionsPlugin = regions({
            items: [
                { start: 2, end: 4 },
                { start: 8, end: 12 },
                { start: 20, end: 24 },
            ],
            onSelect: (region) => selected.push(region?.start),
        });
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, plugins: [plugin] });

        plugin.select(plugin.list()[0].id);
        press(mounted.container, 'R');
        expect(selected.at(-1)).toBe(8);

        press(mounted.container, 'r', true);
        expect(selected.at(-1)).toBe(2);
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

    it('shows a region added after setup right away, and reports it', () => {
        const changes: (readonly Region[])[] = [];
        const plugin = regions({ onChange: (list) => changes.push(list) });
        mounted = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [plugin],
        });

        plugin.add({ start: 4, end: 8, label: 'intro' });

        expect(changes).toHaveLength(1);
        expect(mounted.container.textContent).toContain('intro');
    });

    it('fits regions given up front to the sound once its length is known', () => {
        const changes: (readonly Region[])[] = [];
        const plugin = regions({
            items: [{ start: 20, end: 50 }],
            onChange: (list) => changes.push(list),
        });
        mounted = mount({ plugins: [plugin] });

        expect(plugin.list()[0]).toMatchObject({ start: 20, end: 50 });

        mounted.frame.setDuration(30);

        expect(plugin.list()[0]).toMatchObject({ start: 20, end: 30 });
        expect(changes.at(-1)?.[0]).toMatchObject({ start: 20, end: 30 });
    });

    it('returns null, not a region it did not keep, once max is reached', () => {
        const plugin = regions({ max: 1 });
        mounted = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [plugin],
        });

        expect(plugin.add({ start: 1, end: 2 })).not.toBeNull();
        expect(plugin.add({ start: 3, end: 4 })).toBeNull();
        expect(plugin.list()).toHaveLength(1);
    });
});
