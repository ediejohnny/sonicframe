/**
 * Keeps the keyboard focus on the same part when a piece of SonicFrame is built again: the part
 * holding the focus is named by its `sonicframe-` class, and the part of that class in the new build
 * takes the focus back, so a keyboard or screen reader user never falls to the page's top.
 */

/**
 * The class that names the part of `root` holding the keyboard focus (`sonicframe-next-track`, say),
 * or null when the focus is elsewhere. A focused part with no class of its own gives `fallback`.
 */
export function focusedClass(root: Element, fallback: string): string | null {
    const active = document.activeElement;

    if (!(active instanceof HTMLElement) || !root.contains(active)) {
        return null;
    }

    return (
        [...active.classList].find((name) => name.startsWith('sonicframe-')) ??
        fallback
    );
}

/** Focuses the first part of `root` with the class `name`, or with `fallback`; nothing when there is none. */
export function focusClass(
    root: Element,
    name: string,
    fallback: string,
): void {
    // Looked up by class, never as a selector: a class name is no selector syntax.
    const [part] = [
        ...root.getElementsByClassName(name),
        ...root.getElementsByClassName(fallback),
    ];

    if (part instanceof HTMLElement) {
        part.focus({ preventScroll: true });
    }
}
