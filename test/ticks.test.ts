import { describe, expect, it } from 'vite-plus/test';
import { niceTicks } from '../src/core/ticks';

describe('nice timeline ticks', () => {
    it('steps by 10 seconds for a minute across 300px', () => {
        const { step, times } = niceTicks(60, 300, 48);

        expect(step).toBe(10);
        expect(times).toContain(10);
        expect(times.at(-1)).toBe(60);
    });

    it('spaces labels at least the minimum apart', () => {
        const { step } = niceTicks(60, 200, 48);

        // 200px / 60s: a 10s step would be ~33px apart, too tight, so it picks 15s (~50px).
        expect(step).toBe(15);
    });

    it('never returns more than a couple hundred marks', () => {
        const { times } = niceTicks(100000, 300, 48);

        expect(times.length).toBeLessThanOrEqual(200);
    });

    it('returns nothing without a width or duration', () => {
        expect(niceTicks(0, 300, 48).times).toEqual([]);
        expect(niceTicks(60, 0, 48).times).toEqual([]);
    });

    it('marks only the part in view, spaced for that part', () => {
        // 25 s of a 100 s sound across 200 px: a 10 s step is 80 px apart, a 5 s one only 40.
        const { step, times } = niceTicks(100, 200, 48, 50, 75);

        expect(step).toBe(10);
        expect(times).toEqual([50, 60, 70]);
    });

    it('reaches tenths of a second when zoomed far in', () => {
        const { step, times } = niceTicks(100, 200, 48, 12.03, 12.53);

        expect(step).toBe(0.2);
        expect(times).toEqual([12.2, 12.4]);
    });

    it('takes the whole sound for a range that is not one', () => {
        expect(niceTicks(60, 300, 48, 30, 10)).toEqual(niceTicks(60, 300, 48));
        expect(niceTicks(60, 300, 48, NaN, 10)).toEqual(niceTicks(60, 300, 48));
    });
});
