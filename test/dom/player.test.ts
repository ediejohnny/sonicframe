/**
 * The ready-made player: from a sound address it builds its own media, a play button, the wave and
 * the time (the volume only when asked); a palette reaches every part through custom properties and
 * `'auto'` follows the system; the time, speed and skip parts follow and move the media; a font the
 * app brings is loaded once; peaks are decoded only near the screen; shadows never carry a raw page
 * color; and destroy() leaves the container as it was.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    createPlayer,
    PALETTES,
    registerTheme,
    type Player,
} from '../../src/player';
import { boxOf, fakeMedia, nextFrame } from './helpers';
import { triggerResize, triggerVisible } from './fakes';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function container(): HTMLElement {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 320, height: 48 });

    return host;
}

function root(): HTMLElement {
    const element = (host as HTMLElement).querySelector<HTMLElement>(
        '.sonicframe-player',
    );

    if (element === null) {
        throw new Error('test: no player');
    }

    return element;
}

/** The palette the player wears, read back from its surface color. */
function surface(): string {
    return root().style.getPropertyValue('--sonicframe-surface');
}

/** Whether the wave sits on its own line above the controls (the first line then has no button). */
function waveOnTop(): boolean {
    const first = root().firstElementChild;

    return (
        first?.querySelector('canvas') != null &&
        first.querySelector('.sonicframe-play') === null
    );
}

describe('themes on the player', () => {
    it('wears a theme by name: its palette, font and layout', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            theme: 'studio',
        });

        expect(surface()).toBe(PALETTES.dark.surface);
        expect(root().style.getPropertyValue('font-family')).toContain(
            'ui-monospace',
        );
        expect(waveOnTop()).toBe(true);
    });

    it('lets its own options win over the theme', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            theme: 'studio',
            palette: 'ocean',
            look: { wavePlace: 'inline' },
        });

        expect(surface()).toBe(PALETTES.ocean.surface);
        expect(waveOnTop()).toBe(false);
    });

    it('falls back to the default theme for a name that does not exist, and says so', async () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            theme: 'lava',
        });
        const errors: unknown[] = [];
        player.on('error', (error) => errors.push(error));
        await Promise.resolve();

        expect(String(errors[0])).toContain('unknown theme');
        expect(surface()).toBe('');
    });

    it('leaves the colors to the page with the default theme, as SonicFrame always did', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            palette: 'ocean',
        });
        expect(surface()).toBe(PALETTES.ocean.surface);

        player.setPalette('default');

        expect(surface()).toBe('');
        expect(root().style.getPropertyValue('--sonicframe-progress')).toBe('');
    });

    it('switches to another theme later', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            theme: 'bubble',
        });
        expect(waveOnTop()).toBe(false);

        player.setTheme('card');

        expect(waveOnTop()).toBe(true);
    });

    it('wears a theme the app registered', () => {
        registerTheme('brand-test', { extends: 'pulse', palette: 'berry' });
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            theme: 'brand-test',
        });

        expect(surface()).toBe(PALETTES.berry.surface);
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

    it('shows the time as the media moves', () => {
        const media = fakeMedia({ duration: 40 });
        player = createPlayer({ container: container(), media });

        media.currentTime = 5;
        media.fire('timeupdate');

        expect(root().querySelector('.sonicframe-time')?.textContent).toBe(
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
        vi.stubGlobal(
            'FontFace',
            class {
                constructor(family: string, source: string) {
                    faces.push(`${family} ${source}`);
                }

                load(): Promise<void> {
                    return Promise.resolve();
                }
            },
        );
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { add: (): void => undefined },
        });

        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            font: { family: 'Brand', src: '/fonts/brand.woff2' },
        });
        await Promise.resolve();

        // The browser may drop the quotes of a one-word name when it reads the value back.
        expect(root().style.getPropertyValue('font-family')).toMatch(
            /^"?Brand"?, system-ui,/,
        );
        expect(faces).toEqual(['Brand url("/fonts/brand.woff2")']);
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
