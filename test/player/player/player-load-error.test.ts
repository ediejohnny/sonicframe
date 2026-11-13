/**
 * A sound that cannot load: the player says why over the wave and in the live region, in its
 * language, and hands its `error` listeners a `SoundError` with the reason; the message goes when a
 * sound loads, and each of the two can be turned off, by option or by the tag.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    SoundError,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { afterTest, fakeMedia, showTag } from '../../support/helpers';
import { cleanUp, container, keep } from './player-harness';

afterEach(cleanUp);

type Media = ReturnType<typeof fakeMedia>;

/** A player of a sound that will fail, and what its `error` listeners heard. */
function make(options: Partial<PlayerOptions> = {}): {
    player: Player;
    media: Media;
    heard: unknown[];
} {
    const media = fakeMedia({ duration: Number.NaN });
    const player = afterTest(
        createPlayer({ container: container(), media, ...options }),
    );
    const heard: unknown[] = [];
    player.on('error', (error) => heard.push(error));

    return { player, media, heard };
}

/** The media fails to load with `MediaError.code` = `code`. */
function failWith(media: Media, code: number): void {
    Object.defineProperty(media, 'error', {
        value: { code },
        configurable: true,
    });
    media.fire('error');
}

function message(player: Player): string | null {
    return (
        player.element.querySelector('.sonicframe-load-error')?.textContent ??
        null
    );
}

function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

describe('a sound that cannot load', () => {
    it.each([
        [1, 'aborted', 'The sound stopped loading'],
        [2, 'network', 'Could not load the sound'],
        [3, 'decode', 'The sound’s file is damaged'],
        [4, 'unsupported', 'This sound cannot be played here'],
        [9, 'network', 'Could not load the sound'],
    ])(
        'code %i: says it over the wave and in the live region, and hands a SoundError (%s)',
        (code, reason, words) => {
            const { player, media, heard } = make();
            failWith(media, code);

            expect(message(player)).toBe(words);
            expect(said()).toBe(words);
            expect(heard).toHaveLength(1);
            expect(heard[0]).toBeInstanceOf(SoundError);
            expect((heard[0] as SoundError).reason).toBe(reason);
        },
    );

    it('says it in the player’s language', () => {
        const { player, media } = make({ a11y: { lang: 'pt' } });
        failWith(media, 2);

        expect(message(player)).toBe('Não foi possível carregar o som');
        expect(said()).toBe('Não foi possível carregar o som');
    });

    it.each([
        ['pt', 'Este som não toca aqui'],
        ['pt-PT', 'Este som não toca aqui'],
        ['es', 'Este sonido no se puede reproducir aquí'],
        ['fr', 'Ce son ne peut pas être lu ici'],
    ])(
        'in %s, a sound the browser cannot play (code 4, also a missing file) never blames its format',
        (lang, words) => {
            const { player, media } = make({ a11y: { lang } });
            failWith(media, 4);

            expect(message(player)).toBe(words);
        },
    );

    it('takes the message away when a sound loads, and keeps it through a new look', () => {
        const { player, media } = make();
        failWith(media, 2);
        player.setLook({ waveHeight: 3 });

        expect(message(player)).toBe('Could not load the sound');

        media.fire('loadedmetadata');

        expect(message(player)).toBeNull();
    });

    it('hides what the wave drew under the message, through a new look, and keeps the slider', () => {
        const { player, media } = make();
        const drawn = (): string | undefined =>
            player.element.querySelector('canvas')?.style.visibility;
        const slider = (): HTMLElement | null =>
            player.element.querySelector('[role="slider"]');

        expect(drawn()).toBe('');

        failWith(media, 2);
        expect(drawn()).toBe('hidden');

        player.setLook({ waveHeight: 3 });
        expect(drawn()).toBe('hidden');
        expect(slider()?.style.visibility).toBe('');
        expect(slider()?.tabIndex).toBe(0);

        media.fire('loadedmetadata');
        expect(drawn()).toBe('');
    });

    it('keeps quiet about a media element the app left without a source', () => {
        const { player, media, heard } = make();
        Object.defineProperty(media, 'currentSrc', { value: '' });
        failWith(media, 4);

        expect(message(player)).toBeNull();
        expect(heard).toEqual([]);
    });

    it('turns the message and the announcement off when asked, the event still going out', () => {
        const quiet = make({
            loadError: false,
            a11y: { loadError: { announce: false } },
        });
        document.querySelector('[role="status"]')?.replaceChildren();
        failWith(quiet.media, 2);

        expect(message(quiet.player)).toBeNull();
        expect(said()).toBe('');
        expect(quiet.heard).toHaveLength(1);

        const shown = make({ loadError: { show: false } });
        failWith(shown.media, 2);

        expect(message(shown.player)).toBeNull();
        expect(said()).toBe('Could not load the sound');
    });

    it('reads the tag’s load-error and a11y-load-error, which only turn them off', async () => {
        defineSonicPlayer();
        const element = document.createElement('sonic-player');
        element.setAttribute('src', 'https://site.test/a.mp3');
        element.setAttribute('load-error', 'false');
        element.setAttribute('a11y-load-error', 'false');
        keep(element);
        showTag(element);
        const errors: unknown[] = [];
        element.addEventListener('sonicframe:error', (event) =>
            errors.push((event as CustomEvent<unknown[]>).detail[0]),
        );
        document.querySelector('[role="status"]')?.replaceChildren();
        const media = element.player?.media as HTMLMediaElement;
        Object.defineProperty(media, 'error', { value: { code: 2 } });
        Object.defineProperty(media, 'currentSrc', {
            value: 'https://site.test/a.mp3',
        });
        media.dispatchEvent(new Event('error'));
        await Promise.resolve();

        expect(element.querySelector('.sonicframe-load-error')).toBeNull();
        expect(said()).toBe('');
        expect(errors[0]).toBeInstanceOf(SoundError);
    });
});
