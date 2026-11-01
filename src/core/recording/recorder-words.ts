/**
 * The voice recorder's words in one language: English unless the app picks another, with any of its
 * own laid over them, each cleaned to one line and capped; marks are filled with SonicFrame's own
 * values only.
 */

import { localeFor, wordsFor } from '../languages/language';
import { mergeWords } from '../languages/merge-words';
import type { RecorderWords } from '../languages/words';
import { cleanText, fillTemplate } from '../shared/text';

/** The longest word taken from the app, in characters. */
const MAX_WORD = 120;

export type RecorderSay = {
    /** The language tag the words are in. */
    readonly locale: string;
    readonly words: Readonly<RecorderWords>;
    /** A phrase with its marks filled in. */
    say(
        name: keyof RecorderWords,
        values?: Readonly<Record<string, string>>,
    ): string;
};

/** The recorder's words for a language tag, with the app's own over them. */
export function recorderWords(
    lang: string | null | undefined,
    own?: Partial<RecorderWords>,
): RecorderSay {
    const words = mergeWords(wordsFor(lang).recorder, own, MAX_WORD);

    return {
        locale: localeFor(lang, own !== undefined),
        words,
        say: (name, values = {}) =>
            cleanText(fillTemplate(words[name], values), MAX_WORD),
    };
}
