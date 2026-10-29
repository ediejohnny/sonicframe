import { describe, expect, it } from 'vite-plus/test';
import { isDrag } from '../src/core/gesture';
import { rangeStep } from '../src/core/range';

describe('range stepping', () => {
    const range = { start: 2, end: 5, loop: false };

    it('is inside between the start and the end', () => {
        expect(rangeStep(3, range)).toBe('inside');
    });

    it('stops at the end when it does not loop', () => {
        expect(rangeStep(5, range)).toBe('stop');
    });

    it('wraps at the end when it loops', () => {
        expect(rangeStep(5, { ...range, loop: true })).toBe('wrap');
    });

    it('stops when the listener seeks before the start', () => {
        expect(rangeStep(1, range)).toBe('stop');
    });

    it('tolerates a little slack at the start (a fresh wrap)', () => {
        expect(rangeStep(1.98, range)).toBe('inside');
    });
});

describe('tap versus drag', () => {
    it('stays a tap within the threshold', () => {
        expect(isDrag(100, 103)).toBe(false);
    });

    it('becomes a drag past the threshold', () => {
        expect(isDrag(100, 104)).toBe(true);
        expect(isDrag(100, 96)).toBe(true);
    });
});
