import { describe, expect, it } from 'vite-plus/test';
import { stackLanes } from '../src/core/lanes';

describe('stacking lanes around the bars', () => {
    it('a 14px lane below leaves 18 of a 32px frame to the wave', () => {
        const inset = stackLanes([], [14], 32);

        expect(inset.bottom).toBe(14);
        expect(inset.top).toBe(0);
        expect(inset.waveHeight).toBe(18);
        expect(inset.below).toEqual([14]);
    });

    it('splits room between a lane above and a lane below', () => {
        const inset = stackLanes([12], [14], 60);

        expect(inset.top).toBe(12);
        expect(inset.bottom).toBe(14);
        expect(inset.waveHeight).toBe(34);
    });

    it('ignores non-positive lane sizes', () => {
        const inset = stackLanes([0], [14, -3], 32);

        expect(inset.above).toEqual([]);
        expect(inset.below).toEqual([14]);
        expect(inset.waveHeight).toBe(18);
    });

    it('drops the outermost lane rather than starve the wave', () => {
        // 16 + 14 would leave 2px; the wave must keep at least 8, so the below lane is dropped.
        const inset = stackLanes([16], [14], 32);

        expect(inset.below).toEqual([]);
        expect(inset.above).toEqual([16]);
        expect(inset.waveHeight).toBe(16);
    });

    it('drops every lane when there is no room at all', () => {
        const inset = stackLanes([], [14], 10);

        expect(inset.below).toEqual([]);
        expect(inset.waveHeight).toBe(10);
    });
});
