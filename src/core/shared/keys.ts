/**
 * Shortcut keys the app chooses: one character each, matched without regard to case.
 */

/** A key name as one lower-case character, or null for none (a word such as "Enter" is no letter). */
export function keyLetter(
    key: string | false | undefined,
    fallback: string,
): string | null {
    if (key === false) {
        return null;
    }

    const chosen = key ?? fallback;

    return chosen.length === 1 ? chosen.toLowerCase() : null;
}
