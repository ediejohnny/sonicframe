/**
 * The player's background, without the page: a color, a gradient or an image, with filters,
 * ready-made effects and an opacity; off unless the look has one (its animation is in
 * `background-animation.ts`). `resolveBackground` keeps only known names and numbers in range.
 * Colors stay text here: the page reads them as numbers before any style gets them. An image's
 * address must be a web, relative or blob address with nothing that could close `url("…")`.
 */

import { isOneOf, isRecord, oneOf, within } from '../shared/checked';
import { cleanText } from '../shared/text';
import { safeUrl } from '../shared/url';

export type BackgroundType = 'color' | 'gradient' | 'image';

export type BackgroundEffectName =
    | 'dim'
    | 'vignette'
    | 'frost'
    | 'tint'
    | 'duotone'
    | 'grain';

export type BackgroundEffect = {
    type: BackgroundEffectName;
    /** How strong, from 0 to 1; each effect has its own default. */
    amount?: number;
    /** `dim`, `vignette` and `tint`: the color laid over; by default the palette's (black for `vignette`). */
    color?: string;
    /** `duotone`: the dark and the light color; the palette's text and played colors by default. */
    colors?: [string, string];
};

export type BackgroundFilters = {
    /** In CSS pixels, 0 to 64. */
    blur: number;
    /** 0 to 3; 1 leaves it. */
    brightness: number;
    /** 0 to 3; 1 leaves it. */
    contrast: number;
    /** 0 to 3; 1 leaves it. */
    saturate: number;
    /** 0 to 1. */
    grayscale: number;
    /** 0 to 1. */
    sepia: number;
};

/** A place in the box as a keyword pair (`'top'`, `'bottom right'`) or in percent from the top left. */
export type BackgroundPosition = string | { x?: number; y?: number };

export type BackgroundGradient = {
    /** Two to five colors. */
    colors?: string[];
    /** In degrees, 0 to 360: where a linear gradient goes (180, down, by default) or a conic one starts. */
    angle?: number;
    kind?: 'linear' | 'radial' | 'conic';
};

export type BackgroundImage = {
    /** A web, relative or `blob:` address. */
    src?: string;
    /** `'cover'` (the default), `'contain'`, `'auto'`, or a width in rem (0.5 to 50). */
    size?: 'cover' | 'contain' | 'auto' | number;
    /** Centered by default. */
    position?: BackgroundPosition;
    /** Tiles the image; off by default. */
    repeat?: boolean;
};

/** A background, as the look takes it: any part of it, laid over the one the look had. */
export type Background = {
    /** Taken from what it has when left out: an image first, then a gradient, then a color. */
    type?: BackgroundType;
    /** The color of a `color` background, and the one behind an image or a gradient. */
    color?: string;
    gradient?: BackgroundGradient;
    image?: BackgroundImage;
    filters?: Partial<BackgroundFilters>;
    /** Ready-made effects, by name or with their own strength and colors. */
    effects?: (BackgroundEffectName | BackgroundEffect)[];
    /** 0 to 1: how much of the background shows over the page; 1 by default. */
    opacity?: number;
};

/** A background with every part filled in and checked. */
export type ResolvedBackground = {
    type: BackgroundType;
    color?: string;
    gradient?: Required<BackgroundGradient>;
    image?: Required<BackgroundImage> & {
        position: { x: number; y: number };
    };
    filters: BackgroundFilters;
    effects: (BackgroundEffect & { amount: number })[];
    opacity: number;
};

export const BACKGROUND_EFFECTS: readonly BackgroundEffectName[] =
    Object.freeze([
        'dim',
        'vignette',
        'frost',
        'tint',
        'duotone',
        'grain',
    ] as const);

/** Each effect's strength unless the app gives one. */
const EFFECT_AMOUNT: Readonly<Record<BackgroundEffectName, number>> = {
    dim: 0.5,
    vignette: 0.5,
    frost: 0.5,
    tint: 0.6,
    duotone: 1,
    grain: 0.15,
};

const PLAIN_FILTERS: Readonly<BackgroundFilters> = Object.freeze({
    blur: 0,
    brightness: 1,
    contrast: 1,
    saturate: 1,
    grayscale: 0,
    sepia: 0,
});

/** The longest color text kept, in characters; real colors are far shorter. */
const MAX_COLOR = 100;

/** The most colors in a gradient. */
const MAX_STOPS = 5;

/** Where each keyword puts the image, in percent. */
const SPOTS: Readonly<Record<string, { x?: number; y?: number }>> = {
    left: { x: 0 },
    right: { x: 100 },
    top: { y: 0 },
    bottom: { y: 100 },
    center: {},
};

function colorOf(value: unknown): string | undefined {
    return typeof value === 'string'
        ? cleanText(value, MAX_COLOR) || undefined
        : undefined;
}

function gradientOf(value: unknown): Required<BackgroundGradient> | undefined {
    if (!isRecord(value) || !Array.isArray(value.colors)) {
        return undefined;
    }

    const colors = value.colors
        .map(colorOf)
        .filter((color): color is string => color !== undefined)
        .slice(0, MAX_STOPS);

    return colors.length < 2
        ? undefined
        : {
              colors,
              angle: within(value.angle, 180, 0, 360),
              kind: oneOf(
                  value.kind,
                  ['linear', 'radial', 'conic'] as const,
                  'linear',
              ),
          };
}

function positionOf(value: unknown): { x: number; y: number } {
    if (isRecord(value)) {
        return {
            x: within(value.x, 50, 0, 100),
            y: within(value.y, 50, 0, 100),
        };
    }

    const spot = { x: 50, y: 50 };

    if (typeof value === 'string') {
        for (const word of value.toLowerCase().split(/\s+/).slice(0, 2)) {
            Object.assign(spot, Object.hasOwn(SPOTS, word) ? SPOTS[word] : {});
        }
    }

    return spot;
}

function imageOf(value: unknown): ResolvedBackground['image'] {
    if (!isRecord(value) || typeof value.src !== 'string') {
        return undefined;
    }

    // Quotes, parentheses and backslashes could close `url("…")`; safeUrl refuses the backslash.
    const src = /["'()]/.test(value.src)
        ? null
        : safeUrl(value.src, ['http', 'https', 'blob']);

    if (src === null) {
        return undefined;
    }

    return {
        src,
        size:
            typeof value.size === 'number'
                ? within(value.size, 0.5, 0.5, 50)
                : oneOf(
                      value.size,
                      ['cover', 'contain', 'auto'] as const,
                      'cover',
                  ),
        position: positionOf(value.position),
        repeat: value.repeat === true,
    };
}

function filtersOf(value: unknown): BackgroundFilters {
    const given = isRecord(value) ? value : {};

    return {
        blur: within(given.blur, PLAIN_FILTERS.blur, 0, 64),
        brightness: within(given.brightness, PLAIN_FILTERS.brightness, 0, 3),
        contrast: within(given.contrast, PLAIN_FILTERS.contrast, 0, 3),
        saturate: within(given.saturate, PLAIN_FILTERS.saturate, 0, 3),
        grayscale: within(given.grayscale, PLAIN_FILTERS.grayscale, 0, 1),
        sepia: within(given.sepia, PLAIN_FILTERS.sepia, 0, 1),
    };
}

/** One effect checked, or null for one that is not known. */
function effectOf(
    value: unknown,
): ResolvedBackground['effects'][number] | null {
    const given = isRecord(value) ? value : { type: value };

    if (!isOneOf(given.type, BACKGROUND_EFFECTS)) {
        return null;
    }

    const type = given.type;
    const effect: ResolvedBackground['effects'][number] = {
        type,
        amount: within(given.amount, EFFECT_AMOUNT[type], 0, 1),
    };
    const color = colorOf(given.color);
    const colors = Array.isArray(given.colors)
        ? given.colors.slice(0, 2).map(colorOf)
        : [];

    if (color !== undefined) {
        effect.color = color;
    }

    if (
        colors.length === 2 &&
        colors[0] !== undefined &&
        colors[1] !== undefined
    ) {
        effect.colors = [colors[0], colors[1]];
    }

    return effect;
}

/** The known effects, each kept once (its first time), in order. */
function effectsOf(value: unknown): ResolvedBackground['effects'] {
    const kept: ResolvedBackground['effects'] = [];

    for (const item of Array.isArray(value) ? value : []) {
        const effect = effectOf(item);

        if (
            effect !== null &&
            !kept.some((other) => other.type === effect.type)
        ) {
            kept.push(effect);
        }
    }

    return kept;
}

/**
 * A background checked and filled in, or null (no background) for anything but an object, or one
 * with nothing to show for its type.
 */
export function resolveBackground(value: unknown): ResolvedBackground | null {
    if (!isRecord(value)) {
        return null;
    }

    const color = colorOf(value.color);
    const gradient = gradientOf(value.gradient);
    const image = imageOf(value.image);
    const found: BackgroundType | null =
        image !== undefined
            ? 'image'
            : gradient !== undefined
              ? 'gradient'
              : color !== undefined
                ? 'color'
                : null;
    const type = isOneOf(value.type, ['color', 'gradient', 'image'] as const)
        ? value.type
        : found;
    const shown = { color, gradient, image }[type ?? 'color'];

    if (type === null || shown === undefined) {
        return null;
    }

    const background: ResolvedBackground = {
        type,
        filters: filtersOf(value.filters),
        effects: effectsOf(value.effects),
        opacity: within(value.opacity, 1, 0, 1),
    };

    if (color !== undefined) {
        background.color = color;
    }

    if (type === 'gradient') {
        background.gradient = gradient;
    }

    if (type === 'image') {
        background.image = image;
    }

    return background;
}

/** `over` laid on `base`: the parts it gives replace those of `base`, its image and gradient part by part. */
function mergeBackground(
    base: Background | null,
    over: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    const merged: Record<string, unknown> = { ...base, ...over };

    for (const part of ['gradient', 'image', 'filters'] as const) {
        const own = over[part];
        const was: unknown = base?.[part];

        if (isRecord(own) && isRecord(was)) {
            merged[part] = { ...was, ...own };
        }
    }

    return merged;
}

/**
 * The background a look gives laid over the base's: kept when left out (or not an object), off with
 * null, and otherwise checked after the merge.
 */
export function backgroundOver(
    base: Background | null,
    given: unknown,
): Background | null {
    if (given === null) {
        return null;
    }

    return isRecord(given)
        ? resolveBackground(mergeBackground(base, given))
        : base;
}
