/**
 * What the app hears while the pointer draws, moves or resizes a region: `onInput` at every move that
 * changes it, and `onChange` once, when the drag ends with a change. A press that changes nothing
 * says nothing, and a drawing cut short goes without ever reaching `onChange`.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { Region, RegionsOptions } from '../../../src/index';
import { firePointer, pressKey } from '../../support/events';
import { shown } from './regions-harness';

/** A frame with regions whose `onInput` and `onChange` calls are kept, each as the regions it got. */
function heard(options: RegionsOptions = {}): ReturnType<typeof shown> & {
    inputs: (readonly Region[])[];
    changes: (readonly Region[])[];
} {
    const inputs: (readonly Region[])[] = [];
    const changes: (readonly Region[])[] = [];
    const mounted = shown({
        ...options,
        onInput: (list) => inputs.push(list),
        onChange: (list) => changes.push(list),
    });

    return { ...mounted, inputs, changes };
}

describe('regions under the pointer', () => {
    it('tells onInput at every move of a drawing, and onChange once, when it is let go', () => {
        const { container, inputs, changes } = heard();

        // 200 px for 40 s: 5 px a second.
        firePointer(container, 'pointerdown', 40, { shiftKey: true });
        firePointer(container, 'pointermove', 60, { shiftKey: true });
        firePointer(container, 'pointermove', 80, { shiftKey: true });
        firePointer(container, 'pointermove', 100, { shiftKey: true });
        firePointer(container, 'pointerup', 100, { shiftKey: true });

        expect(inputs.map((list) => list[0].end)).toEqual([12, 16, 20]);
        expect(changes).toHaveLength(1);
        expect(changes[0][0]).toMatchObject({ start: 8, end: 20 });
    });

    it('tells onInput while a region moves, and onChange once at the end', () => {
        const { container, inputs, changes } = heard({
            items: [{ start: 8, end: 16 }],
        });

        firePointer(container, 'pointerdown', 60);
        firePointer(container, 'pointermove', 70);
        firePointer(container, 'pointermove', 80);
        firePointer(container, 'pointerup', 80);

        expect(inputs.map((list) => list[0].start)).toEqual([10, 12]);
        expect(changes).toHaveLength(1);
        expect(changes[0][0]).toMatchObject({ start: 12, end: 20 });
    });

    it('says nothing for a press on a region that moves nothing', () => {
        const { container, inputs, changes } = heard({
            items: [{ start: 8, end: 16 }],
        });

        firePointer(container, 'pointerdown', 60);
        firePointer(container, 'pointerup', 60);

        expect(inputs).toEqual([]);
        expect(changes).toEqual([]);
    });

    it('lets a drawing cut short go, told to onInput only, with nothing left selected', () => {
        const { container, inputs, changes, plugin } = heard();

        firePointer(container, 'pointerdown', 40, { shiftKey: true });
        firePointer(container, 'pointermove', 100, { shiftKey: true });
        firePointer(container, 'pointercancel', 100);

        expect(plugin.items).toEqual([]);
        expect(inputs.map((list) => list.length)).toEqual([1, 0]);
        expect(changes).toEqual([]);
        expect(pressKey(container, 'l').defaultPrevented).toBe(false);
    });

    it('keeps a move cut short and tells onChange of it', () => {
        const { container, changes, plugin } = heard({
            items: [{ start: 8, end: 16 }],
        });

        firePointer(container, 'pointerdown', 60);
        firePointer(container, 'pointermove', 80);
        firePointer(container, 'pointercancel', 80);

        expect(plugin.items[0]).toMatchObject({ start: 12, end: 20 });
        expect(changes).toHaveLength(1);
    });
});
