/**
 * The player's own background on the page: off by default; once on, a layer behind the parts, hidden
 * from screen readers, that no text of the app reaches as it was given; its effects laid over it; a
 * theme or the tag can bring it; and its animation, which moves only while it should.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { recordAnimations } from '../../support/animations';
import { recordingOf } from '../../support/fakes';
import { fakeMedia, stubMedia } from '../../support/helpers';
import { cleanUp, container, host, keep, root } from '../player/player-harness';

let player: Player | null = null;

afterEach(() => {
    player?.destroy();
    player = null;
    cleanUp();
});

function make(
    look: PlayerOptions['look'],
    options: Partial<PlayerOptions> = {},
): Player {
    player = createPlayer({
        container: container(),
        media: fakeMedia({ duration: 33 }),
        look,
        ...options,
    });

    return player;
}

/** The background layer, or null. */
function layer(): HTMLElement | null {
    return root().querySelector<HTMLElement>(':scope > .sonicframe-background');
}

/** Every inline style in the layer, as text. */
function styles(): string {
    return [layer(), ...(layer()?.querySelectorAll('*') ?? [])]
        .map((element) => element?.getAttribute('style') ?? '')
        .join(';');
}

describe('the background', () => {
    it('is off by default: no layer, the surface as always', () => {
        make(undefined);

        expect(layer()).toBeNull();
        expect(root().style.getPropertyValue('background-color')).toBe(
            'var(--sonicframe-surface, transparent)',
        );
    });

    it('sits behind the parts, hidden from screen readers, in place of the surface', () => {
        make({ background: { color: '#204080' } });
        const background = layer() as HTMLElement;

        expect(background.getAttribute('aria-hidden')).toBe('true');
        expect(root().firstElementChild).toBe(background);
        expect(
            root().querySelector(
                '.sonicframe-background [role], .sonicframe-background button',
            ),
        ).toBeNull();
        expect(root().style.getPropertyValue('background-color')).toBe(
            'transparent',
        );
    });

    it('shows a safe image, and never an address or a color that could fetch or run something', () => {
        make({ background: { image: { src: '/covers/a.jpg' } } });

        expect(styles()).toContain('url("/covers/a.jpg")');

        player?.destroy();
        cleanUp();
        make({
            background: {
                color: 'url(https://evil.example/c.png)',
                gradient: {
                    colors: ['red', 'url(https://evil.example/g.png)', 'blue'],
                },
                effects: [
                    { type: 'tint', color: 'url(https://evil.example/t.png)' },
                ],
            },
        });

        expect(layer()).not.toBeNull();
        expect(styles()).not.toContain('evil');

        // A page variable is read as numbers too: no text of the app reaches a style as given.
        player?.destroy();
        cleanUp();
        make({ background: { color: 'var(--brand)' } });
        root().style.setProperty('--brand', '#00ff00');
        player?.setLook({});

        expect(styles()).not.toContain('var(');
        expect(styles()).toContain('rgba(0, 255, 0, 1)');

        for (const src of [
            'javascript:alert(1)',
            'data:image/png;base64,AA',
            '//evil.example/a.jpg',
        ]) {
            player?.destroy();
            cleanUp();
            make({ background: { image: { src } } });

            expect(layer(), src).toBeNull();
        }
    });

    it('lays each effect over the picture, the dim one in the surface color', () => {
        make({
            background: {
                color: '#000000',
                effects: [
                    'dim',
                    'vignette',
                    'frost',
                    'tint',
                    'duotone',
                    'grain',
                ],
            },
        });
        root().style.setProperty('--sonicframe-surface', '#ff0000');
        player?.setLook({});
        const pieces = Array.from((layer() as HTMLElement).children);

        // The picture, then dim, vignette, frost, tint, duotone's two colors and the grain.
        expect(pieces).toHaveLength(8);
        expect(pieces[1].getAttribute('style')).toContain(
            'rgba(255, 0, 0, 0.5)',
        );
        expect(pieces.at(-1)?.tagName).toBe('CANVAS');
    });

    it('lays the darker of the surface and the played color under the lighter in duotone', () => {
        make({ background: { color: '#808080', effects: ['duotone'] } });
        root().style.setProperty('--sonicframe-surface', '#ffffff');
        root().style.setProperty('--sonicframe-progress', '#000080');
        player?.setLook({});
        const [, dark, light] = Array.from((layer() as HTMLElement).children);

        expect(dark.getAttribute('style')).toContain('rgba(0, 0, 128, 1)');
        expect(dark.getAttribute('style')).toContain('lighten');
        expect(light.getAttribute('style')).toContain('rgba(255, 255, 255, 1)');
        expect(light.getAttribute('style')).toContain('multiply');
    });

    it("draws the grain itself at the player's size, gray dots only", () => {
        make({ background: { color: '#000000', effects: ['grain'] } });
        Object.defineProperty(root(), 'clientWidth', { value: 12 });
        Object.defineProperty(root(), 'clientHeight', { value: 5 });
        player?.setLook({});
        const grain = layer()?.querySelector('canvas') as HTMLCanvasElement;
        const pixels = recordingOf(grain).pixels.at(-1) as Uint8ClampedArray;

        expect([grain.width, grain.height]).toEqual([12, 5]);
        expect(pixels).toHaveLength(12 * 5 * 4);

        for (let at = 0; at < pixels.length; at += 4) {
            expect(pixels[at + 1]).toBe(pixels[at]);
            expect(pixels[at + 2]).toBe(pixels[at]);
        }
    });

    it('goes when the look turns it off, and comes with a theme', () => {
        make({ background: { color: 'red' } });
        player?.setLook({ background: null });

        expect(layer()).toBeNull();
        expect(root().style.getPropertyValue('position')).toBe('');

        // The player's own choice wins over its theme's.
        player?.setTheme({ look: { background: { color: 'blue' } } });
        expect(layer()).toBeNull();

        player?.destroy();
        cleanUp();
        make(undefined);
        player?.setTheme({ look: { background: { color: 'blue' } } });

        expect(layer()).not.toBeNull();
    });
});

describe('the background animation', () => {
    it('moves only while the sound plays, by default', () => {
        const started = recordAnimations();
        const media = fakeMedia({ duration: 33 });
        make(
            {
                background: { color: 'red' },
                backgroundAnimation: { type: 'pulse' },
            },
            { media },
        );
        const motion = started.at(-1);

        expect(motion?.target).toBe(layer());
        expect(motion?.options.iterations).toBe(Number.POSITIVE_INFINITY);
        expect(motion?.paused).toBe(true);

        Object.defineProperty(media, 'paused', {
            value: false,
            configurable: true,
        });
        media.fire('play');
        expect(motion?.paused).toBe(false);

        Object.defineProperty(media, 'paused', {
            value: true,
            configurable: true,
        });
        media.fire('pause');
        expect(motion?.paused).toBe(true);
    });

    it('moves always when asked, and holds still under the mouse or the focus with pauseOnHover', () => {
        const started = recordAnimations();
        make({
            background: { image: { src: '/a.jpg' } },
            backgroundAnimation: { while: 'always', pauseOnHover: true },
        });
        const motion = started.at(-1);

        expect(motion?.paused).toBe(false);

        root().dispatchEvent(new Event('pointerenter'));
        expect(motion?.paused).toBe(true);

        root().dispatchEvent(new Event('pointerleave'));
        expect(motion?.paused).toBe(false);

        root().dispatchEvent(new FocusEvent('focusin'));
        expect(motion?.paused).toBe(true);

        root().dispatchEvent(
            new FocusEvent('focusout', { relatedTarget: null }),
        );
        expect(motion?.paused).toBe(false);
    });

    it('keeps moving under the mouse without pauseOnHover', () => {
        const started = recordAnimations();
        make({
            background: { color: 'red' },
            backgroundAnimation: { while: 'always' },
        });

        root().dispatchEvent(new Event('pointerenter'));
        expect(started.at(-1)?.paused).toBe(false);
    });

    it('never starts with reduced motion, nor without an animation in the look', () => {
        stubMedia((query) => query.includes('reduce'));
        const reduced = recordAnimations();
        make({ background: { color: 'red' }, backgroundAnimation: true });

        expect(reduced).toHaveLength(0);

        // The clean-up gives back the page's own motion setting and `animate`.
        player?.destroy();
        cleanUp();
        const still = recordAnimations();
        make({ background: { color: 'red' } });

        expect(still).toHaveLength(0);
    });

    it('stops the old motion when the player is built again, and when it goes', () => {
        const started = recordAnimations();
        make({ background: { color: 'red' }, backgroundAnimation: true });
        const first = started.at(-1);
        player?.setLook({ backgroundAnimation: { type: 'zoom' } });

        expect(first?.cancelled).toBe(true);
        expect(started.at(-1)?.keyframes[0]).toEqual({ transform: 'scale(1)' });

        player?.destroy();
        expect(started.at(-1)?.cancelled).toBe(true);
    });
});

describe('the <sonic-player> tag', () => {
    it('takes the background and its animation as background- attributes', () => {
        const started = recordAnimations();
        defineSonicPlayer();
        const tag = document.createElement('sonic-player');
        keep(tag);
        tag.setAttribute('src', 'note.ogg');
        tag.setAttribute('background-image', '/covers/a.jpg');
        tag.setAttribute('background-options', 'contain top repeat');
        tag.setAttribute('background-effects', 'dim sparkle grain');
        tag.setAttribute('background-animation', 'zoom always hover-pause');
        tag.setAttribute('background-duration', '40');
        document.body.append(tag);
        const picture = layer()?.firstElementChild as HTMLElement;

        expect(picture.style.getPropertyValue('background-image')).toBe(
            'url("/covers/a.jpg")',
        );
        expect(picture.style.getPropertyValue('background-size')).toBe(
            'contain',
        );
        expect(picture.style.getPropertyValue('background-position')).toBe(
            '50% 0%',
        );
        expect(picture.style.getPropertyValue('background-repeat')).toBe(
            'repeat',
        );
        // The picture, dim and the grain: an unknown word is no effect.
        expect(layer()?.children).toHaveLength(3);
        expect(started.at(-1)).toMatchObject({
            paused: false,
            options: { duration: 40000 },
        });

        // `hover-pause`: it holds still under the mouse.
        root().dispatchEvent(new Event('pointerenter'));
        expect(started.at(-1)?.paused).toBe(true);
        expect(host).toBe(tag);
    });
});
