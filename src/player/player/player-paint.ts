/**
 * How a player looks around its parts: the palette's variables on its root, its own box with its
 * sizes from the look, and a chapters list's own look laid over the player's. Shadows and the glass
 * surface are built only from the palette's colors read back as numbers, never from a raw page value.
 */

import type { FontName } from '../../core/player/fonts';
import type { PlayerLook } from '../../core/player/look';
import {
    choosePalette,
    DEFAULT_PALETTE,
    paletteVariables,
    type Palette,
    type PaletteChoice,
} from '../../core/player/palettes';
import { within } from '../../core/shared/checked';
import { rgbaString, type Rgba } from '../../core/shared/color';
import { css } from '../../dom/shared/css';
import { useFont } from '../../dom/shared/fonts';
import { readColor } from '../../dom/shared/paint';
import { onSchemeChange, prefersDark } from '../../dom/shared/scheme';
import type { PlayerChapterList } from './player-options';

/** A list's own look, as the app gave it: its palette, its font and its box. */
export type OwnLook = Pick<PlayerChapterList, 'palette' | 'font' | 'style'>;

function withAlpha(color: Rgba | null, alpha: number): string {
    const [red, green, blue] = color ?? [0, 0, 0, 1];

    return rgbaString([red, green, blue, alpha]);
}

/**
 * A box shadow by name, for the player and its list: none, a soft one, a hard offset one in the
 * text color or a glow in the played color, built from the palette's colors read as numbers.
 */
export function shadowOf(kind: PlayerLook['shadow'], palette: Palette): string {
    switch (kind) {
        case 'soft':
            return '0 0.0625rem 0.25rem rgba(0, 0, 0, 0.12), 0 0.25rem 1rem rgba(0, 0, 0, 0.08)';
        case 'hard':
            return `0.25rem 0.25rem 0 ${withAlpha(readColor(palette.text), 1)}`;
        case 'glow':
            return `0 0 1rem ${withAlpha(readColor(palette.progress), 0.45)}`;
        default:
            return 'none';
    }
}

/**
 * Sets a palette's variables on a player and gives back the colors it now wears. Null (the default
 * palette) removes them all, so SonicFrame's own colors and the page's variables show, as without a
 * palette.
 */
export function wearPalette(
    element: HTMLElement,
    palette: Palette | null,
): Palette {
    if (palette === null) {
        for (const [name] of paletteVariables(DEFAULT_PALETTE)) {
            element.style.removeProperty(name);
        }

        return DEFAULT_PALETTE;
    }

    css(element, paletteVariables(palette));

    return palette;
}

/**
 * Paints with the palette chosen (null: SonicFrame's own colors): `'auto'` follows the system's
 * light or dark as it changes. Gives back the function that stops following.
 */
export function followPalette(
    choice: PaletteChoice,
    paint: (palette: Palette | null) => void,
): () => void {
    if (choice === 'auto') {
        const follow = (dark: boolean): void =>
            paint(choosePalette('auto', dark));
        const stop = onSchemeChange(follow);
        follow(prefersDark());

        return stop;
    }

    paint(choosePalette(choice, false));

    return () => undefined;
}

/**
 * Lays a list's own palette, font and box over its defaults: the player's colors and font, which it
 * inherits in the player and copies when it floats. Colors go through the palette's variables; a
 * shadow takes its colors from the list's own palette, or from the player's (`colors`) without one.
 * A font that fails to load goes to `failed`.
 */
export function dressBox(
    box: HTMLElement,
    own: OwnLook,
    font: FontName,
    colors: Palette,
    failed: (error: unknown) => void,
): void {
    const { palette: choice, style = {} } = own;
    const palette =
        choice === undefined ? null : choosePalette(choice, prefersDark());

    if (palette !== null) {
        css(box, paletteVariables(palette));
    }

    if (own.font !== undefined) {
        useFont(box, own.font, font, failed);
    }

    const corner = within(style.corner, null, 0, 4);
    const border = within(style.border, null, 0, 4);
    const padding = within(style.padding, null, 0, 3);
    const fontSize = within(style.fontSize, null, 0.5, 2);
    const shadow: unknown = style.shadow;

    if (corner !== null) {
        box.style.setProperty('border-radius', `${corner}rem`);
    }

    if (border !== null) {
        box.style.setProperty('border-width', `${border}px`);
        box.style.setProperty('border-style', 'solid');
    }

    if (padding !== null) {
        box.style.setProperty('padding', `${padding}rem`);
    }

    if (fontSize !== null) {
        box.style.setProperty('font-size', `${fontSize}rem`);
    }

    if (
        shadow === 'none' ||
        shadow === 'soft' ||
        shadow === 'hard' ||
        shadow === 'glow'
    ) {
        box.style.setProperty(
            'box-shadow',
            shadowOf(shadow, palette ?? colors),
        );
    }
}

/** The player's own box: sizes from the look, colors from the palette (shadows as numbers). */
export function finishBox(
    element: HTMLElement,
    look: PlayerLook,
    palette: Palette,
): void {
    let surface = 'var(--sonicframe-surface, transparent)';
    // A background of its own takes the surface's place, so its opacity shows the page behind.
    const own = look.background !== null;

    if (look.surface === 'none' || own) {
        surface = 'transparent';
    } else if (look.surface === 'glass') {
        surface = withAlpha(readColor(palette.surface), 0.72);
    }

    css(element, [
        ['display', 'flex'],
        ['flex-direction', 'column'],
        ['gap', `${look.gap}rem`],
        ['box-sizing', 'border-box'],
        ['min-width', '0'],
        ['padding', `${look.padding}rem`],
        ['border-style', 'solid'],
        ['border-width', `${look.border}px`],
        ['border-color', 'var(--sonicframe-border, transparent)'],
        ['border-radius', `${look.corner}rem`],
        // Not the `background` shorthand: it would take url(...) from a color and fetch it.
        ['background-color', surface],
        [
            'backdrop-filter',
            look.surface === 'glass' && !own ? 'blur(0.75rem)' : 'none',
        ],
        ['box-shadow', shadowOf(look.shadow, palette)],
        ['color', 'var(--sonicframe-text, inherit)'],
        ['font-size', `${look.fontSize}rem`],
        ['font-weight', String(look.weight)],
        ['text-transform', look.uppercase ? 'uppercase' : 'none'],
        ['font-variant-numeric', 'tabular-nums'],
        ['line-height', '1.25'],
    ]);
}
