/**
 * The languages SonicFrame has its own words for, one file each in this folder, and the tag a text
 * in one of them is marked with. Pure: the page's language is looked up by the DOM layer and handed in.
 */

import { EN } from './en';
import { PT } from './pt';
import type { Words } from './words';

/** The languages with built-in words: English and Portuguese. */
export type Language = 'en' | 'pt';

/** Each built-in language's words. */
const LANGUAGES: Readonly<Record<Language, Readonly<Words>>> = Object.freeze({
    en: EN,
    pt: PT,
});

/** The longest language tag looked at; real tags are far shorter. */
const MAX_TAG = 35;

function isLanguage(name: string): name is Language {
    return Object.hasOwn(LANGUAGES, name);
}

/** The built-in language for a tag: `pt`, `pt-BR` or `pt-PT` give Portuguese, anything else English. */
export function resolveLanguage(tag: string | null | undefined): Language {
    const primary = (tag ?? '').trim().toLowerCase().split(/[-_]/)[0];

    return isLanguage(primary) ? primary : 'en';
}

/** One group of words in every built-in language, each a frozen copy. */
export function byLanguage<T extends object>(
    pick: (words: Readonly<Words>) => T,
): Readonly<Record<Language, Readonly<T>>> {
    const all = {} as Record<Language, Readonly<T>>;

    for (const language of Object.keys(LANGUAGES) as Language[]) {
        all[language] = Object.freeze({ ...pick(LANGUAGES[language]) });
    }

    return Object.freeze(all);
}

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

    const sameLanguage = valid.toLowerCase().split('-')[0] === language;

    return ownWords || sameLanguage ? valid : language;
}
