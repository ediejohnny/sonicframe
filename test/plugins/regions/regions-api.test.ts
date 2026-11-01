/**
 * The regions' API holds up to what an app or a file hands it: every region keeps an id of its own,
 * times that are not numbers are refused, a change before the sound's length is known still counts,
 * a region taken away stops playing, and the app hears only of real changes, through copies.
 */

import { describe, expect, it } from 'vite-plus/test';
import { regions, type Region } from '../../../src/index';
import { playTo, pressKey } from '../../support/events';
import { mount } from '../../support/helpers';
import { shown } from './regions-harness';

describe('the regions API', () => {
    it('gives every region an id of its own, even when one comes twice or is one it would make', () => {
        const { plugin } = shown();
        const made = plugin.add({ start: 1, end: 2 });
        const next = `region-${Number(made?.id.split('-')[1]) + 1}`;

        plugin.set([
            { id: 'verse', start: 2, end: 4 },
            { id: 'verse', start: 6, end: 8 },
            { id: next, start: 10, end: 12 },
        ]);
        plugin.add({ start: 14, end: 16 });
        plugin.add({ id: 'verse', start: 18, end: 20 });

        const ids = plugin.items.map((region) => region.id);

        expect(new Set(ids).size).toBe(5);
        expect(ids.slice(0, 1)).toEqual(['verse']);
        expect(ids[2]).toBe(next);
    });

    it('removes only the region asked for once ids could have met', () => {
        const { plugin } = shown();

        plugin.set([
            { id: 'a', start: 2, end: 4 },
            { id: 'a', start: 6, end: 8 },
        ]);
        plugin.remove('a');

        expect(plugin.items.map((region) => region.start)).toEqual([6]);
    });

    it('refuses a region whose start or end is not a finite number', () => {
        const { plugin } = shown();

        expect(plugin.add({ start: Number.NaN, end: 4 })).toBeNull();
        expect(
            plugin.add({ start: 1, end: Number.POSITIVE_INFINITY }),
        ).toBeNull();
        expect(
            plugin.add({ start: '2' as unknown as number, end: 4 }),
        ).toBeNull();

        plugin.set([
            { start: 1, end: Number.NaN },
            { start: 5, end: 6 },
        ]);

        expect(plugin.items.map(({ start, end }) => [start, end])).toEqual([
            [5, 6],
        ]);
    });

    it('leaves a region as it was when an update gives a time that is not a number', () => {
        const { plugin } = shown({ items: [{ start: 8, end: 12 }] });
        const id = plugin.items[0].id;

        plugin.update(id, { start: Number.NaN, end: 14 });

        expect(plugin.items[0]).toMatchObject({ start: 8, end: 14 });
    });

    it('takes an update before the length of the sound is known, and fits it once it is', () => {
        const plugin = regions({ items: [{ start: 2, end: 5 }] });
        const { frame } = mount({ plugins: [plugin] });
        const id = plugin.items[0].id;

        plugin.update(id, { label: 'Intro', color: 'red', start: 8 });

        expect(plugin.items[0]).toMatchObject({
            label: 'Intro',
            color: 'red',
            start: 5,
            end: 8,
        });

        frame.setDuration(6);

        expect(plugin.items[0]).toMatchObject({ start: 5, end: 6 });
    });

    it('stops a looping region that is taken away, by the API or by Delete', () => {
        const taken = [
            (plugin: ReturnType<typeof shown>['plugin'], id: string) =>
                plugin.remove(id),
            (plugin: ReturnType<typeof shown>['plugin']) => plugin.clear(),
            (plugin: ReturnType<typeof shown>['plugin']) => plugin.set([]),
            (
                plugin: ReturnType<typeof shown>['plugin'],
                id: string,
                container: HTMLElement,
            ) => {
                plugin.select(id);
                pressKey(container, 'Delete');
            },
        ];

        for (const take of taken) {
            const { container, media, plugin } = shown(
                { items: [{ start: 8, end: 12 }] },
                40,
                false,
            );
            const id = plugin.items[0].id;

            plugin.play(id, { loop: true });
            take(plugin, id, container);
            playTo(media, 12.5);

            expect(media.currentTime).toBe(12.5);
        }
    });

    it('keeps another region playing when a different one is taken away', () => {
        const { media, plugin } = shown(
            {
                items: [
                    { start: 8, end: 12 },
                    { start: 20, end: 24 },
                ],
            },
            40,
            false,
        );
        const [first, second] = plugin.items;

        plugin.play(first.id, { loop: true });
        plugin.remove(second.id);
        playTo(media, 12.5);

        expect(media.currentTime).toBe(8);
    });

    it('leaves alone a stretch the app plays after the region stopped playing, by a seek away or its end', () => {
        const over = [
            (mounted: ReturnType<typeof shown>) =>
                mounted.frame.seekTo(30 / 40),
            (mounted: ReturnType<typeof shown>) => playTo(mounted.media, 12.5),
        ];

        for (const end of over) {
            const mounted = shown(
                { items: [{ start: 8, end: 12 }] },
                40,
                false,
            );
            const { frame, media, plugin } = mounted;
            const id = plugin.items[0].id;

            plugin.play(id);
            end(mounted);
            // The app's own stretch, inside the region's.
            frame.playRange(9, 11.5, { loop: true });
            plugin.remove(id);
            playTo(media, 11.6);

            expect(media.currentTime).toBe(9);
        }
    });

    it('hands onSelect a copy, so changing it changes no region', () => {
        let chosen: Region | null = null;
        const { plugin } = shown({
            items: [{ start: 8, end: 12 }],
            onSelect: (region) => {
                chosen = region;
            },
        });

        plugin.select(plugin.items[0].id);
        (chosen as unknown as Region).start = 30;

        expect(plugin.items[0].start).toBe(8);
    });

    it('selects nothing for an id it does not have, so the keys find nothing selected', () => {
        const selected: (Region | null)[] = [];
        const { container, plugin } = shown({
            items: [{ start: 8, end: 12 }],
            onSelect: (region) => selected.push(region),
        });

        plugin.select(plugin.items[0].id);
        plugin.select('nothing');

        expect(selected.at(-1)).toBeNull();
        expect(pressKey(container, 'l').defaultPrevented).toBe(false);
    });

    it('tells the app only of real changes', () => {
        const changes: number[] = [];
        const selections: (Region | null)[] = [];
        const { plugin } = shown({
            items: [{ start: 8, end: 12 }],
            onChange: (list) => changes.push(list.length),
            onSelect: (region) => selections.push(region),
        });
        const id = plugin.items[0].id;

        plugin.remove('nothing');
        plugin.update(id, { start: 8, end: 12 });
        plugin.update('nothing', { start: 1 });
        plugin.clear();
        plugin.set([]);
        plugin.clear();

        expect(changes).toEqual([0, 0]);
        expect(selections).toEqual([]);

        plugin.set([{ start: 1, end: 2 }]);
        plugin.select(plugin.items[0].id);
        plugin.select(plugin.items[0].id);
        plugin.clear();

        expect(selections.map((region) => region?.start ?? null)).toEqual([
            1,
            null,
        ]);
    });

    it('tells of a nudge that moves an edge, and of none held back at the start of the sound', () => {
        const changes: number[] = [];
        const { container, plugin } = shown({
            items: [{ start: 0, end: 4 }],
            onChange: (list) => changes.push(list[0].start),
        });

        plugin.select(plugin.items[0].id);
        pressKey(container, '[');
        expect(changes).toEqual([]);

        pressKey(container, '{');
        expect(changes).toEqual([0.5]);
    });

    it('lets R go on to the page when there is no region to select', () => {
        const { container } = shown();

        expect(pressKey(container, 'r').defaultPrevented).toBe(false);
    });

    it('switches the loop once for a held L, not at every repeat', () => {
        const { container, plugin } = shown({ items: [{ start: 8, end: 12 }] });

        plugin.select(plugin.items[0].id);
        pressKey(container, 'l');

        expect(
            pressKey(container, 'l', { repeat: true }).defaultPrevented,
        ).toBe(false);
        expect(document.querySelector('[role="status"]')?.textContent).toBe(
            'loop on',
        );
    });
});
