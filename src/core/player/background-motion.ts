/**
 * How a player's background moves, without the page: the keyframes and timing of each animation, and
 * how far the picture reaches past the player's edges so a glide or a blur never shows a gap. The
 * page only plays them, and never with reduced motion.
 */

import type { ResolvedBackground } from './background';
import type { ResolvedBackgroundAnimation } from './background-animation';

/** One animation of the background, ready for `element.animate`. */
export type BackdropMotion = {
    /** What moves: the picture (the background itself) or the whole layer (its opacity). */
    target: 'picture' | 'layer';
    keyframes: Record<string, string | number>[];
    /** In milliseconds, one way. */
    duration: number;
    /** There and back, or round and round. */
    direction: 'alternate' | 'normal';
    easing: 'ease-in-out' | 'linear';
};

/** How far a glide goes each way at full strength, in percent of the picture. */
const PAN = 8;

/** How much a swell grows at full strength. */
const ZOOM = 0.25;

/** How much of its opacity a breath takes away at full strength. */
const PULSE = 0.6;

function short(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/** Whether the animation glides the picture sideways (`flow` glides anything but a gradient). */
function glides(
    animation: ResolvedBackgroundAnimation,
    background: ResolvedBackground,
): boolean {
    return (
        animation.type === 'pan' ||
        (animation.type === 'flow' && background.type !== 'gradient')
    );
}

/**
 * How far the picture reaches past each edge, in percent of the player: room for its glide, plus one
 * so its edge never shows.
 */
export function backdropBleed(
    animation: ResolvedBackgroundAnimation | null,
    background: ResolvedBackground,
): number {
    return animation !== null && glides(animation, background)
        ? short(animation.strength * PAN + 1)
        : 0;
}

/**
 * The motion of `animation` over `background`, whose picture wears the CSS `filter` and whose layer
 * shows at `opacity`.
 */
export function backdropMotion(
    animation: ResolvedBackgroundAnimation,
    background: ResolvedBackground,
    filter: string,
): BackdropMotion {
    const { strength } = animation;
    const timing = {
        duration: animation.duration * 1000,
        direction: 'alternate' as const,
        easing: 'ease-in-out' as const,
    };

    if (glides(animation, background)) {
        const far = short(strength * PAN);

        return {
            ...timing,
            target: 'picture',
            keyframes: [
                { transform: `translateX(${-far}%)` },
                { transform: `translateX(${far}%)` },
            ],
        };
    }

    switch (animation.type) {
        case 'zoom':
            return {
                ...timing,
                target: 'picture',
                keyframes: [
                    { transform: 'scale(1)' },
                    { transform: `scale(${short(1 + strength * ZOOM)})` },
                ],
            };
        case 'pulse':
            return {
                ...timing,
                target: 'layer',
                keyframes: [
                    { opacity: background.opacity },
                    {
                        opacity: short(
                            background.opacity * (1 - strength * PULSE),
                        ),
                    },
                ],
            };
        case 'hue': {
            const base = filter === 'none' ? '' : `${filter} `;

            return {
                ...timing,
                target: 'picture',
                direction: 'normal',
                easing: 'linear',
                keyframes: [
                    { filter: `${base}hue-rotate(0deg)` },
                    { filter: `${base}hue-rotate(360deg)` },
                ],
            };
        }
        default:
            // A gradient flows: twice its box, its colors drift from one side to the other.
            return {
                ...timing,
                target: 'picture',
                keyframes: [
                    { backgroundPosition: '0% 50%' },
                    { backgroundPosition: '100% 50%' },
                ],
            };
    }
}
