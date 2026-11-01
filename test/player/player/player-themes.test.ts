/**
 * Themes on the ready-made player: each brings its look and its own palette unless the player
 * picks another, an app can register its own, and a theme can be changed while the sound plays.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    PALETTES,
    registerTheme,
    type Player,
} from '../../../src/player';
import { fakeMedia } from '../../support/helpers';
import { cleanUp, container, root, surface } from './player-harness';

let player: Player | null = null;

afterEach(() => {
    player?.destroy();
    player = null;
    cleanUp();
});

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

    it('lets the controls under a wave on top wrap in a narrow space, never the line around an inline wave', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 40 }),
            theme: 'card',
        });
        const controls = root().children[1] as HTMLElement;

        expect(waveOnTop()).toBe(true);
        expect(controls.style.getPropertyValue('flex-wrap')).toBe('wrap');

        player.setTheme('bubble');
        const line = root().firstElementChild as HTMLElement;

        expect(waveOnTop()).toBe(false);
        expect(line.style.getPropertyValue('flex-wrap')).toBe('nowrap');
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
