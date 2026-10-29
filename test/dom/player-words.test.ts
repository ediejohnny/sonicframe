/**
 * The player's words and the wave in words on the player: English unless the app picks another
 * language (or `'auto'`, the page's), every label replaceable, and the description off until asked;
 * once on, it describes the slider, follows the player's language and can bring a button that reads
 * it with the browser's voice. The `<sonic-player>` tag takes the same choices as attributes.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createPlayer, defineSonicPlayer, type Player } from '../../src/player';
import { boxOf, fakeMedia } from './helpers';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('lang');
});

/** 33 seconds: sound to 20 s with a loud spot at 12 s, a 4-second pause, then sound to the end. */
const NOTE = Array.from({ length: 330 }, (_, index) => {
    const time = index / 10;

    if (time >= 20 && time < 24) {
        return 0;
    }

    return time >= 11.75 && time < 12.45 ? 1 : 0.5;
});

const ALL_PARTS = {
    line: ['back', 'play', 'forward', 'wave', 'time', 'speed'] as const,
};

/** An animation started on an element: its keyframes, and whether it was cancelled. */
type Started = { keyframes: unknown; cancelled: boolean };

/**
 * A browser voice that keeps reading until stopped, and a record of the animations started on
 * elements (`element.animate`), each marked once cancelled.
 */
function readingVoice(): Started[] {
    const pulses: Started[] = [];
    vi.stubGlobal('speechSynthesis', {
        getVoices: () => [
            { name: 'David', lang: 'en-US', localService: true, default: true },
        ],
        speak: () => undefined,
        cancel: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    });
    vi.stubGlobal(
        'SpeechSynthesisUtterance',
        class {
            constructor(readonly text: string) {}
        },
    );
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
        (keyframes) => {
            const pulse = {
                keyframes,
                cancelled: false,
                finished: Promise.resolve(),
                cancel(): void {
                    pulse.cancelled = true;
                },
            };
            pulses.push(pulse);

            return pulse as unknown as Animation;
        },
    );

    return pulses;
}

function container(): HTMLElement {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 320, height: 48 });

    return host;
}

function within(selector: string): HTMLElement {
    const element = (host as HTMLElement).querySelector<HTMLElement>(selector);

    if (element === null) {
        throw new Error(`test: nothing matches ${selector}`);
    }

    return element;
}

function labelOf(selector: string): string | null {
    return within(selector).getAttribute('aria-label');
}

function described(): string | null {
    const slider = within('[role="slider"]');
    const ids = (slider.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter((id) => id !== '');

    return ids.length === 0
        ? null
        : ids.map((id) => document.getElementById(id)?.textContent).join(' | ');
}

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

describe('the wave in words on the player', () => {
    it('is off by default', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
        });

        expect(described()).toBeNull();
        expect(player.description).toBeNull();
    });

    it("describes the slider once asked, in the player's language", () => {
        const heard: (string | null)[] = [];
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { lang: 'pt', description: true },
        });
        player.on('description', (text) => heard.push(text));
        player.setTheme('bubble');

        expect(described()).toBe(
            '33 segundos. Som até 20 segundos, uma pausa de 4 segundos, depois som até o fim. ' +
                'Mais alto por volta de 12 segundos.',
        );
        expect(player.description).toBe(described());
        expect(heard).toEqual([described()]);
    });

    it('brings a button that reads it with the browser voice, only when asked and able', async () => {
        const spoken: string[] = [];
        vi.stubGlobal('speechSynthesis', {
            getVoices: () => [
                {
                    name: 'Maria',
                    lang: 'pt-BR',
                    localService: true,
                    default: true,
                },
            ],
            speak: (utterance: {
                text: string;
                onend: (() => void) | null;
            }) => {
                spoken.push(utterance.text);
                queueMicrotask(() => utterance.onend?.());
            },
            cancel: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        });
        vi.stubGlobal(
            'SpeechSynthesisUtterance',
            class {
                onend: (() => void) | null = null;
                onerror: unknown = null;
                voice: unknown = null;
                lang = '';
                rate = 1;
                constructor(readonly text: string) {}
            },
        );
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { lang: 'pt', description: { button: true } },
        });

        expect(labelOf('.sonicframe-listen')).toBe('Ouvir a descrição');
        expect(within('.sonicframe-player').getAttribute('lang')).toBe('pt');

        within('.sonicframe-listen').click();

        expect(labelOf('.sonicframe-listen')).toBe('Parar a descrição');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(spoken[0]).toBe('33 segundos.');
        expect(labelOf('.sonicframe-listen')).toBe('Ouvir a descrição');
    });

    it('shows while it reads: filled, pulsing when asked, and back to rest when stopped', async () => {
        const pulses = readingVoice();
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { description: { button: { animation: true } } },
        });
        const button = within('.sonicframe-listen');

        expect(button.style.getPropertyValue('background-color')).toBe(
            'transparent',
        );

        button.click();

        expect(button.style.getPropertyValue('background-color')).toContain(
            '--sonicframe-button',
        );
        expect(pulses).toHaveLength(1);

        button.click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(button.style.getPropertyValue('background-color')).toBe(
            'transparent',
        );
        expect(pulses[0].cancelled).toBe(true);
    });

    it('moves only with animation on: the pulse unless another type is asked, fade when it is', () => {
        const started = readingVoice();
        const build = (button: Record<string, unknown>): void => {
            player?.destroy();
            host?.remove();
            player = createPlayer({
                container: container(),
                media: fakeMedia({ duration: 33 }),
                peaks: NOTE,
                a11y: { description: { button } },
            });
            within('.sonicframe-listen').click();
        };
        const pulse = [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }];

        build({ animation: true });
        build({ animation: true, animationType: 'fade' });
        build({ animation: true, animationType: 'spin' });
        build({ animationType: 'fade' });
        build({ animation: false, animationType: 'pulse' });

        expect(started.map(({ keyframes }) => keyframes)).toEqual([
            pulse,
            [{ opacity: 1 }, { opacity: 0.5 }],
            pulse,
        ]);
    });

    it('only changes color by default, or where the person asks for less motion', () => {
        const pulses = readingVoice();
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { description: { button: true } },
        });
        within('.sonicframe-listen').click();

        expect(pulses).toHaveLength(0);
        expect(
            within('.sonicframe-listen').style.getPropertyValue(
                'background-color',
            ),
        ).toContain('--sonicframe-button');

        player.destroy();
        host?.remove();
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query.includes('reduce'),
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { description: { button: { animation: true } } },
        });
        within('.sonicframe-listen').click();

        expect(pulses).toHaveLength(0);
        expect(
            within('.sonicframe-listen').style.getPropertyValue(
                'background-color',
            ),
        ).toContain('--sonicframe-button');
    });

    it('says so when there is no voice on the device for the language', async () => {
        vi.stubGlobal('speechSynthesis', {
            getVoices: () => [
                {
                    name: 'Online',
                    lang: 'pt-BR',
                    localService: false,
                    default: true,
                },
            ],
            speak: () => undefined,
            cancel: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        });
        vi.stubGlobal('SpeechSynthesisUtterance', class {});
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { lang: 'pt', description: { button: true } },
        });

        within('.sonicframe-listen').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.querySelector('[role="status"]')?.textContent).toBe(
            'Não foi possível ler a descrição em voz alta aqui.',
        );
        expect(labelOf('.sonicframe-listen')).toBe('Ouvir a descrição');
    });

    it('brings no button where the browser cannot speak', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            a11y: { description: { button: true } },
        });

        expect(host?.querySelector('.sonicframe-listen')).toBeNull();
        expect(described()).not.toBeNull();
    });
});

describe('the <sonic-player> tag', () => {
    it('takes the language and the description as a11y- attributes', () => {
        defineSonicPlayer();
        host = document.createElement('sonic-player');
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
        host = document.createElement('sonic-player');
        host.setAttribute('src', 'note.ogg');
        document.body.append(host);

        expect(labelOf('.sonicframe-play')).toBe('Play');
        expect(host.querySelector('[role="slider"] span[hidden]')).toBeNull();
    });
});
