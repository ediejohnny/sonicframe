/**
 * What names the wave's slider (`a11y.sliderName`): its `position` word by default, the sound's name,
 * or both; its word again without a sound's name or with an unknown way; following `setLabel`; the
 * app's own `frame.label` winning; and the same from the tag's `a11y-slider-name`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
    type PlayerOptions,
    type SliderName,
} from '../../../src/player';
import { afterTest, fakeMedia, showTag } from '../../support/helpers';
import { cleanUp, container, keep } from './player-harness';

afterEach(cleanUp);

function make(options: Partial<PlayerOptions> = {}): Player {
    return afterTest(
        createPlayer({
            container: container(),
            media: fakeMedia(),
            ...options,
        }),
    );
}

function sliderName(within: Element): string | null {
    return (
        within.querySelector('[role="slider"]')?.getAttribute('aria-label') ??
        null
    );
}

describe('the slider’s name', () => {
    it.each([
        [undefined, 'Playback position'],
        ['position', 'Playback position'],
        ['label', 'Little Elf'],
        ['both', 'Little Elf, Playback position'],
        ['loud', 'Playback position'],
    ] as const)('%s names it "%s"', (way, expected) => {
        const player = make({
            a11y: {
                label: 'Little Elf',
                // An unknown way, as plain script could pass it.
                sliderName: way as SliderName | undefined,
            },
        });

        expect(sliderName(player.element)).toBe(expected);
    });

    it('speaks the player’s language', () => {
        const player = make({
            a11y: { lang: 'pt', label: 'Pequeno Elfo', sliderName: 'both' },
        });

        expect(sliderName(player.element)).toBe(
            'Pequeno Elfo, Posição da reprodução',
        );
    });

    it('takes the file’s name for a sound without one, and keeps its word with neither', () => {
        const named = make({
            src: '/sounds/little-elf.mp3',
            media: undefined,
            a11y: { sliderName: 'label' },
        });
        const bare = make({ a11y: { sliderName: 'both' } });

        expect(sliderName(named.element)).toBe('Little elf');
        expect(sliderName(bare.element)).toBe('Playback position');
    });

    it('follows `setLabel`', () => {
        const player = make({ a11y: { label: 'First', sliderName: 'both' } });

        player.setLabel('Second');

        expect(sliderName(player.element)).toBe('Second, Playback position');
    });

    it('gives way to the app’s own `frame.label`, also after `setLabel`', () => {
        const player = make({
            a11y: { label: 'First', sliderName: 'label' },
            frame: { label: 'Seek' },
        });

        expect(sliderName(player.element)).toBe('Seek');

        player.setLabel('Second');

        expect(sliderName(player.element)).toBe('Seek');
    });

    it('comes from the tag’s `a11y-slider-name`', () => {
        defineSonicPlayer();
        const tag = document.createElement('sonic-player');
        tag.setAttribute('src', '/sounds/little-elf.mp3');
        tag.setAttribute('label', 'Little Elf');
        tag.setAttribute('a11y-slider-name', ' both ');
        keep(tag);
        showTag(tag);

        expect(sliderName(tag)).toBe('Little Elf, Playback position');
    });
});
