import { describe, expect, it } from 'vite-plus/test';
import { markers, markerSpans } from '../src/plugins/markers';
import type { PluginHost } from '../src/types';

describe('markerSpans', () => {
    it('centers each line on its moment, inside the frame', () => {
        expect(markerSpans([0, 15, 30], 30, 300, 4)).toEqual([
            { x: 0, width: 4 },
            { x: 148, width: 4 },
            { x: 296, width: 4 },
        ]);
    });

    it('draws nothing while the duration is unknown, and skips broken moments', () => {
        expect(markerSpans([5], null, 300, 4)).toEqual([]);
        expect(markerSpans([5], NaN, 300, 4)).toEqual([]);
        expect(markerSpans([NaN, 10], 20, 100, 2)).toEqual([
            { x: 49, width: 2 },
        ]);
    });
});

describe('markers plugin', () => {
    it('asks its frame for a new picture when the moments change', () => {
        let invalidated = 0;
        const plugin = markers({ times: [1] });
        plugin.setup?.({
            invalidate: () => invalidated++,
        } as unknown as PluginHost);

        plugin.set([2, 3]);

        expect(plugin.times).toEqual([2, 3]);
        expect(invalidated).toBe(1);
    });
});
