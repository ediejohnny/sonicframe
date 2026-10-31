/**
 * The pieces of a player's background on the page: the picture (a color, a gradient or an image,
 * with its filters) and a layer for each effect over it. Every color is read as numbers before a
 * style gets it, and the image's address was checked when the look was, so nothing of the app's
 * text reaches a style as it was given.
 */

import {
    effectiveFilters,
    filterCss,
    gradientCss,
    imageCss,
    positionCss,
    sizeCss,
    vignetteCss,
} from '../../core/player/background-css';
import { backdropBleed } from '../../core/player/background-motion';
import type { ResolvedBackground } from '../../core/player/background';
import type { ResolvedBackgroundAnimation } from '../../core/player/background-animation';
import {
    relativeLuminance,
    rgbaString,
    type Rgba,
} from '../../core/shared/color';
import { css } from '../../dom/shared/css';

/** A CSS color (a variable too) as numbers, or null when it cannot be read. */
export type ColorReader = (color: string) => Rgba | null;

/** The palette's colors the effects take by default, as CSS colors. */
export type BackdropColors = {
    surface: string;
    progress: string;
};

export type BackdropPieces = {
    /** The background itself: what an animation moves. */
    picture: HTMLElement;
    /** The grain's canvas, to draw at the player's size; null without grain. */
    grain: HTMLCanvasElement | null;
    /** The CSS `filter` the picture wears. */
    filter: string;
};

function withAlpha(color: Rgba, alpha: number): string {
    return rgbaString([color[0], color[1], color[2], alpha]);
}

/** A layer over the whole background. */
function cover(layer: HTMLElement, styles: [string, string][]): HTMLElement {
    const piece = document.createElement('div');
    css(piece, [['position', 'absolute'], ['inset', '0'], ...styles]);
    layer.append(piece);

    return piece;
}

/** The picture's own background: its color, and its gradient or image. */
function pictureStyles(
    background: ResolvedBackground,
    flows: boolean,
    read: ColorReader,
): [string, string][] {
    const styles: [string, string][] = [];
    const color =
        background.color === undefined ? null : read(background.color);

    // Not the `background` shorthand: it would take url(...) from a color and fetch it.
    if (color !== null) {
        styles.push(['background-color', rgbaString(color)]);
    }

    const { gradient, image } = background;

    if (gradient !== undefined) {
        const colors = gradient.colors
            .map(read)
            .filter((stop): stop is Rgba => stop !== null);

        if (colors.length >= 2) {
            styles.push([
                'background-image',
                gradientCss(gradient.kind, gradient.angle, colors),
            ]);
        }

        if (flows) {
            styles.push(['background-size', '200% 200%']);
        }
    }

    if (image !== undefined) {
        styles.push(
            ['background-image', imageCss(image.src)],
            ['background-size', sizeCss(image.size)],
            ['background-position', positionCss(image.position)],
            ['background-repeat', image.repeat ? 'repeat' : 'no-repeat'],
        );
    }

    return styles;
}

/** The two duotone colors, dark first: the app's, or the palette's surface and played colors by lightness. */
function duotoneColors(
    given: [string, string] | undefined,
    colors: BackdropColors,
    read: ColorReader,
): [Rgba, Rgba] | null {
    const [first, second] = (given ?? [colors.surface, colors.progress]).map(
        read,
    );

    if (first === null || second === null) {
        return null;
    }

    return given === undefined &&
        relativeLuminance(first) > relativeLuminance(second)
        ? [second, first]
        : [first, second];
}

/** Lays each effect over the picture, in order; returns the grain's canvas, if any. */
function addEffects(
    layer: HTMLElement,
    background: ResolvedBackground,
    colors: BackdropColors,
    read: ColorReader,
): HTMLCanvasElement | null {
    let grain: HTMLCanvasElement | null = null;

    for (const effect of background.effects) {
        const { amount } = effect;
        const own = effect.color === undefined ? null : read(effect.color);

        switch (effect.type) {
            case 'dim': {
                const color = own ?? read(colors.surface);

                if (color !== null) {
                    cover(layer, [
                        ['background-color', withAlpha(color, amount)],
                    ]);
                }
                break;
            }
            case 'vignette':
                cover(layer, [
                    [
                        'background-image',
                        vignetteCss(own ?? [0, 0, 0, 1], amount),
                    ],
                ]);
                break;
            case 'frost':
                cover(layer, [
                    [
                        'background-color',
                        withAlpha([255, 255, 255, 1], amount * 0.25),
                    ],
                ]);
                break;
            case 'tint': {
                const color = own ?? read(colors.progress);

                if (color !== null) {
                    cover(layer, [
                        ['background-color', withAlpha(color, 1)],
                        ['mix-blend-mode', 'color'],
                        ['opacity', String(amount)],
                    ]);
                }
                break;
            }
            case 'duotone': {
                const pair = duotoneColors(effect.colors, colors, read);

                // The dark color lifts the shadows; the light one tints the highlights.
                if (pair !== null) {
                    cover(layer, [
                        ['background-color', withAlpha(pair[0], 1)],
                        ['mix-blend-mode', 'lighten'],
                        ['opacity', String(amount)],
                    ]);
                    cover(layer, [
                        ['background-color', withAlpha(pair[1], 1)],
                        ['mix-blend-mode', 'multiply'],
                        ['opacity', String(amount)],
                    ]);
                }
                break;
            }
            default:
                grain = document.createElement('canvas');
                css(grain, [
                    ['position', 'absolute'],
                    ['inset', '0'],
                    ['width', '100%'],
                    ['height', '100%'],
                    ['mix-blend-mode', 'overlay'],
                    ['opacity', String(amount)],
                ]);
                layer.append(grain);
        }
    }

    return grain;
}

/**
 * Builds `background` in `layer` (emptied first): the layer sits behind the player's parts, clipped
 * to its corners, and the picture reaches past the edges by what its blur and its glide need.
 */
export function buildBackdrop(
    layer: HTMLElement,
    background: ResolvedBackground,
    animation: ResolvedBackgroundAnimation | null,
    colors: BackdropColors,
    read: ColorReader,
): BackdropPieces {
    layer.replaceChildren();
    css(layer, [
        ['position', 'absolute'],
        ['inset', '0'],
        ['z-index', '-1'],
        ['overflow', 'hidden'],
        ['border-radius', 'inherit'],
        ['pointer-events', 'none'],
        ['opacity', String(background.opacity)],
    ]);

    const filters = effectiveFilters(background);
    const filter = filterCss(filters);
    const bleed = backdropBleed(animation, background);
    const flows = animation?.type === 'flow';
    const picture = cover(layer, [
        ['inset', `calc(${-bleed}% - ${filters.blur * 2}px)`],
        ['filter', filter],
        ...pictureStyles(background, flows, read),
    ]);

    return {
        picture,
        grain: addEffects(layer, background, colors, read),
        filter,
    };
}
