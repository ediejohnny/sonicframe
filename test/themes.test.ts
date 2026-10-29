import { describe, expect, it } from 'vite-plus/test';
import { DEFAULT_LOOK, resolveLook } from '../src/core/look';
import { isPaletteName } from '../src/core/palettes';
import { DEFAULT_WAVE, resolveWave } from '../src/core/shapes';
import {
    cleanBar,
    defineTheme,
    findTheme,
    registerTheme,
    themeParts,
} from '../src/core/theme';
import { THEME_NAMES, THEMES } from '../src/core/themes';

describe('the built-in themes', () => {
    it('are at least twenty, each named once', () => {
        expect(THEME_NAMES.length).toBeGreaterThanOrEqual(20);
        expect(new Set(THEME_NAMES).size).toBe(THEME_NAMES.length);
        expect([...THEME_NAMES].sort()).toEqual(Object.keys(THEMES).sort());
    });

    it('use only valid values, so nothing silently falls back', () => {
        for (const name of THEME_NAMES) {
            const theme = THEMES[name];
            const look = resolveLook(DEFAULT_LOOK, theme.look);
            const wave = resolveWave(DEFAULT_WAVE, theme.wave);

            for (const [key, value] of Object.entries(theme.look)) {
                expect(
                    look[key as keyof typeof look],
                    `${name}.look.${key}`,
                ).toEqual(
                    key === 'button'
                        ? Object.assign({}, DEFAULT_LOOK.button, value)
                        : value,
                );
            }

            for (const [key, value] of Object.entries(theme.wave)) {
                expect(
                    wave[key as keyof typeof wave],
                    `${name}.wave.${key}`,
                ).toEqual(value);
            }

            expect(cleanBar(theme.bar), `${name}.bar`).toEqual(theme.bar);
            expect(
                isPaletteName(theme.palette) || theme.palette === 'default',
                `${name}.palette`,
            ).toBe(true);
        }
    });

    it('all look different', () => {
        const shapes = THEME_NAMES.map((name) => {
            const { look, wave, bar } = THEMES[name];

            return JSON.stringify({ look, wave, bar });
        });

        expect(new Set(shapes).size).toBe(shapes.length);
    });
});

describe('themeParts', () => {
    it('lets the player’s own options win over the theme, and the theme over the defaults', () => {
        const parts = themeParts(THEMES.pulse, {
            palette: 'ocean',
            look: { corner: 0 },
            wave: 'line',
            bar: { gap: 5 },
        });

        expect(parts.palette).toBe('ocean');
        expect(parts.look.corner).toBe(0);
        expect(parts.look.font).toBe(
            resolveLook(DEFAULT_LOOK, THEMES.pulse.look).font,
        );
        expect(parts.wave).toEqual({ ...THEMES.pulse.wave, style: 'line' });
        expect(parts.bar).toEqual({ ...THEMES.pulse.bar, gap: 5 });
    });

    it('wears the default theme without one: the default look, bars and SonicFrame’s own colors', () => {
        const parts = themeParts(null, {});

        expect(THEMES.default).toBeDefined();
        expect(parts.look).toEqual(DEFAULT_LOOK);
        expect(parts.palette).toBe('default');
        expect(parts.wave).toEqual({ style: 'bars' });
        expect(parts.bar).toEqual({});
    });
});

describe('defineTheme and registerTheme', () => {
    it('extends a theme by name and changes only what is given', () => {
        const theme = defineTheme({ extends: 'bubble', palette: 'dark' });

        expect(theme.palette).toBe('dark');
        expect(theme.look).toEqual(THEMES.bubble.look);
        expect(theme.wave).toEqual(THEMES.bubble.wave);
    });

    it('builds on the default theme when it extends nothing, or a name that does not exist', () => {
        expect(defineTheme({ look: { corner: 0 } }).palette).toBe('default');
        expect(defineTheme({ extends: 'lava' }).wave).toEqual(
            THEMES.default.wave,
        );
    });

    it('merges the button instead of replacing it', () => {
        const theme = defineTheme({
            extends: 'bubble',
            look: { button: { size: 50 } as never },
        });

        expect(theme.look.button).toEqual({
            ...THEMES.bubble.look.button,
            size: 50,
        });
    });

    it('registers a theme under a new, simple name only', () => {
        expect(registerTheme('brand-note', { extends: 'pill' })).toBe(true);
        expect(findTheme('brand-note')?.wave).toEqual(THEMES.pill.wave);
        expect(registerTheme('bubble', {})).toBe(false);
        expect(registerTheme('Not A Name', {})).toBe(false);
        expect(registerTheme('x'.repeat(40), {})).toBe(false);
        expect(findTheme('nothing-here')).toBeNull();
    });

    it('extends a registered theme one step at a time, so a loop cannot form', () => {
        registerTheme('step-a', { extends: 'card', palette: 'forest' });
        registerTheme('step-b', { extends: 'step-a' });

        expect(findTheme('step-b')?.palette).toBe('forest');
        expect(findTheme('step-b')?.look).toEqual(THEMES.card.look);
    });
});

describe('cleanBar', () => {
    it('keeps bar numbers in range and the alignment to its two names', () => {
        expect(
            cleanBar({
                width: 1000,
                gap: -2,
                radius: Number.NaN,
                curve: 0,
                align: 'sideways' as 'center',
            }),
        ).toEqual({ width: 32, gap: 0, curve: 0.1 });
    });
});
