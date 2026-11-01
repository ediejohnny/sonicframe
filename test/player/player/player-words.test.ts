/**
 * The player's words: English unless the app picks another language (or `'auto'`, the page's),
 * every label replaceable, and the `<sonic-player>` tag taking the same choices as attributes.
 * The wave in words is in `player-description.test.ts`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
} from '../../../src/player';
import { fakeMedia } from '../../support/helpers';
import { cleanUp, container, keep, labelOf, within } from './player-harness';

let player: Player | null = null;

afterEach(() => {
    player?.destroy();
    player = null;
    cleanUp();
});

const ALL_PARTS = {
    line: ['back', 'play', 'forward', 'wave', 'time', 'speed'] as const,
};

describe("the player's words", () => {
    it('speaks English by default, as it always did', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            look: { line: [...ALL_PARTS.line] },
            volume: true,
        });

        expect(labelOf('.sonicframe-player')).toBe('Audio player');
        expect(labelOf('[role="slider"]')).toBe('Playback position');
        expect(within('[role="slider"]').getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:33',
        );
        expect(labelOf('.sonicframe-play')).toBe('Play');
        expect(labelOf('.sonicframe-back')).toBe('Back 10 seconds');
        expect(labelOf('.sonicframe-speed')).toBe('Playback speed 1×');
        expect(labelOf('.sonicframe-volume-bar')).toBe('Volume');
    });

    it('speaks Portuguese when asked', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            look: { line: [...ALL_PARTS.line], speeds: [1.5, 2] },
            volume: true,
            a11y: { lang: 'pt-BR' },
        });

        expect(labelOf('.sonicframe-player')).toBe('Player de áudio');
        expect(labelOf('[role="slider"]')).toBe('Posição da reprodução');
        expect(within('[role="slider"]').getAttribute('aria-valuetext')).toBe(
            '0:00 de 0:33',
        );
        expect(labelOf('.sonicframe-play')).toBe('Reproduzir');
        expect(labelOf('.sonicframe-back')).toBe('Voltar 10 segundos');
        expect(labelOf('.sonicframe-forward')).toBe('Avançar 10 segundos');
        expect(labelOf('.sonicframe-volume-button')).toBe('Silenciar');

        within('.sonicframe-speed').click();

        expect(labelOf('.sonicframe-speed')).toBe('Velocidade 1,5×');
    });

    it('speaks European Portuguese, Spanish and French, a tag with a region finding its language', () => {
        const names: [string, string, string, string][] = [
            ['pt-PT', 'Leitor de áudio', 'Recuar 10 segundos', 'silenciado'],
            [
                'es-MX',
                'Reproductor de audio',
                'Retroceder 10 segundos',
                'silenciado',
            ],
            ['fr-CA', 'Lecteur audio', 'Reculer de 10 secondes', 'son coupé'],
        ];

        for (const [lang, name, back, muted] of names) {
            player = createPlayer({
                container: container(),
                media: fakeMedia({ duration: 33 }),
                look: { line: ['back', 'play', 'wave'] },
                volume: true,
                a11y: { lang },
            });
            within('.sonicframe-volume-button').click();

            expect(labelOf('.sonicframe-player'), lang).toBe(name);
            expect(labelOf('.sonicframe-back'), lang).toBe(back);
            expect(
                within('.sonicframe-volume-bar').getAttribute('aria-valuetext'),
                lang,
            ).toBe(muted);

            player.destroy();
            cleanUp();
        }

        player = null;
    });

    it('names a one-second skip in the singular, in each language', () => {
        const names: [string | undefined, string, string][] = [
            [undefined, 'Back 1 second', 'Forward 1 second'],
            ['pt-BR', 'Voltar 1 segundo', 'Avançar 1 segundo'],
            ['pt-PT', 'Recuar 1 segundo', 'Avançar 1 segundo'],
            ['es', 'Retroceder 1 segundo', 'Avanzar 1 segundo'],
            ['fr', 'Reculer de 1 seconde', 'Avancer de 1 seconde'],
        ];

        for (const [lang, back, forward] of names) {
            player = createPlayer({
                container: container(),
                media: fakeMedia({ duration: 33 }),
                look: { line: ['back', 'play', 'wave', 'forward'], skip: 1 },
                a11y: { lang },
            });

            expect(labelOf('.sonicframe-back'), lang).toBe(back);
            expect(labelOf('.sonicframe-forward'), lang).toBe(forward);

            player.destroy();
            cleanUp();
        }

        player = null;
    });

    it("follows each language's own plural rules: 1.5 is singular in French, plural in English", () => {
        const names: [string, string][] = [
            ['en', 'Back 1.5 seconds'],
            ['fr', 'Reculer de 1,5 seconde'],
        ];

        for (const [lang, back] of names) {
            player = createPlayer({
                container: container(),
                media: fakeMedia({ duration: 33 }),
                look: { line: ['back', 'play', 'wave'], skip: 1.5 },
                a11y: { lang },
            });

            expect(labelOf('.sonicframe-back'), lang).toBe(back);

            player.destroy();
            cleanUp();
        }

        player = null;
    });

    it("keeps the app's own skip label for one second when it gives no singular", () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            look: { line: ['back', 'play', 'wave', 'forward'], skip: 1 },
            a11y: {
                labels: {
                    back: 'Rewind {seconds}s',
                    forward: 'Skip {seconds}s',
                    forwardOne: 'Skip one second',
                },
            },
        });

        expect(labelOf('.sonicframe-back')).toBe('Rewind 1s');
        expect(labelOf('.sonicframe-forward')).toBe('Skip one second');
    });

    it("gives the app's plugins its language", () => {
        const seen: string[] = [];
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            a11y: { lang: 'fr-CA' },
            plugins: [
                {
                    name: 'listener',
                    setup: (host) => void seen.push(host.lang),
                },
            ],
        });

        expect(seen.at(-1)).toBe('fr-CA');
    });

    it("follows the page's language with 'auto'", () => {
        document.documentElement.setAttribute('lang', 'pt-BR');
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            a11y: { lang: 'auto' },
        });

        expect(labelOf('.sonicframe-play')).toBe('Reproduzir');
    });

    it('takes any label of the app, cleaned, over the language', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            a11y: {
                lang: 'pt',
                labels: {
                    play: 'Tocar\u0007 a mensagem',
                    value: '{time} até {duration}',
                },
            },
        });

        expect(labelOf('.sonicframe-play')).toBe('Tocar a mensagem');
        expect(within('[role="slider"]').getAttribute('aria-valuetext')).toBe(
            '0:00 até 0:33',
        );
    });
});

describe('the a11y group of the player', () => {
    it('takes its name and its words in a11y, over the old label and labels', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            label: 'Old name',
            a11y: {
                lang: 'pt',
                label: 'Mensagem de voz',
                labels: { play: 'Old', pause: 'Old' },
                words: { play: 'Ouvir' },
            },
        });

        expect(labelOf('.sonicframe-player')).toBe('Mensagem de voz');
        expect(labelOf('.sonicframe-play')).toBe('Ouvir');
    });

    it('still takes the old label and labels alone', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            label: 'Episode',
            a11y: { labels: { play: 'Listen' } },
        });

        expect(labelOf('.sonicframe-player')).toBe('Episode');
        expect(labelOf('.sonicframe-play')).toBe('Listen');
    });

    it('takes its name from the a11y-label attribute, over label', () => {
        defineSonicPlayer();
        const host = document.createElement('sonic-player');
        keep(host);
        host.setAttribute('src', 'note.ogg');
        host.setAttribute('label', 'Old name');
        host.setAttribute('a11y-label', 'Voice note');
        document.body.append(host);

        expect(labelOf('.sonicframe-player')).toBe('Voice note');

        host.removeAttribute('a11y-label');

        expect(labelOf('.sonicframe-player')).toBe('Old name');
    });
});

describe('the <sonic-player> tag', () => {
    it('takes the language and the description as a11y- attributes', () => {
        defineSonicPlayer();
        const host = document.createElement('sonic-player');
        keep(host);
        host.setAttribute('src', 'note.ogg');
        host.setAttribute('a11y-lang', 'pt-BR');
        host.setAttribute('a11y-description', 'keys pauses <img src=x>');
        document.body.append(host);

        expect(labelOf('.sonicframe-play')).toBe('Reproduzir');
        expect(
            within('[role="slider"] span[hidden]').getAttribute('lang'),
        ).toBe('pt-BR');
        expect(host.querySelector('img')).toBeNull();
    });

    it('takes a language with a region', () => {
        defineSonicPlayer();
        const host = document.createElement('sonic-player');
        keep(host);
        host.setAttribute('src', 'note.ogg');
        host.setAttribute('a11y-lang', 'es-MX');
        document.body.append(host);

        expect(labelOf('.sonicframe-play')).toBe('Reproducir');
        expect(
            host.querySelector('.sonicframe-player')?.getAttribute('lang'),
        ).toBe('es-MX');
    });

    it('has no description without the attribute', () => {
        defineSonicPlayer();
        const host = document.createElement('sonic-player');
        keep(host);
        host.setAttribute('src', 'note.ogg');
        document.body.append(host);

        expect(labelOf('.sonicframe-play')).toBe('Play');
        expect(host.querySelector('[role="slider"] span[hidden]')).toBeNull();
    });
});
