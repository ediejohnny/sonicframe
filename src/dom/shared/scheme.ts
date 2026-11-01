/** The system's light or dark preference, as the page's media queries see it. */

const DARK = '(prefers-color-scheme: dark)';

/** Whether the system asks for dark colors now; false where the page cannot tell. */
export function prefersDark(): boolean {
    return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia(DARK).matches
    );
}

/**
 * Calls `changed` with whether the system asks for dark colors each time that changes, and returns
 * the function that stops listening. Where the page cannot tell, it never calls.
 */
export function onSchemeChange(changed: (dark: boolean) => void): () => void {
    if (typeof window.matchMedia !== 'function') {
        return () => undefined;
    }

    const query = window.matchMedia(DARK);
    const listener = (): void => changed(query.matches);
    query.addEventListener('change', listener);

    return () => query.removeEventListener('change', listener);
}
