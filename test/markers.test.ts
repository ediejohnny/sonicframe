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

    it('places the moments through a view and leaves out those outside it', () => {
        // 50 s to 75 s across 200 px: 55 s at 40 px, 75 s on the right edge, 10 s out of view.
        expect(
            markerSpans([55, 10, 75], 100, 200, 2, { start: 0.5, end: 0.75 }),
        ).toEqual([
            { x: 39, width: 2 },
            { x: 198, width: 2 },
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
