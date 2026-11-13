/**
 * Regions on the page: Shift-drag creates one (a plain drag still scrubs), Enter plays the selected
 * region, and Delete removes it.
 */

import { describe, expect, it } from 'vite-plus/test';
import { regions, type Region, type RegionsOptions } from '../../../src/index';
import { firePointer, pressKey } from '../../support/events';
import { fakeMedia, mount } from '../../support/helpers';
import { shown } from './regions-harness';

/** The mouse cursor the frame shows now. */
function cursorOf(container: HTMLElement): string {
    return container.style.getPropertyValue('cursor');
}

describe('regions on the page', () => {
    it('creates a region on a Shift-drag', () => {
        const { container, media, plugin } = shown();

        firePointer(container, 'pointerdown', 40, { shiftKey: true });
        firePointer(container, 'pointermove', 100, { shiftKey: true });
        firePointer(container, 'pointerup', 100, { shiftKey: true });

        expect(plugin.list()).toHaveLength(1);
        expect(media.currentTime).toBe(0);
    });

    it('still scrubs on a plain drag', () => {
        const { container, media, plugin } = shown();

        firePointer(container, 'pointerdown', 40);
        firePointer(container, 'pointermove', 100);
        firePointer(container, 'pointerup', 100);

        expect(plugin.list()).toHaveLength(0);
        expect(media.currentTime).toBe(20);
    });

    it('shows an open hand over a region, a closed one while moving it, and the open one after', () => {
        const { container, media } = shown({ items: [{ start: 8, end: 16 }] });

        // 8 s to 16 s of 40 s across 200 px: 40 px to 80 px, its edges 12 px wide.
        firePointer(container, 'pointermove', 60);
        expect(cursorOf(container)).toBe('grab');

        firePointer(container, 'pointerdown', 60);
        expect(cursorOf(container)).toBe('grabbing');

        firePointer(container, 'pointermove', 70);
        expect(cursorOf(container)).toBe('grabbing');

        firePointer(container, 'pointerup', 70);
        expect(cursorOf(container)).toBe('grab');
        expect(media.currentTime).toBe(0);
    });

    it('takes your own cursors', () => {
        const { container } = shown({
            items: [{ start: 8, end: 16 }],
            cursors: {
                body: 'move',
                moving: 'copy',
                edge: 'col-resize',
            },
        });

        firePointer(container, 'pointermove', 40);
        expect(cursorOf(container)).toBe('col-resize');

        firePointer(container, 'pointermove', 60);
        expect(cursorOf(container)).toBe('move');

        firePointer(container, 'pointerdown', 60);
        expect(cursorOf(container)).toBe('copy');
    });

    it('shows its labels on a new frame, as when a player builds its wave again', () => {
        const plugin = regions({
            items: [{ start: 8, end: 16, label: 'Intro' }],
        });
        const first = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [plugin],
        });
        first.frame.destroy();
        first.unmount();
        const second = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [plugin],
        });

        const labels = [...second.container.querySelectorAll('span')].filter(
            (span) => span.textContent === 'Intro',
        );

        expect(labels).toHaveLength(1);
    });

    it('plays the selected region on Enter', () => {
        const { container, media, plugin } = shown({
            items: [{ start: 8, end: 12 }],
        });

        plugin.select(plugin.list()[0].id);
        pressKey(container, 'Enter');

        expect(media.currentTime).toBe(8);
    });

    it('steps by the Shift key, not the letter case, so Caps Lock changes nothing', () => {
        const selected: (number | undefined)[] = [];
        const { container, plugin } = shown({
            items: [
                { start: 2, end: 4 },
                { start: 8, end: 12 },
                { start: 20, end: 24 },
            ],
            onSelect: (region) => selected.push(region?.start),
        });

        plugin.select(plugin.list()[0].id);
        pressKey(container, 'R');
        expect(selected.at(-1)).toBe(8);

        pressKey(container, 'r', { shiftKey: true });
        expect(selected.at(-1)).toBe(2);
    });

    it('creates by the gesture asked: a switch and its gesture, or the old single option', () => {
        const drawn = (options: RegionsOptions): number => {
            const { container, plugin } = shown(options);
            firePointer(container, 'pointerdown', 40);
            firePointer(container, 'pointermove', 100);
            firePointer(container, 'pointerup', 100);

            return plugin.items.length;
        };

        expect(drawn({ createGesture: 'drag' })).toBe(1);
        expect(drawn({ create: true, createGesture: 'drag' })).toBe(1);
        expect(drawn({ create: 'drag' })).toBe(1);
        expect(drawn({ create: false, createGesture: 'drag' })).toBe(0);
        expect(drawn({})).toBe(0);
    });

    it('takes its own letters, and lets each other key be turned off', () => {
        const selected: (number | undefined)[] = [];
        const { container, media, plugin } = shown({
            items: [
                { start: 2, end: 4 },
                { start: 8, end: 12 },
            ],
            keys: { select: 'n', remove: false, play: false },
            onSelect: (region) => selected.push(region?.start),
        });

        pressKey(container, 'r');
        expect(selected).toEqual([]);

        pressKey(container, 'n');
        expect(selected).toEqual([2]);

        pressKey(container, 'Enter');
        pressKey(container, 'Delete');
        expect(media.currentTime).toBe(0);
        expect(plugin.items).toHaveLength(2);
    });

    it('gives its regions as items, and replaces them all with set', () => {
        const changes: number[] = [];
        const { plugin } = shown({
            items: [{ start: 2, end: 4 }],
            onChange: (list) => changes.push(list.length),
        });

        expect(plugin.items).toEqual(plugin.list());

        plugin.set([
            { start: 10, end: 12, label: 'a' },
            { start: 20, end: 22, label: 'b' },
        ]);

        expect(plugin.items.map((region) => region.label)).toEqual(['a', 'b']);
        expect(changes).toEqual([2]);
    });

    it('keeps a label to 120 characters, or maxText up to 1000, when set and when changed', () => {
        const long = 'l'.repeat(2000);
        const plain = regions({ items: [{ start: 1, end: 2, label: long }] });
        const raised = regions({ maxText: 300 });
        raised.set([{ start: 1, end: 2, label: long }]);
        const id = raised.items[0].id;
        raised.update(id, { label: long });

        expect(plain.items[0].label).toHaveLength(120);
        expect(raised.items[0].label).toHaveLength(300);
        expect(() => regions({ maxText: 1001 })).toThrow(
            'maxText goes past its most, 1000',
        );
    });

    it('removes the selected region on Delete', () => {
        const { container, plugin } = shown({ items: [{ start: 8, end: 12 }] });

        plugin.select(plugin.list()[0].id);
        pressKey(container, 'Delete');

        expect(plugin.list()).toHaveLength(0);
    });

    it('shows a region added after setup right away, and reports it', () => {
        const changes: (readonly Region[])[] = [];
        const { container, plugin } = shown({
            onChange: (list) => changes.push(list),
        });

        plugin.add({ start: 4, end: 8, label: 'intro' });

        expect(changes).toHaveLength(1);
        expect(container.textContent).toContain('intro');
    });

    it('fits regions given up front to the sound once its length is known', () => {
        const changes: (readonly Region[])[] = [];
        const plugin = regions({
            items: [{ start: 20, end: 50 }],
            onChange: (list) => changes.push(list),
        });
        const { frame } = mount({ plugins: [plugin] });

        expect(plugin.list()[0]).toMatchObject({ start: 20, end: 50 });

        frame.setDuration(30);

        expect(plugin.list()[0]).toMatchObject({ start: 20, end: 30 });
        expect(changes.at(-1)?.[0]).toMatchObject({ start: 20, end: 30 });
    });

    it('returns null, not a region it did not keep, once max is reached', () => {
        const { plugin } = shown({ max: 1 });

        expect(plugin.add({ start: 1, end: 2 })).not.toBeNull();
        expect(plugin.add({ start: 3, end: 4 })).toBeNull();
        expect(plugin.list()).toHaveLength(1);
    });

    it('keeps a region at least the usual quarter second long when minLength is not a number', () => {
        for (const minLength of [Number.NaN, '1' as unknown as number]) {
            const { plugin } = shown({ minLength });

            expect(plugin.add({ start: 1, end: 1.1 })).toMatchObject({
                start: 1,
                end: 1.25,
            });
        }
    });

    it('keeps at most 200 regions when max is not a number', () => {
        const { plugin } = shown({ max: Number.NaN }, 400);

        for (let start = 0; start < 200; start++) {
            plugin.add({ start, end: start + 0.5 });
        }

        expect(plugin.list()).toHaveLength(200);
        expect(plugin.add({ start: 300, end: 301 })).toBeNull();
    });
});
