import { describe, expect, it } from 'vite-plus/test';
import {
    mixColors,
    resolveColor,
    rgbaFromBytes,
    rgbaString,
} from '../src/core/color';

const theme: Record<string, string> = {
    '--voice': ' #2f6fdb ',
    '--accent': 'var(--voice)',
    '--loop-a': 'var(--loop-b)',
    '--loop-b': 'var(--loop-a)',
};

const lookup = (name: string): string => theme[name] ?? '';

describe('resolveColor', () => {
    it('leaves plain colors alone', () => {
        expect(resolveColor('rgb(1 2 3)', lookup)).toBe('rgb(1 2 3)');
        expect(resolveColor(' red ', lookup)).toBe('red');
    });

    it('follows variables, including variables that point to variables', () => {
        expect(resolveColor('var(--voice)', lookup)).toBe('#2f6fdb');
        expect(resolveColor('var( --accent )', lookup)).toBe('#2f6fdb');
    });

    it('uses the fallback of an unknown variable, even one with parentheses', () => {
        expect(resolveColor('var(--missing, rgb(10 20 30))', lookup)).toBe(
            'rgb(10 20 30)',
        );
        expect(resolveColor('var(--missing, var(--voice))', lookup)).toBe(
            '#2f6fdb',
        );
        expect(resolveColor('var(--missing)', lookup)).toBe('');
    });

    it('gives up on variables that point to each other', () => {
        expect(resolveColor('var(--loop-a)', lookup)).toBe('');
    });
});

describe('mixing', () => {
    it('blends two colors and writes them for the canvas', () => {
        const mixed = mixColors([0, 100, 200, 1], [200, 100, 0, 0.5], 0.5);

        expect(mixed).toEqual([100, 100, 100, 0.75]);
        expect(rgbaString(mixed)).toBe('rgba(100, 100, 100, 0.75)');
        expect(rgbaFromBytes([255, 0, 10, 255])).toEqual([255, 0, 10, 1]);
    });
});
