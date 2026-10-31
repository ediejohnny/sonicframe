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
