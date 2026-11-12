/**
 * A ceiling taken from outside: its default when none is given, the value asked for from its least to
 * its most, a `RangeError` naming the option past either end, and a tag's value that only lowers it.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { limitOf, tagLimit, type Limit } from '../../../src/core/shared/limits';

const DEPTH: Limit = { value: 100, least: 1, most: 256, whole: true };
const SECONDS: Limit = { value: 1800, least: 1, most: 36_000, whole: false };

describe('limitOf', () => {
    it('gives the default when nothing, or no finite number, is given', () => {
        for (const given of [
            undefined,
            null,
            'big',
            Number.NaN,
            Infinity,
            {},
        ]) {
            expect(limitOf('maxDepth', given, DEPTH)).toBe(100);
        }
    });

    it('takes a value from the least to the most, the ends included', () => {
        expect(limitOf('maxDepth', 1, DEPTH)).toBe(1);
        expect(limitOf('maxDepth', 256, DEPTH)).toBe(256);
        expect(limitOf('maxSeconds', 36_000, SECONDS)).toBe(36_000);
        expect(limitOf('maxSeconds', 90.5, SECONDS)).toBe(90.5);
    });

    it('rounds a count down, never a length of time', () => {
        expect(limitOf('maxDepth', 7.9, DEPTH)).toBe(7);
        expect(limitOf('maxSeconds', 7.9, SECONDS)).toBe(7.9);
    });

    it('refuses past the most with a RangeError naming the option, its most and the value', () => {
        expect(() => limitOf('maxDepth', 257, DEPTH)).toThrow(
            new RangeError(
                'sonicframe: maxDepth goes past its most, 256 (257)',
            ),
        );
    });

    it('refuses under the least, so a ceiling never turns into 0 by mistake', () => {
        expect(() => limitOf('maxDepth', 0, DEPTH)).toThrow(
            new RangeError('sonicframe: maxDepth goes under its least, 1 (0)'),
        );
        expect(() => limitOf('maxSeconds', -5, SECONDS)).toThrow(RangeError);
    });

    it('never gives a value outside its ends: the one asked for inside them, a RangeError outside', () => {
        fc.assert(
            fc.property(
                fc.double({ noNaN: true, noDefaultInfinity: true }),
                (given) => {
                    const inside = given >= 1 && given <= 36_000;

                    if (inside) {
                        expect(limitOf('maxSeconds', given, SECONDS)).toBe(
                            given,
                        );
                    } else {
                        expect(() =>
                            limitOf('maxSeconds', given, SECONDS),
                        ).toThrow(RangeError);
                    }
                },
            ),
        );
    });
});

describe('tagLimit', () => {
    it('lets a tag lower the default, never raise it, nor go under the least', () => {
        expect(tagLimit('50', DEPTH)).toBe(50);
        expect(tagLimit('256', DEPTH)).toBe(100);
        expect(tagLimit('0', DEPTH)).toBe(1);
        expect(tagLimit('2.9', DEPTH)).toBe(2);
    });

    it('is undefined without the attribute, or with no number in it', () => {
        expect(tagLimit(null, DEPTH)).toBeUndefined();
        expect(tagLimit('lots', DEPTH)).toBeUndefined();
        expect(tagLimit('', DEPTH)).toBeUndefined();
    });
});
