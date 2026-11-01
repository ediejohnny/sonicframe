/**
 * The look of the player's chapters list: its own palette, font and style over the player's,
 * in every form.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { FONT_STACKS, PALETTES } from '../../../src/player';
import { stubMedia } from '../../support/helpers';
import { cleanUp, host, player } from './chapters-harness';
import { list, make, sizes, toggle } from './panels-harness';

afterEach(cleanUp);

describe("the list's own look", () => {
    it("takes its own palette over the player's, by name or as colors", () => {
        make({ type: 'popover', palette: 'berry' }, { palette: 'ocean' });
        sizes({ left: 100, top: 100 });
        toggle().click();
        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.berry.surface,
        );
        player?.destroy();
        host?.remove();

        make({
            type: 'drawer',
            palette: { ...PALETTES.light, surface: '#101820', text: '#f0f0f0' },
        });
        toggle().click();
        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            '#101820',
        );
        expect(list().style.getPropertyValue('--sonicframe-text')).toBe(
            '#f0f0f0',
        );
    });

    it('dresses the list in the player too', () => {
        make({ palette: 'berry', style: { corner: 1 } });

        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.berry.surface,
        );
        expect(list().style.getPropertyValue('border-radius')).toBe('1rem');
    });

    it('takes its own font, and its own corners, border, shadow, padding and text size', () => {
        make({
            type: 'popover',
            font: 'mono',
            style: {
                corner: 1,
                border: 0,
                shadow: 'none',
                padding: 1.5,
                fontSize: 1,
            },
        });
        sizes({ left: 100, top: 100 });
        toggle().click();
        const style = list().style;

        // The page may write the stack's quotes its own way.
        expect(style.getPropertyValue('font-family').replace(/["']/g, '')).toBe(
            FONT_STACKS.mono.replace(/["']/g, ''),
        );
        expect(style.getPropertyValue('border-radius')).toBe('1rem');
        expect(style.getPropertyValue('border-width')).toBe('0px');
        expect(style.getPropertyValue('box-shadow')).toBe('none');
        expect(style.getPropertyValue('padding')).toBe('1.5rem');
        expect(style.getPropertyValue('font-size')).toBe('1rem');
    });

    it('keeps sizes in range, and an unknown palette or shadow leaves the defaults', () => {
        make({
            type: 'popover',
            palette: 'nope' as never,
            style: { corner: 99, shadow: 'loud' as never },
        });
        sizes({ left: 100, top: 100 });
        toggle().click();

        expect(list().style.getPropertyValue('border-radius')).toBe('4rem');
        expect(list().style.getPropertyValue('box-shadow')).not.toBe('loud');
        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe('');
    });

    it('says when its own palette does not exist', async () => {
        make({ type: 'popover', palette: 'nope' as never });
        const errors: unknown[] = [];
        player?.on('error', (error) => errors.push(error));
        await Promise.resolve();

        expect(errors.map(String)).toEqual([
            'Error: sonicframe: unknown palette "nope"',
        ]);
    });

    it('wears the dark palette, with its own palette on auto, while the system is dark', () => {
        stubMedia((query) => query.includes('dark'));
        make({ type: 'popover', palette: 'auto' });
        sizes({ left: 100, top: 100 });
        toggle().click();

        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.dark.surface,
        );
    });
});
