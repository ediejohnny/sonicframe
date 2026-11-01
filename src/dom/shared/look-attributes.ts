/**
 * The look attributes both tags read: `palette`, `wave`, and `font` with `font-src` or
 * `font-stylesheet`. They are untrusted input, checked again by what takes them.
 */

import type { FontChoice } from '../../core/player/fonts';
import type { PaletteChoice } from '../../core/player/palettes';
import type { WaveName } from '../../types';

export function paletteOf(element: Element): PaletteChoice | undefined {
    return (element.getAttribute('palette') ?? undefined) as
        | PaletteChoice
        | undefined;
}

export function waveOf(element: Element): WaveName | undefined {
    return (element.getAttribute('wave') ?? undefined) as WaveName | undefined;
}

export function fontOf(element: Element): FontChoice | undefined {
    const family = element.getAttribute('font');
    const src = element.getAttribute('font-src') ?? undefined;
    const stylesheet = element.getAttribute('font-stylesheet') ?? undefined;

    if (family === null) {
        return undefined;
    }

    return src !== undefined || stylesheet !== undefined
        ? { family, src, stylesheet }
        : family;
}
