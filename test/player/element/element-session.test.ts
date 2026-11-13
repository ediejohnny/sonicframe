/**
 * `<sonic-player>` and the system's media controls: `media-session` turns them on, the `media-`
 * attributes say what they show, and a change shows at once without building the player again.
 */

import { beforeAll, describe, expect, it } from 'vite-plus/test';
import { defineSonicPlayer } from '../../../src/player';
import { stubSession } from '../../support/media-session';
import { tag } from './element-harness';

beforeAll(() => {
    defineSonicPlayer();
});

/** A tag of `attributes` on the page, taken off after the test. */
function shown(attributes: Record<string, string>): HTMLElement {
    const element = tag(attributes);
    document.body.append(element);

    return element;
}

/** The tag's own audio starts playing, as far as its listeners hear. */
function play(element: HTMLElement): HTMLAudioElement {
    const audio = element.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('play'));

    return audio;
}

describe('the media controls of <sonic-player>', () => {
    it('are off without media-session', () => {
        const session = stubSession();
        play(shown({ src: 'dusk.mp3', 'media-title': 'Dusk' }));

        expect(session.metadata).toBeNull();
    });

    it('show the media- attributes once the sound plays', () => {
        const session = stubSession();
        play(
            shown({
                src: 'dusk.mp3',
                'media-session': '',
                'media-title': 'Dusk',
                'media-artist': 'Ana',
                'media-album': 'Live',
                'media-artwork': 'covers/dusk.png',
            }),
        );

        expect(session.metadata).toMatchObject({
            title: 'Dusk',
            artist: 'Ana',
            album: 'Live',
            artwork: [{ src: 'covers/dusk.png' }],
        });
    });

    it('take the label as the title when there is no media-title', () => {
        const session = stubSession();
        const element = shown({
            src: 'dusk.mp3',
            label: 'Evening note',
            'media-session': '',
            'media-title': 'Dusk',
        });
        play(element);
        element.removeAttribute('media-title');

        expect(session.metadata?.title).toBe('Evening note');
    });

    it('take the artist as the artist when there is no media-artist', () => {
        const session = stubSession();
        const element = shown({
            src: 'dusk.mp3',
            artist: 'Ana',
            'media-session': '',
            'media-artist': 'Band',
        });
        play(element);

        expect(session.metadata?.artist).toBe('Band');

        element.removeAttribute('media-artist');

        expect(session.metadata?.artist).toBe('Ana');
    });

    it('show a changed attribute at once, without building the player again', () => {
        const session = stubSession();
        const element = shown({
            src: 'dusk.mp3',
            'media-session': '',
            'media-title': 'Dusk',
        });
        const audio = play(element);

        element.setAttribute('media-title', 'Dawn');
        element.setAttribute('media-artwork', 'javascript:alert(1)');

        expect(session.metadata?.title).toBe('Dawn');
        expect(session.metadata?.artwork).toEqual([]);
        expect(element.querySelector('audio')).toBe(audio);
    });
});
