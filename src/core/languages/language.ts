/**
 * The languages SonicFrame speaks: the built-in ones, one file each in this folder, and those an app
 * registers. A language tag finds its words the BCP 47 way, the whole tag first and then shorter and
 * shorter (`pt-PT-x-a`, `pt-PT`, `pt`), with English when nothing matches. Pure: the page's language
 * is looked up by the DOM layer and handed in.
 */

import { cleanText } from '../shared/text';
import { EN } from './en';
import { ES } from './es';
import { FR } from './fr';
import { languageProblems, MAX_PHRASE } from './language-check';
import { PT } from './pt';
import { PT_PT } from './pt-pt';
import type { CompleteWords, Words } from './words';

/** The built-in languages: `en` is the English of the United States, `pt` the Portuguese of Brazil. */
export type Language = 'en' | 'pt' | 'pt-PT' | 'es' | 'fr';

/**
 * A language an app asks a piece to speak: a built-in one, `'auto'` (the page's), or any other tag
 * (a registered language, or one that falls back to English). The names are offered as you type.
 */
export type LanguageTag = Language | 'auto' | (string & {});

/** `value` frozen all the way down, in place, so no app can change a built-in word for the whole page. */
function frozen<T extends object>(value: T): Readonly<T> {
    for (const inner of Object.values(value)) {
        if (typeof inner === 'object' && inner !== null) {
            frozen(inner);
        }
    }

    return Object.freeze(value);
}

/** Each built-in language's words, one line each. */
const LANGUAGES: Readonly<Record<Language, Readonly<CompleteWords>>> =
    Object.freeze({
        en: frozen(EN),
        pt: frozen(PT),
        'pt-PT': frozen(PT_PT),
        es: frozen(ES),
        fr: frozen(FR),
    });

export const LANGUAGE_NAMES: readonly Language[] = Object.freeze(
    Object.keys(LANGUAGES) as Language[],
);

/** The tags that name a built-in language, the variants `en` and `pt` are written in among them. */
const BUILT_IN_TAGS: ReadonlySet<string> = new Set([
    ...LANGUAGE_NAMES.map((name) => name.toLowerCase()),
    'en-us',
    'pt-br',
]);

/** The longest language tag looked at; real tags are far shorter. */
const MAX_TAG = 35;

/** The most languages an app may register. */
const MAX_REGISTERED = 100;

/** A language found for a tag: its own tag and its words. */
type Found = { readonly tag: string; readonly words: Readonly<CompleteWords> };

/** The registered languages, by their tag in lowercase. */
const registry = new Map<string, Found>();

function canonical(tag: string | null | undefined): string | null {
    if (typeof tag !== 'string' || tag === '' || tag.length > MAX_TAG) {
        return null;
    }

    try {
        return Intl.getCanonicalLocales(tag)[0] ?? null;
    } catch {
        return null;
    }
}

/** The tags to try for `tag`, in lowercase, longest first. */
function candidates(tag: string): string[] {
    const parts = tag.toLowerCase().split('-');

    return parts.map((_, at) => parts.slice(0, parts.length - at).join('-'));
}

/** The built-in language spelled `lower` (in lowercase), or null. */
function builtIn(lower: string): Language | null {
    return LANGUAGE_NAMES.find((name) => name.toLowerCase() === lower) ?? null;
}

/** The registered or built-in language for a tag; English when none matches. */
function find(tag: string | null | undefined): Found {
    const text = (tag ?? '').trim().replace(/_/g, '-');

    if (text.length <= MAX_TAG) {
        for (const candidate of candidates(text)) {
            const registered = registry.get(candidate);

            if (registered !== undefined) {
                return registered;
            }

            const language = builtIn(candidate);

            if (language !== null) {
                return { tag: language, words: LANGUAGES[language] };
            }
        }
    }

    return { tag: 'en', words: EN };
}

/** The language a tag gets words in: `pt-BR` gives `pt`, `pt-PT` its own, `de` English. */
export function resolveLanguage(tag: string | null | undefined): string {
    return find(tag).tag;
}

/** Every word in the language a tag gets. */
export function wordsFor(
    tag: string | null | undefined,
): Readonly<CompleteWords> {
    return find(tag).words;
}

/** One group of words in every built-in language, each a frozen copy. */
export function byLanguage<T extends object>(
    pick: (words: Readonly<CompleteWords>) => T,
): Readonly<Record<Language, Readonly<T>>> {
    const all = {} as Record<Language, Readonly<T>>;

    for (const language of LANGUAGE_NAMES) {
        all[language] = Object.freeze({ ...pick(LANGUAGES[language]) });
    }

    return Object.freeze(all);
}

/** The first subtag, in lowercase: the language without its region. */
function primary(tag: string): string {
    return tag.toLowerCase().split('-')[0];
}

/**
 * The tag that numbers are formatted in and a text is marked with. Built-in words keep their own
 * language, so a tag SonicFrame has no words for never mixes two languages in one sentence; words the
 * app brings follow its tag, when the tag is valid.
 */
export function localeFor(
    tag: string | null | undefined,
    ownWords: boolean,
): string {
    const language = resolveLanguage(tag);
    const valid = canonical(tag);

    if (valid === null) {
        return language;
    }

    return ownWords || primary(valid) === primary(language) ? valid : language;
}

/** A frozen copy of checked words, each phrase one safe line; a phrase left out is English's. */
function cleanWords(words: Words): Readonly<CompleteWords> {
    const copy: Record<string, Readonly<Record<string, string>>> = {};

    for (const [group, phrases] of Object.entries(EN)) {
        const english = phrases as Readonly<Record<string, string>>;
        const own =
            (words as Record<string, Record<string, string> | undefined>)[
                group
            ] ?? {};
        const clean: Record<string, string> = {};

        for (const name of Object.keys(english)) {
            clean[name] = cleanText(own[name] ?? english[name], MAX_PHRASE);
        }

        copy[group] = Object.freeze(clean);
    }

    return Object.freeze(copy) as unknown as Readonly<CompleteWords>;
}

/**
 * Gives SonicFrame a whole language under a BCP 47 tag (`registerLanguage('ja', words)`): every piece
 * whose language tag finds it speaks it, `ja-JP` too. The words must be complete, with English's
 * marks (`languageProblems` says what is wrong), except the phrases added after 1.0, which are said
 * in English when left out; each phrase is cleaned to one safe line. The
 * built-in languages (`en`, `en-US`, `pt`, `pt-BR`, `pt-PT`, `es`, `fr`) cannot be replaced; returns
 * false for one of them, a malformed tag, words with a problem, or past the limit of languages.
 */
export function registerLanguage(tag: string, words: Words): boolean {
    const valid = canonical(tag);

    if (valid === null) {
        return false;
    }

    const lower = valid.toLowerCase();

    if (
        BUILT_IN_TAGS.has(lower) ||
        languageProblems(words).length > 0 ||
        (registry.size >= MAX_REGISTERED && !registry.has(lower))
    ) {
        return false;
    }

    registry.set(
        lower,
        Object.freeze({ tag: valid, words: cleanWords(words) }),
    );

    return true;
}
