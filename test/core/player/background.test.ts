/**
 * The player's background without the page: what the look's `background` and `backgroundAnimation`
 * keep (known names, numbers in range, a safe image address), how a look laid over another changes
 * them, and the CSS text built from colors already read as numbers.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    filterCss,
    gradientCss,
    imageCss,
} from '../../../src/core/player/background-css';
import {
    resolveBackground,
    type Background,
} from '../../../src/core/player/background';
import { resolveBackgroundAnimation } from '../../../src/core/player/background-animation';
import { DEFAULT_LOOK, resolveLook } from '../../../src/core/player/look';

const PLAIN_FILTERS = {
    blur: 0,
    brightness: 1,
    contrast: 1,
    saturate: 1,
    grayscale: 0,
    sepia: 0,
};

describe('the background a look keeps', () => {
    it('is off unless the look has one, and anything but an object turns it off', () => {
        expect(DEFAULT_LOOK.background).toBeNull();

        for (const given of [undefined, null, false, 'red', 3, []]) {
            expect(resolveBackground(given), String(given)).toBeNull();
        }
    });

    it('takes its type from what it has, an image first, and is off with nothing to show', () => {
        expect(resolveBackground({ color: '#123456' })?.type).toBe('color');
        expect(
            resolveBackground({
                gradient: { colors: ['red', 'blue'] },
                color: '#fff',
            })?.type,
        ).toBe('gradient');
        expect(
            resolveBackground({ image: { src: '/a.jpg' }, color: '#fff' })
                ?.type,
        ).toBe('image');
        expect(
            resolveBackground({
                gradient: { colors: ['red', 'blue'] },
                image: { src: '/a.jpg' },
            })?.type,
        ).toBe('image');
        expect(resolveBackground({ opacity: 0.5 })).toBeNull();
        expect(resolveBackground({ type: 'image', color: '#fff' })).toBeNull();
    });

    it('fills a color background with its defaults', () => {
        expect(resolveBackground({ color: ' #123456 ' })).toEqual({
            type: 'color',
            color: '#123456',
            filters: PLAIN_FILTERS,
            effects: [],
            opacity: 1,
        });
    });

    it('keeps two to five gradient colors, its angle from 0 to 360 and a known kind', () => {
        expect(
            resolveBackground({
                gradient: { colors: ['red', 4, 'blue'] as string[], angle: 45 },
            })?.gradient,
        ).toEqual({ colors: ['red', 'blue'], angle: 45, kind: 'linear' });
        expect(
            resolveBackground({
                gradient: {
                    colors: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
                    angle: 900,
                    kind: 'radial',
                },
            })?.gradient,
        ).toEqual({
            colors: ['a', 'b', 'c', 'd', 'e'],
            angle: 360,
            kind: 'radial',
        });
        expect(
            resolveBackground({
                gradient: {
                    colors: ['red'],
                    angle: Number.NaN,
                    kind: 'odd' as 'linear',
                },
            }),
        ).toBeNull();
        expect(
            resolveBackground({
                gradient: { colors: ['red', 'blue'], kind: 'conic' },
            })?.gradient,
        ).toEqual({ colors: ['red', 'blue'], angle: 180, kind: 'conic' });
    });

    it('takes an image only from a web, relative or blob address that cannot close url()', () => {
        const src = (value: string): string | undefined =>
            resolveBackground({ image: { src: value } })?.image?.src;

        expect(src('/covers/a.jpg')).toBe('/covers/a.jpg');
        expect(src('https://example.com/a.jpg')).toBe(
            'https://example.com/a.jpg',
        );
        expect(src('blob:https://example.com/4f2a')).toBe(
            'blob:https://example.com/4f2a',
        );

        for (const bad of [
            'javascript:alert(1)',
            'data:image/png;base64,AAAA',
            '//evil.example/a.jpg',
            'a.jpg") ; color: red',
            "a'.jpg",
            'a(1).jpg',
            '',
        ]) {
            expect(resolveBackground({ image: { src: bad } }), bad).toBeNull();
        }
    });

    it("fills an image's size, place and repeat, keeping numbers in range", () => {
        expect(resolveBackground({ image: { src: '/a.jpg' } })?.image).toEqual({
            src: '/a.jpg',
            size: 'cover',
            position: { x: 50, y: 50 },
            repeat: false,
        });
        expect(
            resolveBackground({
                image: {
                    src: '/a.jpg',
                    size: 80,
                    position: 'top',
                    repeat: true,
                },
            })?.image,
        ).toEqual({
            src: '/a.jpg',
            size: 50,
            position: { x: 50, y: 0 },
            repeat: true,
        });
        expect(
            resolveBackground({
                image: {
                    src: '/a.jpg',
                    size: 'huge' as 'cover',
                    position: { x: 20, y: -5 },
                },
            })?.image,
        ).toEqual({
            src: '/a.jpg',
            size: 'cover',
            position: { x: 20, y: 0 },
            repeat: false,
        });
        expect(
            resolveBackground({
                image: {
                    src: '/a.jpg',
                    size: 'contain',
                    position: 'bottom right',
                },
            })?.image?.position,
        ).toEqual({ x: 100, y: 100 });
    });

    it('keeps each filter in range, the others plain', () => {
        expect(
            resolveBackground({
                color: 'red',
                filters: {
                    blur: 200,
                    brightness: 0.5,
                    sepia: Number.NaN,
                    grayscale: 3,
                },
            })?.filters,
        ).toEqual({
            ...PLAIN_FILTERS,
            blur: 64,
            brightness: 0.5,
            grayscale: 1,
        });
    });

    it('keeps the known effects once each, with their own strength and colors', () => {
        const { effects } = resolveBackground({
            color: 'red',
            effects: [
                'dim',
                { type: 'tint', amount: 2, color: '#f0f' },
                'sparkle' as 'dim',
                { type: 'dim', amount: 0.1 },
                { type: 'duotone', colors: ['#000', '#fff'] },
                'grain',
                'vignette',
                { type: 'frost', amount: Number.NaN },
            ],
        }) as Background & { effects: unknown[] };

        expect(effects).toEqual([
            { type: 'dim', amount: 0.5 },
            { type: 'tint', amount: 1, color: '#f0f' },
            { type: 'duotone', amount: 1, colors: ['#000', '#fff'] },
            { type: 'grain', amount: 0.15 },
            { type: 'vignette', amount: 0.5 },
            { type: 'frost', amount: 0.5 },
        ]);
    });

    it('keeps the opacity from 0 to 1', () => {
        expect(resolveBackground({ color: 'red', opacity: 0.4 })?.opacity).toBe(
            0.4,
        );
        expect(resolveBackground({ color: 'red', opacity: 7 })?.opacity).toBe(
            1,
        );
        expect(resolveBackground({ color: 'red', opacity: -1 })?.opacity).toBe(
            0,
        );
    });
});

describe('a look laid over another', () => {
    it("keeps the base's background, changes only what the new look gives, and null turns it off", () => {
        const themed = resolveLook(DEFAULT_LOOK, {
            background: {
                image: { src: '/a.jpg', size: 'contain' },
                effects: ['dim'],
            },
        });
        const own = resolveLook(themed, {
            background: { opacity: 0.5, image: { position: 'top' } },
        });

        expect(own.background).toEqual({
            type: 'image',
            image: {
                src: '/a.jpg',
                size: 'contain',
                position: { x: 50, y: 0 },
                repeat: false,
            },
            filters: PLAIN_FILTERS,
            effects: [{ type: 'dim', amount: 0.5 }],
            opacity: 0.5,
        });
        expect(resolveLook(own, { background: null }).background).toBeNull();
        expect(resolveLook(own, {}).background).toEqual(own.background);
    });

    it('switches to a color when the new look asks for one over an image', () => {
        const themed = resolveLook(DEFAULT_LOOK, {
            background: { image: { src: '/a.jpg' } },
        });

        expect(
            resolveLook(themed, { background: { type: 'color', color: 'red' } })
                .background?.type,
        ).toBe('color');
    });
});

describe('the background animation a look keeps', () => {
    it('is off unless asked; true gives the defaults', () => {
        expect(DEFAULT_LOOK.backgroundAnimation).toBeNull();
        expect(resolveBackgroundAnimation(false)).toBeNull();
        expect(resolveBackgroundAnimation(undefined)).toBeNull();
        expect(resolveBackgroundAnimation(true)).toEqual({
            type: 'pan',
            duration: 20,
            strength: 0.5,
            while: 'playing',
            pauseOnHover: false,
        });
    });

    it('keeps known names and numbers in range', () => {
        expect(
            resolveBackgroundAnimation({
                type: 'hue',
                duration: 1,
                strength: 3,
                while: 'always',
                pauseOnHover: true,
            }),
        ).toEqual({
            type: 'hue',
            duration: 2,
            strength: 1,
            while: 'always',
            pauseOnHover: true,
        });
        expect(
            resolveBackgroundAnimation({
                type: 'spin' as 'pan',
                duration: 9000,
                while: 'never' as 'always',
            }),
        ).toEqual({
            type: 'pan',
            duration: 600,
            strength: 0.5,
            while: 'playing',
            pauseOnHover: false,
        });
    });

    it('is kept by resolveLook, and null turns it off', () => {
        const on = resolveLook(DEFAULT_LOOK, {
            backgroundAnimation: { type: 'zoom' },
        });

        expect(on.backgroundAnimation).toMatchObject({ type: 'zoom' });
        expect(resolveLook(on, {}).backgroundAnimation).toMatchObject({
            type: 'zoom',
        });
        expect(
            resolveLook(on, { backgroundAnimation: { duration: 30 } })
                .backgroundAnimation,
        ).toMatchObject({ type: 'zoom', duration: 30 });
        expect(
            resolveLook(on, { backgroundAnimation: null }).backgroundAnimation,
        ).toBeNull();
    });
});

describe('the CSS built from numbers', () => {
    it('writes each kind of gradient from colors read as numbers', () => {
        const colors = [
            [255, 0, 0, 1],
            [0, 0, 255, 0.5],
        ] as const;

        expect(gradientCss('linear', 45, colors)).toBe(
            'linear-gradient(45deg, rgba(255, 0, 0, 1), rgba(0, 0, 255, 0.5))',
        );
        expect(gradientCss('radial', 45, colors)).toBe(
            'radial-gradient(circle, rgba(255, 0, 0, 1), rgba(0, 0, 255, 0.5))',
        );
        expect(gradientCss('conic', 90, colors)).toBe(
            'conic-gradient(from 90deg, rgba(255, 0, 0, 1), rgba(0, 0, 255, 0.5))',
        );
    });

    it('writes only the filters that change something', () => {
        expect(filterCss(PLAIN_FILTERS)).toBe('none');
        expect(
            filterCss({
                ...PLAIN_FILTERS,
                blur: 4,
                saturate: 1.5,
                sepia: 0.25,
            }),
        ).toBe('blur(4px) saturate(1.5) sepia(0.25)');
    });

    it('quotes the image address', () => {
        expect(imageCss('/covers/a b.jpg'.replace(' ', '-'))).toBe(
            'url("/covers/a-b.jpg")',
        );
    });
});
