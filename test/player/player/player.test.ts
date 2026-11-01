/**
 * The ready-made player: from a sound address it builds its own media, a play button, the wave and
 * the time (the volume only when asked); a palette reaches every part through custom properties and
 * `'auto'` follows the system; the time, speed and skip parts follow and move the media; a font the
 * app brings is loaded once; peaks are decoded only near the screen; shadows never carry a raw page
 * color; and destroy() leaves the container as it was. The themes are in `player-themes.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createPlayer, PALETTES, type Player } from '../../../src/player';
import { triggerResize, triggerVisible } from '../../support/fakes';
import { fakeMedia, nextFrame, stubMedia } from '../../support/helpers';
import { cleanUp, container, host, root, surface } from './player-harness';

let player: Player | null = null;

afterEach(() => {
    player?.destroy();
    player = null;
    cleanUp();
});

/**
 * A player of a 40-second sound that brings the font `family` from `src`, with `face` standing in
 * for `FontFace` and a page that takes any font.
 */
function withFont(face: unknown, family: string, src: string): Player {
    vi.stubGlobal('FontFace', face);
    Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { add: (): void => undefined },
    });

    return createPlayer({
        container: container(),
        media: fakeMedia({ duration: 40 }),
        font: { family, src },
    });
}

describe('peaks with a duration', () => {
    it('shows the duration a waveform file brings before the sound has one, and keeps it across a new theme', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia(),
            peaks: { peaks: [0.5, 1], duration: 90 },
            theme: 'bubble',
        });

        expect(player.frame.duration).toBe(90);

        player.setTheme('card');

        expect(player.frame.duration).toBe(90);
        expect(player.frame.peaks).toEqual([0.5, 1]);
    });
});

describe('the player', () => {
    it('builds its own media, a play button, the wave and the time', () => {
        player = createPlayer({
            container: container(),
            src: 'note.ogg',
            peaks: [0.2, 0.5],
        });

        expect(player.media?.getAttribute('src')).toBe('note.ogg');
        expect(root().querySelector('.sonicframe-play')).not.toBeNull();
        expect(root().querySelector('[role="slider"]')).not.toBeNull();
        expect(root().querySelector('.sonicframe-time')).not.toBeNull();
        expect(root().querySelector('.sonicframe-volume')).toBeNull();
    });

    it('lets its own media load metadata by default, or as much as the app asks', () => {
        const preloadOf = (preload?: unknown): string => {
            player?.destroy();
            player = createPlayer({
                container: container(),
                src: 'note.ogg',
                peaks: [0.2, 0.5],
                preload: preload as 'none',
            });

            return player.media?.getAttribute('preload') ?? '';
        };

        expect(preloadOf()).toBe('metadata');
        expect(preloadOf('none')).toBe('none');
        expect(preloadOf('auto')).toBe('auto');
        expect(preloadOf('everything')).toBe('metadata');
    });

    it('adds the volume control only when asked', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            volume: true,
        });

        expect(root().querySelector('.sonicframe-volume')).not.toBeNull();
    });

    it('sets the palette as custom properties on the player', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            palette: 'ocean',
        });

        expect(root().style.getPropertyValue('--sonicframe-progress')).toBe(
            PALETTES.ocean.progress,
        );
    });

    it('follows the system for the auto palette', () => {
        const listeners: (() => void)[] = [];
        let dark = false;
        vi.stubGlobal('matchMedia', (query: string) => ({
            get matches(): boolean {
                return query.includes('dark') && dark;
            },
            addEventListener: (_: string, listener: () => void): void => {
                listeners.push(listener);
            },
            removeEventListener: (): void => undefined,
        }));

        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            palette: 'auto',
        });
        expect(root().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.light.surface,
        );

        dark = true;
        listeners.forEach((listener) => listener());

        expect(root().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.dark.surface,
        );
    });

    it('wears the dark palette from the start, for the auto palette, when the system is dark', () => {
        stubMedia((query) => query.includes('dark'));

        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            palette: 'auto',
        });

        expect(surface()).toBe(PALETTES.dark.surface);
    });

    it('says when a palette does not exist, and keeps SonicFrame’s own colors', async () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            palette: 'lava' as 'light',
        });
        const errors: unknown[] = [];
        player.on('error', (error) => errors.push(error));
        await Promise.resolve();

        expect(errors.map(String)).toEqual([
            'Error: sonicframe: unknown palette "lava"',
        ]);
        expect(surface()).toBe('');
    });

    it('hides every icon from screen readers, and names every button', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            look: { line: ['back', 'play', 'forward', 'wave', 'volume'] },
            volume: true,
            zoom: { buttons: true },
        });
        const icons = [...root().querySelectorAll('svg')];
        const buttons = [...root().querySelectorAll('button')];

        // Back, play, forward, the speaker and the three zoom buttons.
        expect(icons).toHaveLength(7);
        expect(
            icons.every((icon) => icon.getAttribute('aria-hidden') === 'true'),
        ).toBe(true);
        expect(
            buttons.every(
                (button) => (button.getAttribute('aria-label') ?? '') !== '',
            ),
        ).toBe(true);
    });

    it('shows the time as the media moves', () => {
        const media = fakeMedia({ duration: 40 });
        player = createPlayer({ container: container(), media });

        media.currentTime = 5;
        media.fire('timeupdate');

        expect(root().querySelector('.sonicframe-time-text')?.textContent).toBe(
            '0:05 / 0:40',
        );
    });

    it('steps the speed and says it', () => {
        const media = fakeMedia({ duration: 40 });
        player = createPlayer({
            container: container(),
            media,
            look: { line: ['play', 'wave', 'speed'] },
        });
        const speed =
            root().querySelector<HTMLButtonElement>('.sonicframe-speed');

        speed?.click();

        expect(media.playbackRate).toBe(1.5);
        expect(speed?.getAttribute('aria-label')).toBe('Playback speed 1.5×');
        expect(speed?.textContent).toBe('1.5×');
    });

    it('skips back and forward by the look’s seconds', () => {
        const media = fakeMedia({ duration: 40 });
        player = createPlayer({
            container: container(),
            media,
            look: { line: ['back', 'play', 'forward', 'wave'], skip: 10 },
        });
        media.currentTime = 20;
        media.fire('timeupdate');

        root().querySelector<HTMLButtonElement>('.sonicframe-forward')?.click();
        expect(media.currentTime).toBe(30);

        root().querySelector<HTMLButtonElement>('.sonicframe-back')?.click();
        root().querySelector<HTMLButtonElement>('.sonicframe-back')?.click();
        expect(media.currentTime).toBe(10);
    });

    it('loads a font the app brings, quoted, with the system stack behind it', async () => {
        const faces: string[] = [];
        player = withFont(
            class {
                constructor(family: string, source: string) {
                    faces.push(`${family} ${source}`);
                }

                load(): Promise<void> {
                    return Promise.resolve();
                }
            },
            'Brand',
            '/fonts/brand.woff2',
        );
        await Promise.resolve();

        // The browser may drop the quotes of a one-word name when it reads the value back.
        expect(root().style.getPropertyValue('font-family')).toMatch(
            /^"?Brand"?, system-ui,/,
        );
        expect(faces).toEqual(['Brand url("/fonts/brand.woff2")']);
    });

    it('tells the app when a font it brings cannot load', async () => {
        const failure = new Error('font file missing');
        player = withFont(
            class {
                load(): Promise<void> {
                    return Promise.reject(failure);
                }
            },
            'Missing',
            '/fonts/missing.woff2',
        );
        const errors: unknown[] = [];
        player.on('error', (error) => errors.push(error));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(errors).toEqual([failure]);
    });

    it('decodes peaks from the sound only once it is near the screen', async () => {
        const fetch = vi.fn((_address: string) =>
            Promise.reject(new Error('offline')),
        );
        vi.stubGlobal('fetch', fetch);

        player = createPlayer({ container: container(), src: 'note.ogg' });
        const canvas = root().querySelector('canvas') as HTMLCanvasElement;
        player.frame.on('error', () => undefined);
        triggerResize(canvas, { width: 200, height: 40 });
        await nextFrame();
        expect(fetch).not.toHaveBeenCalled();

        triggerVisible(canvas, true);
        await nextFrame();

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(String(fetch.mock.calls[0]?.[0])).toContain('note.ogg');
    });

    it('decodes the sound once for both the wave and the spectrogram', async () => {
        const fetch = vi.fn(
            (_address: string) => new Promise<never>(() => undefined),
        );
        vi.stubGlobal('fetch', fetch);

        player = createPlayer({
            container: container(),
            src: 'note.ogg',
            spectrogram: true,
        });
        player.on('error', () => undefined);
        const canvas = root().querySelector('canvas') as HTMLCanvasElement;
        triggerResize(canvas, { width: 200, height: 40 });
        triggerVisible(canvas, true);
        await nextFrame();
        await nextFrame();

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('builds a hard shadow from numbers, never from a raw color', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            palette: 'paper',
            look: { shadow: 'hard', surface: 'glass' },
        });

        const shadow = root().style.getPropertyValue('box-shadow');
        const surface = root().style.getPropertyValue('background-color');

        expect(shadow).toMatch(/rgba\(\d+, \d+, \d+, [\d.]+\)/);
        expect(shadow).not.toContain('var(');
        expect(surface).toMatch(/^rgba\(/);
    });

    it('gives the container back as it was, keeping the app’s own slot element', () => {
        const avatar = document.createElement('img');
        player = createPlayer({
            container: container(),
            src: 'note.ogg',
            peaks: [0.3],
            slot: avatar,
            look: { line: ['slot', 'play', 'wave'] },
        });
        const media = player.media as HTMLMediaElement;
        const pause = vi.spyOn(media, 'pause');

        expect(root().contains(avatar)).toBe(true);

        player.destroy();

        expect(host?.childElementCount).toBe(0);
        expect(pause).toHaveBeenCalled();
        expect(avatar.isConnected).toBe(false);
    });
});
