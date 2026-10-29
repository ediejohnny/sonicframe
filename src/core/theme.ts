/**
 * Themes: a whole player in one name. A theme holds a look, a palette, a drawing of the sound and the
 * bars; a player's own options always win over its theme. Everything builds on the `default` theme
 * (SonicFrame as it always looked): no theme, an unknown name, or a theme that extends nothing all
 * end up on it. Apps make their own with `defineTheme({ extends, ... })` and can give one a name with
 * `registerTheme`, so it is as easy to use as a built-in one. A registered theme is stored already
 * resolved, so extending it never walks a chain (no loop can form). Bar numbers are kept in range
 * here, like the look's.
 */

import type { BarStyle, WaveName, WaveStyle } from '../types';
import { DEFAULT_LOOK, resolveLook, type PlayerLook } from './look';
import type { PaletteChoice, PaletteName } from './palettes';
import { THEMES, isThemeName } from './themes';

export type Theme = {
    /** How the player is put together. */
    look: Partial<PlayerLook>;
    /** The palette used unless the player names one (`'default'`: SonicFrame's own colors). */
    palette: PaletteName | 'auto' | 'default';
    /** How the sound is drawn. */
    wave: Partial<WaveStyle>;
    /** The bars' density and shape. */
    bar: Partial<BarStyle>;
};

/** A theme to make: any part of one, laid over the theme named in `extends`. */
export type ThemeInput = Partial<Theme> & { extends?: string };

/** What a player is built from, once its options and its theme are combined. */
export type ThemeParts = {
    look: PlayerLook;
    palette: PaletteChoice;
    wave: Partial<WaveStyle>;
    bar: Partial<BarStyle>;
};

/** A registered theme's name: lowercase letters, digits and dashes, starting with a letter. */
const THEME_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** The most themes an app may register. */
const MAX_REGISTERED = 100;

const registry = new Map<string, Theme>();

function within(value: unknown, lo: number, hi: number): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(hi, Math.max(lo, value))
        : undefined;
}

/** The bar details that are valid, numbers kept in range; anything else is left to the default. */
export function cleanBar(
    bar: Partial<BarStyle> | undefined,
): Partial<BarStyle> {
    const clean: Partial<BarStyle> = {};
    const given = bar ?? {};
    const ranges: [keyof BarStyle, number, number][] = [
        ['width', 0.5, 32],
        ['gap', 0, 32],
        ['radius', 0, 32],
        ['minHeight', 0, 64],
        ['curve', 0.1, 4],
    ];

    for (const [key, lo, hi] of ranges) {
        const value = within(given[key], lo, hi);

        if (value !== undefined) {
            (clean as Record<string, number>)[key] = value;
        }
    }

    if (given.align === 'center' || given.align === 'bottom') {
        clean.align = given.align;
    }

    return clean;
}

function mergeLook(
    base: Partial<PlayerLook>,
    over: Partial<PlayerLook> | undefined,
): Partial<PlayerLook> {
    const merged: Partial<PlayerLook> = { ...base, ...over };

    if (base.button !== undefined || over?.button !== undefined) {
        merged.button = {
            ...base.button,
            ...over?.button,
        } as PlayerLook['button'];
    }

    return merged;
}

/** A built-in or registered theme by name, or null. */
export function findTheme(name: string): Theme | null {
    if (isThemeName(name)) {
        return THEMES[name];
    }

    return registry.get(name) ?? null;
}

/** A theme from `input`, laid over the theme it `extends` (the default theme for none or an unknown name). */
export function defineTheme(input: ThemeInput): Theme {
    const parent =
        typeof input.extends === 'string'
            ? (findTheme(input.extends) ?? THEMES.default)
            : THEMES.default;

    return {
        look: mergeLook(parent.look, input.look),
        palette: input.palette ?? parent.palette,
        wave: { ...parent.wave, ...input.wave },
        bar: cleanBar({ ...parent.bar, ...input.bar }),
    };
}

/**
 * Gives a theme a name players can use (`theme: 'brand-note'`). Built-in names cannot be replaced;
 * returns false for a name that is taken by one, malformed, or past the limit of registered themes.
 */
export function registerTheme(name: string, input: ThemeInput): boolean {
    if (
        !THEME_NAME.test(name) ||
        isThemeName(name) ||
        (registry.size >= MAX_REGISTERED && !registry.has(name))
    ) {
        return false;
    }

    registry.set(name, defineTheme(input));

    return true;
}

/** A player's own options laid over its theme (the default theme when there is none). */
export function themeParts(
    theme: Theme | null,
    options: {
        look?: Partial<PlayerLook>;
        palette?: PaletteChoice;
        wave?: WaveName | Partial<WaveStyle>;
        bar?: Partial<BarStyle>;
    },
): ThemeParts {
    const base = theme ?? THEMES.default;
    const own: Partial<WaveStyle> =
        typeof options.wave === 'string'
            ? { style: options.wave }
            : (options.wave ?? {});

    return {
        look: resolveLook(resolveLook(DEFAULT_LOOK, base.look), options.look),
        palette: options.palette ?? base.palette,
        wave: { ...base.wave, ...own },
        bar: cleanBar({ ...base.bar, ...options.bar }),
    };
}
