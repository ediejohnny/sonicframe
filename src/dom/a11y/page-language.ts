import { localeFor } from '../../core/languages/language';

/** The language of the page around `element`: the nearest `lang` attribute, else the document's. */
export function pageLanguage(element: Element): string | undefined {
    return (
        element.closest('[lang]')?.getAttribute('lang') ??
        document.documentElement.getAttribute('lang') ??
        undefined
    );
}

/**
 * The language tag a piece speaks: the valid tag the app asked for, the page's for `'auto'`, and
 * `'en'` without one.
 */
export function chosenLanguage(
    asked: string | undefined,
    element: Element,
): string {
    return localeFor(asked === 'auto' ? pageLanguage(element) : asked, true);
}
