/**
 * The background's effects on its filters, the vignette, the picture's place and size, and how each
 * animation moves it (and how far the picture reaches past the edges for a glide), all without the
 * page.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    effectiveFilters,
    positionCss,
    sizeCss,
    vignetteCss,
} from '../../../src/core/player/background-css';
import {
    backdropBleed,
    backdropMotion,
} from '../../../src/core/player/background-motion';
import {
    resolveBackground,
    type Background,
    type ResolvedBackground,
} from '../../../src/core/player/background';
import {
    resolveBackgroundAnimation,
    type BackgroundAnimation,
} from '../../../src/core/player/background-animation';

function background(given: Background): ResolvedBackground {
    const resolved = resolveBackground(given);

    if (resolved === null) {
        throw new Error('test: no background');
    }

    return resolved;
}

function animation(given: BackgroundAnimation) {
    const resolved = resolveBackgroundAnimation(given);

    if (resolved === null) {
        throw new Error('test: no animation');
    }

    return resolved;
}

const IMAGE = background({ image: { src: '/a.jpg' }, opacity: 0.8 });
const GRADIENT = background({ gradient: { colors: ['red', 'blue'] } });

describe('the filters with the effects', () => {
    it('leaves the filters alone without frost or duotone', () => {
        const dimmed = background({
            image: { src: '/a.jpg' },
            filters: { blur: 3 },
            effects: ['dim', 'vignette', 'tint', 'grain'],
        });

        expect(effectiveFilters(dimmed)).toEqual(dimmed.filters);
    });

    it('blurs and brightens with frost, never blurring less than asked', () => {
        expect(
            effectiveFilters(
                background({
                    color: 'red',
                    effects: [{ type: 'frost', amount: 0.5 }],
                }),
            ),
        ).toMatchObject({ blur: 6, brightness: 1.075 });
        expect(
            effectiveFilters(
                background({
                    color: 'red',
                    filters: { blur: 20 },
                    effects: [{ type: 'frost', amount: 0.5 }],
                }),
            ).blur,
        ).toBe(20);
    });

    it('turns the picture gray with more contrast for duotone', () => {
        expect(
            effectiveFilters(
                background({ color: 'red', effects: ['duotone'] }),
            ),
        ).toMatchObject({ grayscale: 1, contrast: 1.1 });
    });
});

describe('the picture in CSS', () => {
    it('writes the vignette clear in the middle and dark at the edges', () => {
        expect(vignetteCss([0, 0, 0, 1], 0.5)).toBe(
            'radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.5) 100%)',
        );
    });

    it('writes the place in percent and the size as a keyword or in rem', () => {
        expect(positionCss({ x: 50, y: 0 })).toBe('50% 0%');
        expect(sizeCss('contain')).toBe('contain');
        expect(sizeCss(12)).toBe('12rem auto');
    });
});

describe('how the background moves', () => {
    it('glides the picture both ways, as far as its strength says, reaching past the edges', () => {
        const pan = animation({ type: 'pan', strength: 0.5, duration: 30 });

        expect(backdropMotion(pan, IMAGE, 'none')).toEqual({
            target: 'picture',
            keyframes: [
                { transform: 'translateX(-4%)' },
                { transform: 'translateX(4%)' },
            ],
            duration: 30000,
            direction: 'alternate',
            easing: 'ease-in-out',
        });
        expect(backdropBleed(pan, IMAGE)).toBe(5);
        expect(backdropBleed(null, IMAGE)).toBe(0);
        expect(backdropBleed(animation({ type: 'zoom' }), IMAGE)).toBe(0);
    });

    it('swells the picture with zoom', () => {
        expect(
            backdropMotion(
                animation({ type: 'zoom', strength: 1 }),
                IMAGE,
                'none',
            ).keyframes,
        ).toEqual([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }]);
    });

    it("breathes the layer's opacity with pulse, from its own opacity", () => {
        const pulse = backdropMotion(
            animation({ type: 'pulse', strength: 0.5 }),
            IMAGE,
            'none',
        );

        expect(pulse.target).toBe('layer');
        expect(pulse.keyframes).toEqual([{ opacity: 0.8 }, { opacity: 0.56 }]);
    });

    it('turns the colors round with hue, keeping the filters it wears', () => {
        const hue = backdropMotion(
            animation({ type: 'hue' }),
            IMAGE,
            'blur(4px)',
        );

        expect(hue).toMatchObject({ direction: 'normal', easing: 'linear' });
        expect(hue.keyframes).toEqual([
            { filter: 'blur(4px) hue-rotate(0deg)' },
            { filter: 'blur(4px) hue-rotate(360deg)' },
        ]);
        expect(
            backdropMotion(animation({ type: 'hue' }), IMAGE, 'none')
                .keyframes[0],
        ).toEqual({ filter: 'hue-rotate(0deg)' });
    });

    it("drifts a gradient's colors with flow, and glides anything else", () => {
        const flow = animation({ type: 'flow' });

        expect(backdropMotion(flow, GRADIENT, 'none').keyframes).toEqual([
            { backgroundPosition: '0% 50%' },
            { backgroundPosition: '100% 50%' },
        ]);
        expect(backdropBleed(flow, GRADIENT)).toBe(0);
        expect(backdropMotion(flow, IMAGE, 'none').keyframes[0]).toEqual({
            transform: 'translateX(-4%)',
        });
    });
});
