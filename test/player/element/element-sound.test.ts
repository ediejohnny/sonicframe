/**
 * `<sonic-player>` keeps its sound playing through what does not change it: a player built again for
 * an attribute keeps the same audio (where it was, its volume and speed), and the tag moved to another
 * place on the page keeps its player. Only a new `src` or `preload` brings a new sound, and a tag taken
 * off the page lets its sound go.
 */

import { beforeAll, describe, expect, it } from 'vite-plus/test';
import { defineSonicPlayer } from '../../../src/player';
import { tag } from './element-harness';

beforeAll(() => {
    defineSonicPlayer();
});

/** The audio the tag plays now. */
function audioOf(element: HTMLElement): HTMLAudioElement {
    return element.querySelector('audio') as HTMLAudioElement;
}

describe('the sound of <sonic-player>', () => {
    it('keeps the same audio, where it was, when an attribute builds the player again', () => {
        const element = tag({ src: 'dusk.mp3', 'a11y-label': 'Dusk' });
        document.body.append(element);
        const audio = audioOf(element);
        const before = element.player;
        audio.currentTime = 12;
        audio.volume = 0.4;
        audio.playbackRate = 1.5;

        element.setAttribute('a11y-label', 'Dawn');

        expect(element.player).not.toBe(before);
        expect(element.player?.media).toBe(audio);
        expect(audioOf(element)).toBe(audio);
        expect(audio.currentTime).toBe(12);
        expect(audio.volume).toBe(0.4);
        expect(audio.playbackRate).toBe(1.5);
        expect(element.querySelectorAll('audio')).toHaveLength(1);
    });

    it('brings a new sound for a new src', () => {
        const element = tag({ src: 'dusk.mp3' });
        document.body.append(element);
        const audio = audioOf(element);

        element.setAttribute('src', 'dawn.mp3');

        expect(audioOf(element)).not.toBe(audio);
        expect(audioOf(element).getAttribute('src')).toBe('dawn.mp3');
        expect(audio.hasAttribute('src')).toBe(false);
    });

    it('keeps its player when it moves to another place on the page', async () => {
        const element = tag({ src: 'dusk.mp3' });
        const elsewhere = document.createElement('section');
        document.body.append(element, elsewhere);
        const before = element.player;
        const audio = audioOf(element);

        elsewhere.append(element);
        await Promise.resolve();

        expect(element.player).toBe(before);
        expect(audioOf(element)).toBe(audio);
        expect(audio.getAttribute('src')).toBe('dusk.mp3');
        elsewhere.remove();
    });

    it('lets its sound go once it is taken off the page', async () => {
        const element = tag({ src: 'dusk.mp3' });
        document.body.append(element);
        const audio = audioOf(element);

        element.remove();
        await Promise.resolve();

        expect(element.player).toBeNull();
        expect(audio.hasAttribute('src')).toBe(false);
    });
});
