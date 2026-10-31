import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { keyAction } from '../src/core/keys';
import {
    defaultValueText,
    effectiveDuration,
    formatTime,
    stepRatio,
    timeAt,
} from '../src/core/timing';

describe('keyAction', () => {
    it('follows the slider pattern', () => {
        expect(keyAction('ArrowRight')).toEqual({
            kind: 'step',
            direction: 1,
            large: false,
        });
        expect(keyAction('ArrowDown')).toEqual({
            kind: 'step',
            direction: -1,
            large: false,
        });
        expect(keyAction('PageUp')).toEqual({
            kind: 'step',
            direction: 1,
            large: true,
        });
        expect(keyAction('Home')).toEqual({ kind: 'seek', ratio: 0 });
        expect(keyAction('End')).toEqual({ kind: 'seek', ratio: 1 });
        expect(keyAction('a')).toBeNull();
    });

    it('leaves shortcuts held with Ctrl, Alt or Meta to the page', () => {
        expect(keyAction('ArrowLeft', { ctrlKey: true })).toBeNull();
        expect(keyAction('Home', { altKey: true })).toBeNull();
        expect(keyAction('End', { metaKey: true })).toBeNull();
    });
});

describe('timing', () => {
    it('trusts only a real duration from the media', () => {
        expect(effectiveDuration(12, 30)).toBe(12);
        expect(effectiveDuration(NaN, 30)).toBe(30);
        expect(effectiveDuration(Infinity, 30)).toBe(30);
        expect(effectiveDuration(0, null)).toBeNull();
    });

    it('steps in seconds, or 5 % without a duration, and never past the ends', () => {
        expect(stepRatio(0.5, 1, false, 100, 5, 0.1)).toBeCloseTo(0.55);
        expect(stepRatio(0.5, -1, false, null, 5, 0.1)).toBeCloseTo(0.45);
        expect(stepRatio(0.5, 1, true, 100, 5, 0.1)).toBeCloseTo(0.6);
        expect(stepRatio(0.98, 1, false, 100, 5, 0.1)).toBe(1);
        expect(stepRatio(0.01, -1, true, 100, 5, 0.1)).toBe(0);
    });

    it('turns a ratio back into the very second it came from', () => {
        // In floating point, 5 / 77 * 77 is 4.999…: shown, that is 0:04 for a step to 0:05.
        expect(timeAt(5 / 77, 77)).toBe(5);

        // Any whole second of any sound up to a day long, real lengths with a fraction included.
        fc.assert(
            fc.property(
                fc
                    .double({ min: 1, max: 86400, noNaN: true })
                    .chain((duration) =>
                        fc.tuple(
                            fc.constant(duration),
                            fc.integer({ min: 0, max: Math.floor(duration) }),
                        ),
                    ),
                ([duration, second]) =>
                    timeAt(second / duration, duration) === second,
            ),
        );
    });

    it('keeps what is finer than a second, down to a tenth of a millisecond', () => {
        expect(timeAt(0.5, 25.123)).toBe(12.5615);
    });

    it('writes times for people', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(65.9)).toBe('1:05');
        expect(formatTime(3725)).toBe('1:02:05');
        expect(formatTime(NaN)).toBe('0:00');
        expect(defaultValueText(12, 0.4, 30)).toBe('0:12 / 0:30');
        expect(defaultValueText(null, 0.25, null)).toBe('25%');
    });
});
