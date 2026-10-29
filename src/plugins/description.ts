/**
 * The wave in words on the page. The description of the sound (see `describeSound`) reaches screen
 * readers through the slider's `aria-describedby`, read when the wave takes focus, next to the
 * page's own ids, which it never removes; the person's screen reader is the narrator. Everything
 * else is the app's choice and off until asked: an element of the app that shows the text, saying
 * it when it arrives while the wave has focus, keys to hear it again and to step between the parts,
 * "pause" on the slider's value inside a silence, and the browser's own voice for people without a
 * screen reader (never on its own: only through `speak()`). Text only ever goes in as text.
 */

import {
    nextPart,
    outlineSound,
    silenceAt,
    soundWords,
    type DescriptionWords,
    type OutlineOptions,
    type SoundOutline,
    type SoundWords,
} from '../core/describe';
import { cleanText } from '../core/text';
import type { Plugin, PluginHost } from '../types';
import { addDescribedBy, removeDescribedBy } from '../dom/describedby';
import { pageLanguage } from '../dom/page-language';
import { speak, type Speaking, type SpeechOptions } from '../dom/speak';

/** Single-key shortcuts while the wave has focus; a key set to false is not used. */
export type SoundDescriptionKeys = {
    /** Says the description again through the live region; `'d'` by default. */
    again?: string | false;
    /** Steps to the next part; with Shift, back to the previous one. `'p'` by default. */
    parts?: string | false;
    /** How far into a part Shift+P goes back to its own start rather than the one before, in seconds; 1 by default. */
    backGrace?: number;
};

export type SoundDescriptionOptions = OutlineOptions & {
    /** Your own description (written ahead on a server, say), used instead of the one from the peaks. */
    text?: string;
    /** `'en'` (the default), `'pt'`, any tag with your own `words`, or `'auto'` (the page's language). */
    lang?: string;
    /** Your own phrases, over the built-in ones. */
    words?: Partial<DescriptionWords>;
    /** Positions as words (`'words'`, the default) or as a clock (`'clock'`). */
    times?: 'words' | 'clock';
    /** Describe the slider through its `aria-describedby`; true by default. */
    describedBy?: boolean;
    /** An element of yours that shows the text; it is given back as it was on destroy. */
    target?: HTMLElement | null;
    /** Say the description once if it arrives while the wave has focus; off by default. */
    announceWhenReady?: boolean;
    /** Keys D (again) and P / Shift+P (between the parts): true, your own letters, or false (the default). */
    keys?: boolean | SoundDescriptionKeys;
    /** Add "pause" to the slider's value inside a silence; off by default. */
    pauseInValue?: boolean;
    /**
     * Let `speak()` read the text with the browser's own voice: true, or `{ voices, rate }`; off by
     * default. Only voices on the device unless `voices: 'any'` (online voices send the text away).
     */
    speech?: boolean | SpeechOptions;
    /** Called with the new text (or null) whenever it changes. */
    onChange?: (text: string | null) => void;
};

export type SoundDescriptionPlugin = Plugin & {
    /** The description, or null while the peaks or the duration are unknown. */
    readonly text: string | null;
    /** The shape it was written from, or null (also while your own text is used). */
    readonly outline: SoundOutline | null;
    /** The language tag the text is in. */
    readonly locale: string;
    /** Uses your own text; null goes back to the description from the peaks. */
    set(text: string | null): void;
    /** Writes the description again (after the page's language changed, say). */
    refresh(): void;
    /** Says the description through the page's live region. */
    say(): void;
    /** Whether the browser's voice is reading the text. */
    readonly speaking: boolean;
    /**
     * Reads the text with the browser's voice (needs the `speech` option); resolves once it was read
     * through or stopped, rejects when it cannot be read (no voice, say). Call it from a person's action.
     */
    speak(): Promise<void>;
    /** Stops the browser's voice (Escape on the wave does too). */
    stopSpeaking(): void;
};

/** The longest text taken from the app, in characters. */
const MAX_TEXT = 2000;

let counter = 0;

/** A key name as one lower-case character, or null for none (a word such as "Enter" is no letter). */
function letter(
    key: string | false | undefined,
    fallback: string,
): string | null {
    if (key === false) {
        return null;
    }

    const chosen = key ?? fallback;

    return chosen.length === 1 ? chosen.toLowerCase() : null;
}

export function soundDescription(
    options: SoundDescriptionOptions = {},
): SoundDescriptionPlugin {
    const describedId = `sonicframe-description-${++counter}`;
    const keys =
        options.keys === true
            ? { again: 'd', parts: 'p' }
            : options.keys
              ? {
                    again: letter(options.keys.again, 'd'),
                    parts: letter(options.keys.parts, 'p'),
                }
              : { again: null, parts: null };
    const backGrace = Math.max(
        0,
        (typeof options.keys === 'object'
            ? options.keys.backGrace
            : undefined) ?? 1,
    );
    const target = options.target ?? null;
    const saved =
        target === null
            ? null
            : { text: target.textContent, lang: target.getAttribute('lang') };

    let host: PluginHost | null = null;
    let element: HTMLSpanElement | null = null;
    let own =
        options.text === undefined ? null : cleanText(options.text, MAX_TEXT);
    let words: SoundWords = soundWords();
    let outline: SoundOutline | null = null;
    let text: string | null = null;
    let speaking: Speaking | null = null;
    const cleanups: (() => void)[] = [];

    function stopSpeaking(): void {
        speaking?.stop();
        speaking = null;
    }

    /** The words for the language asked; `'auto'` reads the page's language at this moment. */
    function wordsFor(current: PluginHost): SoundWords {
        const lang =
            options.lang === 'auto'
                ? pageLanguage(current.container)
                : options.lang;

        return soundWords({ lang, words: options.words, times: options.times });
    }

    function show(current: PluginHost): void {
        if (options.describedBy !== false) {
            if (element === null) {
                element = document.createElement('span');
                element.id = describedId;
                element.hidden = true;
                element.style.setProperty('display', 'none');
                current.container.append(element);
            }

            element.textContent = text ?? '';
            element.setAttribute('lang', words.locale);

            if (text === null) {
                removeDescribedBy(current.container, describedId);
            } else {
                addDescribedBy(current.container, describedId);
            }
        }

        if (target !== null) {
            target.textContent = text ?? '';
            target.setAttribute('lang', words.locale);
        }
    }

    function update(): void {
        const current = host;

        if (current === null) {
            return;
        }

        words = wordsFor(current);
        const duration = current.duration;
        const peaks = current.peaks;
        outline =
            own === null && peaks !== null && duration !== null
                ? outlineSound(peaks, duration, options)
                : null;
        const next = own ?? (outline === null ? null : words.describe(outline));
        const changed = next !== text;
        const arrived = text === null && next !== null;
        text = next;
        show(current);

        if (options.pauseInValue) {
            current.updateValueText();
        }

        if (!changed) {
            return;
        }

        if (
            arrived &&
            options.announceWhenReady &&
            next !== null &&
            current.container.contains(document.activeElement)
        ) {
            current.announce(next);
        }

        options.onChange?.(text);
    }

    /** Steps to the next part (or back), says where it landed, or that there is none. */
    function step(current: PluginHost, back: boolean): boolean {
        const duration = current.duration;

        if (outline === null || outline.silent || duration === null) {
            return false;
        }

        const time = current.progress * duration;
        const index = nextPart(outline, time, back ? -1 : 1, backGrace);

        if (index === null) {
            current.announce(words.noPart());

            return true;
        }

        const start = outline.parts[index].start;
        current.seekTo(start / duration);
        current.announce(words.part(index, outline.parts.length, start));

        return true;
    }

    return {
        name: 'sound-description',

        get text(): string | null {
            return text;
        },

        get outline(): SoundOutline | null {
            return outline;
        },

        get locale(): string {
            return words.locale;
        },

        setup(pluginHost): void {
            host = pluginHost;
            cleanups.push(
                pluginHost.on('peakschange', () => update()),
                pluginHost.on('durationchange', () => update()),
            );
            update();
        },

        set(next): void {
            own = next === null ? null : cleanText(next, MAX_TEXT);
            update();
        },

        refresh(): void {
            update();
        },

        say(): void {
            if (host !== null && text !== null) {
                host.announce(text);
            }
        },

        get speaking(): boolean {
            return speaking !== null;
        },

        speak(): Promise<void> {
            if (!options.speech) {
                return Promise.reject(
                    new Error('sonicframe: speech is off (the speech option)'),
                );
            }

            stopSpeaking();

            if (text === null) {
                return Promise.resolve();
            }

            const current = speak(
                text,
                words.locale,
                options.speech === true ? {} : options.speech,
            );
            speaking = current;

            return current.done.finally(() => {
                if (speaking === current) {
                    speaking = null;
                }
            });
        },

        stopSpeaking,

        keyDown(key, modifiers): boolean {
            const current = host;

            if (
                current === null ||
                modifiers.ctrlKey ||
                modifiers.altKey ||
                modifiers.metaKey
            ) {
                return false;
            }

            if (key === 'Escape' && speaking !== null) {
                stopSpeaking();

                return true;
            }

            // Shift, not the letter's case, picks the direction: Caps Lock flips the case.
            const pressed = key.toLowerCase();

            if (keys.again !== null && pressed === keys.again) {
                if (text === null) {
                    return false;
                }

                current.announce(text);

                return true;
            }

            if (keys.parts !== null && pressed === keys.parts) {
                return step(current, modifiers.shiftKey === true);
            }

            return false;
        },

        valueNote(time): string | void {
            if (!options.pauseInValue || outline === null || time === null) {
                return;
            }

            const silence = silenceAt(outline, time);

            if (silence === 'pause') {
                return words.pauseNote();
            }

            if (silence === 'silence') {
                return words.silenceNote();
            }
        },

        destroy(): void {
            stopSpeaking();

            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            if (host !== null) {
                removeDescribedBy(host.container, describedId);
            }

            element?.remove();
            element = null;

            if (target !== null && saved !== null) {
                target.textContent = saved.text;

                if (saved.lang === null) {
                    target.removeAttribute('lang');
                } else {
                    target.setAttribute('lang', saved.lang);
                }
            }

            host = null;
            outline = null;
            text = null;
        },
    };
}
