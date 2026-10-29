/**
 * Ready-made color palettes, as plain hex colors (a translucent one carries its alpha in the last two
 * digits). A palette reaches the frame, the button and every plugin through `--sonicframe-*` custom
 * properties, so plain CSS can still override any single color. Each palette keeps text readable and
 * controls visible on its own surface (WCAG contrast, checked by the tests).
 */

export type Palette = {
    /** The player's background. */
    surface: string;
    /** Text such as the time. */
    text: string;
    /** Quieter text: labels, the ruler. */
    muted: string;
    /** Lines around the player. */
    border: string;
    /** Bars not yet played. */
    wave: string;
    /** Bars already played, and the knob. */
    progress: string;
    /** The play button. */
    accent: string;
    /** Icons and text on `accent`, `progress` and `marker`. */
    onAccent: string;
    /** Markers. */
    marker: string;
    /** The band of a region (translucent). */
    region: string;
    /** Dimmed silences and badges (translucent). */
    dim: string;
};

export type PaletteName =
    | 'light'
    | 'dark'
    | 'ocean'
    | 'forest'
    | 'sunset'
    | 'berry'
    | 'paper'
    | 'contrast';

export const PALETTES: Readonly<Record<PaletteName, Readonly<Palette>>> =
    Object.freeze({
        light: {
            surface: '#ffffff',
            text: '#1f2530',
            muted: '#5c6676',
            border: '#d5dbe4',
            wave: '#c2cad6',
            progress: '#3d5f8c',
            accent: '#3d5f8c',
            onAccent: '#ffffff',
            marker: '#c2410c',
            region: '#3d5f8c2e',
            dim: '#1f25301a',
        },
        dark: {
            surface: '#161b22',
            text: '#e6edf3',
            muted: '#9aa7b4',
            border: '#30363d',
            wave: '#3a4552',
            progress: '#7aa2d6',
            accent: '#7aa2d6',
            onAccent: '#0d1117',
            marker: '#f0883e',
            region: '#7aa2d633',
            dim: '#ffffff1a',
        },
        ocean: {
            surface: '#eef6f8',
            text: '#0f2a33',
            muted: '#3f5f6a',
            border: '#c3dde3',
            wave: '#a9cdd6',
            progress: '#0e7490',
            accent: '#0e7490',
            onAccent: '#ffffff',
            marker: '#c2410c',
            region: '#0e74902e',
            dim: '#0f2a331a',
        },
        forest: {
            surface: '#f1f6f0',
            text: '#18261b',
            muted: '#4a5d4e',
            border: '#cfdccb',
            wave: '#b5cbb3',
            progress: '#2f6b3a',
            accent: '#2f6b3a',
            onAccent: '#ffffff',
            marker: '#b45309',
            region: '#2f6b3a2e',
            dim: '#18261b1a',
        },
        sunset: {
            surface: '#fff4ec',
            text: '#2b1a12',
            muted: '#6b4a3a',
            border: '#f2d4c2',
            wave: '#f0c4a8',
            progress: '#c2410c',
            accent: '#c2410c',
            onAccent: '#ffffff',
            marker: '#7c3aed',
            region: '#c2410c2e',
            dim: '#2b1a121a',
        },
        berry: {
            surface: '#fbf1f6',
            text: '#2a1222',
            muted: '#6a4560',
            border: '#edd0e0',
            wave: '#e6b8d0',
            progress: '#9d1d63',
            accent: '#9d1d63',
            onAccent: '#ffffff',
            marker: '#0e7490',
            region: '#9d1d632e',
            dim: '#2a12221a',
        },
        paper: {
            surface: '#f7f1e3',
            text: '#2e2617',
            muted: '#6b5d43',
            border: '#e3d6b8',
            wave: '#d8c9a6',
            progress: '#7a4f1d',
            accent: '#7a4f1d',
            onAccent: '#fffaf0',
            marker: '#a61b1b',
            region: '#7a4f1d2e',
            dim: '#2e26171a',
        },
        contrast: {
            surface: '#000000',
            text: '#ffffff',
            muted: '#e0e0e0',
            border: '#ffffff',
            wave: '#6b6b6b',
            progress: '#ffd400',
            accent: '#ffd400',
            onAccent: '#000000',
            marker: '#00e5ff',
            region: '#ffd40040',
            dim: '#ffffff26',
        },
    });

export const PALETTE_NAMES: readonly PaletteName[] = Object.freeze(
    Object.keys(PALETTES) as PaletteName[],
);

export function isPaletteName(value: unknown): value is PaletteName {
    return (
        typeof value === 'string' &&
        (PALETTE_NAMES as readonly string[]).includes(value)
    );
}

/** A palette by name; `'auto'` follows the system (dark or light). Unknown names give null. */
export function pickPalette(
    name: string,
    dark: boolean,
): Readonly<Palette> | null {
    if (name === 'auto') {
        return dark ? PALETTES.dark : PALETTES.light;
    }

    return isPaletteName(name) ? PALETTES[name] : null;
}

/** The custom properties a palette sets, read by the frame, the button and the plugins. */
export function paletteVariables(palette: Palette): [string, string][] {
    return [
        ['--sonicframe-surface', palette.surface],
        ['--sonicframe-text', palette.text],
        ['--sonicframe-muted', palette.muted],
        ['--sonicframe-border', palette.border],
        ['--sonicframe-wave', palette.wave],
        ['--sonicframe-progress', palette.progress],
        ['--sonicframe-knob', palette.progress],
        ['--sonicframe-button', palette.accent],
        ['--sonicframe-button-icon', palette.onAccent],
        ['--sonicframe-on-progress', palette.onAccent],
        ['--sonicframe-marker', palette.marker],
        ['--sonicframe-timeline', palette.muted],
        ['--sonicframe-region', palette.region],
        ['--sonicframe-dim', palette.dim],
        ['--sonicframe-badge', palette.dim],
    ];
}
