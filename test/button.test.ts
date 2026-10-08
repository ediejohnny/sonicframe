import { describe, expect, it } from 'vite-plus/test';
import {
    buttonStyles,
    iconSize,
    PAUSE_ICON,
    pausePath,
    PLAY_ICON,
    playPath,
    type ButtonLook,
} from '../src/core/button';

const LOOK: ButtonLook = {
    shape: 'circle',
    fill: 'solid',
    size: 32,
    colors: { background: '#4d6d94', icon: '#fff' },
};

function style(look: Partial<ButtonLook>): Record<string, string> {
    return Object.fromEntries(buttonStyles({ ...LOOK, ...look }));
}

describe('icons', () => {
    it('centers the play triangle by its centroid, so it does not look pushed aside', () => {
        const x = PLAY_ICON.reduce((sum, [px]) => sum + px, 0) / 3;
        const y = PLAY_ICON.reduce((sum, [, py]) => sum + py, 0) / 3;

        expect(x).toBeCloseTo(12, 1);
        expect(y).toBeCloseTo(12, 1);
    });

    it('centers the pause bars on the grid', () => {
        const left = Math.min(...PAUSE_ICON.map(([x]) => x));
        const right = Math.max(...PAUSE_ICON.map(([x, , w]) => x + w));
        const top = Math.min(...PAUSE_ICON.map(([, y]) => y));
        const bottom = Math.max(...PAUSE_ICON.map(([, y, , h]) => y + h));

        expect((left + right) / 2).toBe(12);
        expect((top + bottom) / 2).toBe(12);
    });

    it('writes both icons as SVG paths', () => {
        expect(playPath()).toBe('M8.5 5.5L8.5 18.5L19 12Z');
        expect(pausePath()).toBe('M6.5 5.5h3.5v13h-3.5ZM14 5.5h3.5v13h-3.5Z');
        expect(iconSize(32)).toBe(19);
        expect(iconSize(4)).toBe(8);
    });
});

describe('buttonStyles', () => {
    it('draws each shape', () => {
        expect(style({ shape: 'circle' })['border-radius']).toBe('50%');
        expect(style({ shape: 'rounded' })['border-radius']).toBe('25%');
        expect(style({ shape: 'square' })['border-radius']).toBe('0');
        expect(style({ shape: 'circle', radius: 3 })['border-radius']).toBe(
            '3px',
        );
    });

    it('fills, rings or leaves only the icon', () => {
        expect(style({ fill: 'solid' })).toMatchObject({
            background: '#4d6d94',
            color: '#fff',
            border: '0',
        });
        expect(style({ fill: 'outline' })).toMatchObject({
            background: 'transparent',
            color: '#4d6d94',
            border: '1px solid #4d6d94',
        });
        expect(style({ fill: 'ghost' })).toMatchObject({
            background: 'transparent',
            color: '#4d6d94',
            border: '0',
        });
    });

    it('is exactly as wide as it is tall', () => {
        expect(style({ size: 28 })).toMatchObject({
            width: '28px',
            height: '28px',
            padding: '0',
        });
    });
});
