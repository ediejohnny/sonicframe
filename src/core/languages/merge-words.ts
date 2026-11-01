/** The app's own words over the built-in ones, so every piece takes them the same way. */

import { cleanText } from '../shared/text';

/**
 * The built-in words with the app's own laid over them, each cleaned to one safe line of at most
 * `max` characters. Only the built-in names count, and only strings: anything else keeps the word.
 */
export function mergeWords<T extends Record<string, string>>(
    base: Readonly<T>,
    own: Partial<T> | undefined,
    max: number,
): T {
    const given: Readonly<Record<string, unknown>> = own ?? {};
    const merged: Record<string, string> = { ...base };

    for (const key of Object.keys(base)) {
        const value = given[key];

        if (typeof value === 'string') {
            merged[key] = cleanText(value, max);
        }
    }

    return merged as T;
}
