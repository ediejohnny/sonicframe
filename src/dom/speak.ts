/**
 * The browser's own voice (`speechSynthesis`) for a short text: nothing to download, no dependency,
 * and only ever started by a person's action. A voice of the text's language is chosen, one on the
 * device first: the online voices some browsers offer send the text to a server, so `'local'` (the
 * default) never uses them. The text is spoken a sentence at a time, since some browsers stop a long
 * utterance midway; starting a new text stops the one before.
 */

export type SpeechOptions = {
    /** `'local'` (the default) uses only voices on the device; `'any'` also online ones. */
    voices?: 'local' | 'any';
    /** From 0.5 to 2; 1 by default. */
    rate?: number;
};

/** Text being spoken. */
export type Speaking = {
    /** Resolves once the text was spoken through or stopped; rejects when it cannot be spoken. */
    readonly done: Promise<void>;
    stop(): void;
};

/** The longest wait for the browser's list of voices, in milliseconds. */
const VOICE_WAIT = 2000;

/** The voices the browser has, waiting (once, briefly) for a list that is still loading. */
function voicesOf(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
    const now = synth.getVoices();

    if (now.length > 0) {
        return Promise.resolve(now);
    }

    return new Promise((resolve) => {
        const ready = (): void => {
            clearTimeout(timer);
            synth.removeEventListener('voiceschanged', ready);
            resolve(synth.getVoices());
        };
        const timer = setTimeout(ready, VOICE_WAIT);
        synth.addEventListener('voiceschanged', ready);
    });
}

function tagOf(lang: string): string {
    return lang.toLowerCase().replace(/_/g, '-');
}

/** A voice for `lang`: the same tag first, then the same language; the browser's default first among equals. */
function pickVoice(
    voices: readonly SpeechSynthesisVoice[],
    lang: string,
    local: boolean,
): SpeechSynthesisVoice | null {
    const wanted = tagOf(lang);
    const primary = wanted.split('-')[0];
    const usable = voices
        .filter((voice) => !local || voice.localService)
        .sort((a, b) => Number(b.default) - Number(a.default));

    return (
        usable.find((voice) => tagOf(voice.lang) === wanted) ??
        usable.find((voice) => tagOf(voice.lang).split('-')[0] === primary) ??
        null
    );
}

function sentencesOf(text: string): string[] {
    return text
        .split(/(?<=[.!?。！？])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence !== '');
}

/** Speaks `text` (in the language `lang`) with the browser's voice. */
export function speak(
    text: string,
    lang: string,
    options: SpeechOptions = {},
): Speaking {
    const synth =
        typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
    const rate = Math.min(2, Math.max(0.5, options.rate ?? 1));
    let stopped = false;
    let finish: () => void = () => undefined;

    const done = (async (): Promise<void> => {
        if (synth === null || typeof SpeechSynthesisUtterance === 'undefined') {
            throw new Error('sonicframe: this browser has no speech synthesis');
        }

        const voices = await voicesOf(synth);

        if (stopped) {
            return;
        }

        const local = options.voices !== 'any';
        const voice = pickVoice(voices, lang, local);

        if (voice === null) {
            throw new Error(
                `sonicframe: no ${local ? 'local ' : ''}voice for "${lang}"`,
            );
        }

        const sentences = sentencesOf(text);
        synth.cancel();

        await new Promise<void>((resolve, reject) => {
            finish = resolve;

            sentences.forEach((sentence, index) => {
                const utterance = new SpeechSynthesisUtterance(sentence);
                utterance.voice = voice;
                utterance.lang = voice.lang || lang;
                utterance.rate = rate;
                utterance.onerror = (event): void => {
                    if (
                        stopped ||
                        event.error === 'interrupted' ||
                        event.error === 'canceled'
                    ) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                `sonicframe: speech failed (${event.error})`,
                            ),
                        );
                    }
                };

                if (index === sentences.length - 1) {
                    utterance.onend = (): void => resolve();
                }

                synth.speak(utterance);
            });

            if (sentences.length === 0) {
                resolve();
            }
        });
    })();

    return {
        done,
        stop(): void {
            if (!stopped) {
                stopped = true;
                synth?.cancel();
                finish();
            }
        },
    };
}
