/**
 * The window of a frequency analysis is a power of two: the smallest one that reaches the size asked
 * for, kept between the smallest and the largest window allowed.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { powerOfTwo } from '../src/core/shared/math';

describe('powerOfTwo', () => {
    it('gives the smallest power of two that reaches the value, from min to max', () => {
        fc.assert(
            fc.property(
                fc.double({ min: -1e6, max: 1e6, noNaN: true }),
                fc.constantFrom([32, 2048], [32, 8192], [1, 1]),
                (value, [min, max]) => {
                    // An oracle by logarithm, not by the doubling the code does.
                    const reached =
                        2 ** Math.ceil(Math.log2(Math.max(value, 1)));

                    expect(powerOfTwo(value, min, max)).toBe(
                        Math.min(max, Math.max(min, reached)),
                    );
                },
            ),
        );
    });

    it('keeps a power of two it is given', () => {
        expect(powerOfTwo(1024, 32, 8192)).toBe(1024);
        expect(powerOfTwo(1025, 32, 8192)).toBe(2048);
        expect(powerOfTwo(5, 32, 2048)).toBe(32);
        expect(powerOfTwo(100_000, 32, 2048)).toBe(2048);
    });
});
