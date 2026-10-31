/**
 * The CSS text of a player's background, built only from numbers (colors already read as numbers,
 * filters kept in range) and from an address already checked, so no text of the app ever reaches a
 * style as it was given.
 */

import { rgbaString, type Rgba } from '../shared/color';
import type {
    BackgroundFilters,
    BackgroundGradient,
    ResolvedBackground,
} from './background';

/** A gradient of `colors`, in order: linear along `angle`, radial from the middle, or conic from `angle`. */
export function gradientCss(
    kind: Required<BackgroundGradient>['kind'],
    angle: number,
    colors: readonly Rgba[],
): string {
    const stops = colors.map(rgbaString).join(', ');

    switch (kind) {
        case 'radial':
            return `radial-gradient(circle, ${stops})`;
        case 'conic':
            return `conic-gradient(from ${angle}deg, ${stops})`;
        default:
            return `linear-gradient(${angle}deg, ${stops})`;
    }
}

/** The CSS `filter` for `filters`, with only those that change something; `'none'` for none. */
export function filterCss(filters: BackgroundFilters): string {
    const parts: string[] = [];

    if (filters.blur > 0) {
        parts.push(`blur(${filters.blur}px)`);
    }

    for (const name of ['brightness', 'contrast', 'saturate'] as const) {
        if (filters[name] !== 1) {
            parts.push(`${name}(${filters[name]})`);
        }
    }

    for (const name of ['grayscale', 'sepia'] as const) {
        if (filters[name] !== 0) {
            parts.push(`${name}(${filters[name]})`);
        }
    }

    return parts.length === 0 ? 'none' : parts.join(' ');
}

/** An image address checked by `resolveBackground`, as a CSS `url()`. */
export function imageCss(src: string): string {
    return `url("${src}")`;
}

/** A number kept to three decimals, so a style reads `1.075`, not `1.0750000000000002`. */
function short(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/**
 * The filters the picture wears with its effects: `frost` blurs it (at least 12 px at full strength)
 * and brightens it a little, `duotone` turns it gray (its two colors lie over it) and adds contrast.
 */
export function effectiveFilters(
    background: ResolvedBackground,
): BackgroundFilters {
    const filters = { ...background.filters };

    for (const { type, amount } of background.effects) {
        if (type === 'frost') {
            filters.blur = Math.max(filters.blur, short(amount * 12));
            filters.brightness = short(
                filters.brightness * (1 + amount * 0.15),
            );
        }

        if (type === 'duotone') {
            filters.grayscale = 1;
            filters.contrast = short(filters.contrast * (1 + amount * 0.1));
        }
    }

    return filters;
}

/** Dark edges for the vignette: clear in the middle, `color` at `amount` at the edges. */
export function vignetteCss(color: Rgba, amount: number): string {
    const [red, green, blue] = color;

    return `radial-gradient(ellipse at center, ${rgbaString([red, green, blue, 0])} 40%, ${rgbaString([red, green, blue, amount])} 100%)`;
}

/** Where a picture with `position` (in percent from the top left) is placed. */
export function positionCss(position: { x: number; y: number }): string {
    return `${position.x}% ${position.y}%`;
}

/** The size of a picture: a keyword, or a width in rem. */
export function sizeCss(size: 'cover' | 'contain' | 'auto' | number): string {
    return typeof size === 'number' ? `${size}rem auto` : size;
}
