import { describe, expect, it } from 'vite-plus/test';
import { groupMarks } from '../src/core/clusters';

describe('grouping marks', () => {
    it('joins marks within the distance into one cluster', () => {
        const clusters = groupMarks([10, 14, 100], 12);

        expect(clusters).toHaveLength(2);
        expect(clusters[0].indices).toEqual([0, 1]);
        expect(clusters[1].indices).toEqual([2]);
    });

    it('keeps the original indices through the sort', () => {
        const clusters = groupMarks([100, 10, 14], 12);

        expect(clusters[0].indices).toEqual([1, 2]);
        expect(clusters[1].indices).toEqual([0]);
    });

    it('centers a cluster between its ends', () => {
        const clusters = groupMarks([10, 20], 12);

        expect(clusters[0].center).toBe(15);
    });

    it('drops positions that are not finite', () => {
        expect(groupMarks([Number.NaN, 5], 12)).toHaveLength(1);
    });
});
