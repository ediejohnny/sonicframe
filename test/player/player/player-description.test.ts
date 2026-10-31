/**
 * The wave in words on the player: off until asked; once on, it describes the slider, follows the
 * player's language and can bring a button that reads it with the browser's voice.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createPlayer, type Player } from '../../../src/player';
import { fakeMedia } from '../../support/helpers';
import { cleanUp, container, host, labelOf, within } from './player-harness';

let player: Player | null = null;

afterEach(() => {
    player?.destroy();
    player = null;
    cleanUp();
});

/** 33 seconds: sound to 20 s with a loud spot at 12 s, a 4-second pause, then sound to the end. */
const NOTE = Array.from({ length: 330 }, (_, index) => {
    const time = index / 10;

    if (time >= 20 && time < 24) {
        return 0;
    }

    return time >= 11.75 && time < 12.45 ? 1 : 0.5;
});

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

function described(): string | null {
    const slider = within('[role="slider"]');
    const ids = (slider.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter((id) => id !== '');

    return ids.length === 0
        ? null
        : ids.map((id) => document.getElementById(id)?.textContent).join(' | ');
}

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
