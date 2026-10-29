/**
 * The languages SonicFrame has its own words for, and the tag a text in one of them is marked
 * with. Pure: the page's language is looked up by the DOM layer and handed in.
 */

/** The languages with built-in words: English and Portuguese. */
export type Language = 'en' | 'pt';

/** The longest language tag looked at; real tags are far shorter. */
const MAX_TAG = 35;

/** The built-in language for a tag: `pt`, `pt-BR` or `pt-PT` give Portuguese, anything else English. */
export function resolveLanguage(tag: string | null | undefined): Language {
    const primary = (tag ?? '').trim().toLowerCase().split(/[-_]/)[0];

    return primary === 'pt' ? 'pt' : 'en';
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
