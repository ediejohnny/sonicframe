/**
 * The `background-` attributes of `<sonic-player>` read into the look's background and its
 * animation. Untrusted like every attribute: a word turns a choice on, any other word is ignored, a
 * number counts only when it is one, and the player checks every value again (colors are read as
 * numbers, the image's address must be safe).
 */

import type {
    Background,
    BackgroundEffectName,
} from '../../core/player/background';
import type { BackgroundAnimation } from '../../core/player/background-animation';
import type { PlayerLook } from '../../core/player/look';

/** The tag's attributes for the background. */
export const BACKGROUND_ATTRIBUTES: readonly string[] = Object.freeze([
    'background-color',
    'background-gradient',
    'background-image',
    'background-options',
    'background-angle',
    'background-blur',
    'background-opacity',
    'background-effects',
    'background-animation',
    'background-duration',
]);

/** The words that place an image. */
const PLACES = ['top', 'bottom', 'left', 'right', 'center'];

function words(value: string | null): string[] {
    return (value ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}

function number(value: string | null): number | undefined {
    const text = value?.trim() ?? '';
    const parsed = Number(text);

    return text !== '' && Number.isFinite(parsed) ? parsed : undefined;
}

/** The first of `names` among `given`, or undefined. */
function first<Name extends string>(
    given: readonly string[],
    names: readonly Name[],
): Name | undefined {
    return names.find((name) => given.includes(name));
}

/**
 * The background from `background-color`, `background-gradient` (colors separated by spaces),
 * `background-image` (an address), and the words of `background-options`: `radial` or `conic` for the
 * gradient, `contain` or `auto` and `repeat` for the image, and `top`, `bottom`, `left`, `right`,
 * `center` for its place. `background-angle`, `background-blur` and `background-opacity` are numbers,
 * `background-effects` the effects' names. None without a color, a gradient or an image.
 */
function backgroundOf(element: Element): Background | undefined {
    const color = element.getAttribute('background-color');
    const gradient = element.getAttribute('background-gradient');
    const image = element.getAttribute('background-image');

    if (color === null && gradient === null && image === null) {
        return undefined;
    }

    const options = words(element.getAttribute('background-options'));
    const place = options.filter((word) => PLACES.includes(word)).join(' ');

    return {
        color: color ?? undefined,
        gradient:
            gradient === null
                ? undefined
                : {
                      colors: gradient.trim().split(/\s+/),
                      angle: number(element.getAttribute('background-angle')),
                      kind:
                          first(options, ['radial', 'conic'] as const) ??
                          'linear',
                  },
        image:
            image === null
                ? undefined
                : {
                      src: image.trim(),
                      size:
                          first(options, ['contain', 'auto'] as const) ??
                          'cover',
                      position: place === '' ? undefined : place,
                      repeat: options.includes('repeat'),
                  },
        filters: { blur: number(element.getAttribute('background-blur')) },
        effects: words(
            element.getAttribute('background-effects'),
        ) as BackgroundEffectName[],
        opacity: number(element.getAttribute('background-opacity')),
    };
}

/**
 * The animation from the words of `background-animation` (its type: `pan`, `zoom`, `pulse`, `hue`
 * or `flow`; `always` to move while paused too; `hover-pause`) and `background-duration`, in seconds.
 */
function animationOf(element: Element): BackgroundAnimation | undefined {
    const value = element.getAttribute('background-animation');

    if (value === null) {
        return undefined;
    }

    const given = words(value);

    return {
        type: first(given, ['pan', 'zoom', 'pulse', 'hue', 'flow'] as const),
        while: given.includes('always') ? 'always' : 'playing',
        pauseOnHover: given.includes('hover-pause'),
        duration: number(element.getAttribute('background-duration')),
    };
}

/** The look's background and animation from the tag, or undefined when it has neither. */
export function backgroundLookOf(
    element: Element,
): Partial<PlayerLook> | undefined {
    const background = backgroundOf(element);
    const backgroundAnimation = animationOf(element);

    if (background === undefined && backgroundAnimation === undefined) {
        return undefined;
    }

    return { background, backgroundAnimation };
}
