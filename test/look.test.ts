import { describe, expect, it } from 'vite-plus/test';
import {
    DEFAULT_LOOK,
    nextSpeed,
    resolveLook,
    speedText,
    timeText,
    type Part,
    type PlayerLook,
} from '../src/core/look';

describe('resolveLook', () => {
    it('keeps the base when nothing is given', () => {
        expect(resolveLook(DEFAULT_LOOK, undefined)).toEqual(DEFAULT_LOOK);
    });

    it('drops unknown and repeated parts, and keeps a part on one line only', () => {
        const look = resolveLook(DEFAULT_LOOK, {
            line: ['play', 'wave', 'flute' as Part, 'play', 'time'],
            meta: ['time', 'speed', 'wave'],
        });

        expect(look.line).toEqual(['play', 'wave', 'time']);
        expect(look.meta).toEqual(['speed']);
    });

    it('always has the wave: in the line, or on top and out of the line', () => {
        expect(
            resolveLook(DEFAULT_LOOK, { line: ['play', 'time'] }).line,
        ).toEqual(['play', 'wave', 'time']);
        expect(
            resolveLook(DEFAULT_LOOK, {
                wavePlace: 'top',
                line: ['play', 'wave', 'time'],
            }).line,
        ).toEqual(['play', 'time']);
    });

    it('keeps numbers in range and names to the known ones', () => {
        const look = resolveLook(DEFAULT_LOOK, {
            waveHeight: 500,
            corner: -3,
            weight: 1234,
            skip: Number.NaN,
            shadow: 'neon' as PlayerLook['shadow'],
            button: { shape: 'star' as 'circle', fill: 'outline', size: 1000 },
            speeds: [0.01, 1, Number.POSITIVE_INFINITY, 3],
        });

        expect(look.waveHeight).toBe(12);
        expect(look.corner).toBe(0);
        expect(look.weight).toBe(900);
        expect(look.skip).toBe(DEFAULT_LOOK.skip);
        expect(look.shadow).toBe(DEFAULT_LOOK.shadow);
        expect(look.button).toEqual({
            shape: DEFAULT_LOOK.button.shape,
            fill: 'outline',
            size: 96,
        });
        expect(look.speeds).toEqual([1, 3]);
    });

    it('caps the number of parts', () => {
        const many = Array.from({ length: 40 }, () => 'spacer' as Part);

        expect(
            resolveLook(DEFAULT_LOOK, { line: many }).line.length,
        ).toBeLessThanOrEqual(12);
    });
});

describe('timeText', () => {
    it('reads the time the way the look asks', () => {
        expect(timeText('elapsed', 5, 40)).toBe('0:05');
        expect(timeText('remaining', 5, 40)).toBe('-0:35');
        expect(timeText('duration', 5, 40)).toBe('0:40');
        expect(timeText('both', 5, 40)).toBe('0:05 / 0:40');
        expect(timeText('both', null, null)).toBe('0:00 / 0:00');
    });
});

describe('speeds', () => {
    it('steps through the speeds and wraps around', () => {
        expect(nextSpeed(1, [1, 1.5, 2])).toBe(1.5);
        expect(nextSpeed(2, [1, 1.5, 2])).toBe(1);
        expect(nextSpeed(1.25, [1, 1.5, 2])).toBe(1);
    });

    it('names a speed without trailing zeros', () => {
        expect(speedText(1)).toBe('1×');
        expect(speedText(1.5)).toBe('1.5×');
        expect(speedText(1.25)).toBe('1.25×');
    });
});
