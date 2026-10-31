/**
 * The browser's own voice for the description: off until the app turns it on, a local voice of the
 * text's language first (online voices send the text away), a sentence at a time, and quiet the
 * moment it is stopped or the wave goes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { soundDescription } from '../../../src/index';
import { fakeMedia, mount, type Mounted } from '../../support/helpers';
import { NOTE } from '../../support/sounds';

type Voice = {
    name: string;
    lang: string;
    localService: boolean;
    default: boolean;
};

class FakeUtterance {
    text: string;
    lang = '';
    voice: Voice | null = null;
    rate = 1;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;

    constructor(text: string) {
        this.text = text;
    }
}

class FakeSynthesis extends EventTarget {
    voices: Voice[] = [];
    spoken: FakeUtterance[] = [];
    cancels = 0;
    /** Ends each utterance on its own; off to keep one "playing". */
    finish = true;

    getVoices(): Voice[] {
        return this.voices;
    }

    speak(utterance: FakeUtterance): void {
        this.spoken.push(utterance);

        if (this.finish) {
            queueMicrotask(() => utterance.onend?.());
        }
    }

    cancel(): void {
        this.cancels++;
    }
}

const VOICES: Voice[] = [
    { name: 'Online pt', lang: 'pt-BR', localService: false, default: false },
    { name: 'Maria', lang: 'pt-BR', localService: true, default: false },
    { name: 'David', lang: 'en-US', localService: true, default: true },
];

let mounted: Mounted | null = null;
let synthesis: FakeSynthesis;

function install(): void {
    synthesis = new FakeSynthesis();
    Object.assign(globalThis, {
        speechSynthesis: synthesis,
        SpeechSynthesisUtterance: FakeUtterance,
    });
}

beforeEach(() => install());

afterEach(() => {
    Reflect.deleteProperty(globalThis, 'speechSynthesis');
    Reflect.deleteProperty(globalThis, 'SpeechSynthesisUtterance');
});

function described(options: Parameters<typeof soundDescription>[0]) {
    const plugin = soundDescription(options);
    mounted = mount({
        media: fakeMedia({ duration: 33 }),
        peaks: NOTE,
        plugins: [plugin],
    });

    return plugin;
}

describe("the browser's voice", () => {
    it('is off unless the app turns it on', async () => {
        synthesis.voices = VOICES;
        const plugin = described({});

        await expect(plugin.speak()).rejects.toThrow(/speech/);
        expect(synthesis.spoken).toEqual([]);
    });

    it('speaks a sentence at a time with a local voice of the language', async () => {
        synthesis.voices = VOICES;
        const plugin = described({ lang: 'pt', speech: true });

        await plugin.speak();

        expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual([
            '33 segundos.',
            'Som até 20 segundos, uma pausa de 4 segundos, depois som até o fim.',
            'Mais alto por volta de 12 segundos.',
        ]);
        expect(
            synthesis.spoken.every(
                (utterance) => utterance.voice?.name === 'Maria',
            ),
        ).toBe(true);
    });

    it('speaks at the usual rate when the rate is not a number', async () => {
        synthesis.voices = VOICES;

        for (const rate of [Number.NaN, '1.5' as unknown as number]) {
            synthesis.spoken = [];
            await described({ speech: { rate } }).speak();

            expect(synthesis.spoken[0]?.rate).toBe(1);
        }
    });

    it('never sends the text to an online voice unless the app allows it', async () => {
        synthesis.voices = [VOICES[0]];

        await expect(
            described({ lang: 'pt', speech: true }).speak(),
        ).rejects.toThrow(/voice/);
        expect(synthesis.spoken).toEqual([]);

        mounted?.frame.destroy();
        mounted?.unmount();
        await described({ lang: 'pt', speech: { voices: 'any' } }).speak();

        expect(synthesis.spoken[0]?.voice?.name).toBe('Online pt');
    });

    it('waits for the list of voices when the browser has not loaded it yet', async () => {
        const plugin = described({ speech: true });
        const speaking = plugin.speak();

        synthesis.voices = VOICES;
        synthesis.dispatchEvent(new Event('voiceschanged'));
        await speaking;

        expect(synthesis.spoken[0]?.voice?.name).toBe('David');
    });

    it('stops when asked, on Escape, and when the wave goes', async () => {
        synthesis.voices = VOICES;
        synthesis.finish = false;
        const plugin = described({ speech: true });

        const first = plugin.speak();
        await Promise.resolve();
        plugin.stopSpeaking();
        await first;

        const second = plugin.speak();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(plugin.speaking).toBe(true);
        mounted?.container.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        await second;

        expect(plugin.speaking).toBe(false);

        const cancels = synthesis.cancels;
        const third = plugin.speak();
        await new Promise((resolve) => setTimeout(resolve, 0));
        mounted?.frame.destroy();
        await third;

        expect(synthesis.cancels).toBeGreaterThan(cancels);
    });

    it('says so when the browser cannot speak', async () => {
        Reflect.deleteProperty(globalThis, 'speechSynthesis');

        await expect(described({ speech: true }).speak()).rejects.toThrow(
            /speech/,
        );
    });
});
