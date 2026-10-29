/** The language of the page around `element`: the nearest `lang` attribute, else the document's. */
export function pageLanguage(element: Element): string | undefined {
    return (
        element.closest('[lang]')?.getAttribute('lang') ??
        document.documentElement.getAttribute('lang') ??
        undefined
    );
}
