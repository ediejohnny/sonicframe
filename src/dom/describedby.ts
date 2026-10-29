/**
 * One id in an element's `aria-describedby`, added or taken out without touching the others: the
 * page's own ids and those of other plugins stay where they are, even ones added in between.
 */

function idsOf(element: Element): string[] {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((id) => id !== '');
}

/** Adds `id` after the ids already there (once). */
export function addDescribedBy(element: Element, id: string): void {
    const ids = idsOf(element);

    if (!ids.includes(id)) {
        element.setAttribute('aria-describedby', [...ids, id].join(' '));
    }
}

/** Takes only `id` out; the attribute goes when no id is left. */
export function removeDescribedBy(element: Element, id: string): void {
    const ids = idsOf(element);

    if (!ids.includes(id)) {
        return;
    }

    const rest = ids.filter((other) => other !== id);

    if (rest.length === 0) {
        element.removeAttribute('aria-describedby');
    } else {
        element.setAttribute('aria-describedby', rest.join(' '));
    }
}
