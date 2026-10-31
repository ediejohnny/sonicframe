/**
 * Fonts for themes. SonicFrame ships no font files: every stack names fonts that already live on the
 * listener's device, ending in a generic family. An app that wants another font brings it itself (a
 * family name, a font file or a font stylesheet) and SonicFrame only uses it. Names are cleaned and
 * quoted, and an address is used only when it is http(s) or a relative path that cannot break out of
 * `url("…")`.
 */

import { cleanText } from './text';
import { safeUrl } from './url';

export type FontName =
    | 'system'
    | 'rounded'
    | 'mono'
    | 'serif'
    | 'humanist'
    | 'geometric'
    | 'industrial'
    | 'slab'
    | 'handwritten';

export const FONT_STACKS: Readonly<Record<FontName, string>> = Object.freeze({
    system: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    rounded:
        "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', Calibri, sans-serif",
    mono: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
    serif: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif",
    humanist:
        "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', sans-serif",
    geometric: "Avenir, Montserrat, Corbel, 'URW Gothic', sans-serif",
    industrial:
        "Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', 'Nimbus Sans Narrow', sans-serif",
    slab: "Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'Sitka Small', serif",
    handwritten: "'Segoe Print', 'Bradley Hand', Chilanka, casual, cursive",
});

export const FONT_NAMES: readonly FontName[] = Object.freeze(
    Object.keys(FONT_STACKS) as FontName[],
);

/** A font the app brings: its family name, and where to load it from (a file or a stylesheet). */
export type FontSource = {
    family: string;
    /** A font file (woff2, woff, ttf…). */
    src?: string;
    /** A stylesheet that declares the font (as online font services give). */
    stylesheet?: string;
    /** The system stack behind it, used until it loads or if it fails. */
    fallback?: FontName;
};

/** A stack name (`FONT_NAMES`), any CSS `font-family` list, or a font the app brings. */
export type FontChoice = string | FontSource;

/** What to load for a font the app brings; addresses already checked. */
export type FontLoad = {
    family: string;
    src: string | undefined;
    stylesheet: string | undefined;
};

export type ResolvedFont = {
    /** The `font-family` value to use. */
    family: string;
    /** What to load first, or null when the fonts are already on the device. */
    load: FontLoad | null;
};

const MAX_FAMILY = 200;
const MAX_NAME = 100;

export function isFontName(value: unknown): value is FontName {
    return (
        typeof value === 'string' &&
        (FONT_NAMES as readonly string[]).includes(value)
    );
}

/**
 * The address when it is http(s) or a relative path, with nothing that could close `url("…")` or
 * start another declaration (quotes, parentheses, backslashes, spaces, control characters);
 * otherwise null.
 */
export function safeFontUrl(url: string): string | null {
    return /["'()]/.test(url) ? null : safeUrl(url);
}

function checked(url: string | undefined): string | undefined {
    return typeof url === 'string'
        ? (safeFontUrl(url) ?? undefined)
        : undefined;
}

/** The `font-family` to use for `choice`, and what to load for a font the app brings. */
export function resolveFont(
    choice: FontChoice | undefined,
    fallback: FontName,
): ResolvedFont {
    if (choice === undefined) {
        return { family: FONT_STACKS[fallback], load: null };
    }

    if (typeof choice === 'string') {
        if (isFontName(choice)) {
            return { family: FONT_STACKS[choice], load: null };
        }

        return {
            family: cleanText(choice, MAX_FAMILY) || FONT_STACKS[fallback],
            load: null,
        };
    }

    const name = cleanText(String(choice.family ?? ''), MAX_NAME)
        .replace(/["'\\]/g, '')
        .trim();
    const behind =
        FONT_STACKS[isFontName(choice.fallback) ? choice.fallback : fallback];

    if (name === '') {
        return { family: behind, load: null };
    }

    return {
        family: `"${name}", ${behind}`,
        load: {
            family: name,
            src: checked(choice.src),
            stylesheet: checked(choice.stylesheet),
        },
    };
}
