/** What the docs site's tests read the way a person with a screen reader meets it. */

/** What a screen reader says for an element: its words, without what is hidden from it. */
export function nameOf(element: Element | null): string {
    const copy = element?.cloneNode(true) as Element | undefined;

    for (const hidden of copy?.querySelectorAll('[aria-hidden="true"]') ?? []) {
        hidden.remove();
    }

    return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
