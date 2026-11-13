/**
 * A text file fetched from an address (a list of tracks, a podcast feed): the address must pass
 * `safeUrl`, a failed request is refused with its status, and the bytes are read with a ceiling.
 * Cookies go only to the page's own site unless the app says otherwise.
 */

import { oneOf, within } from './checked';
import { fetchOk, readCapped, type FetchedResponse } from './fetch';
import { safeUrl } from './url';

export type LoadTextOptions = {
    /** Whether the request carries cookies: `'same-origin'` (the default, for any other value), `'omit'` or `'include'`. */
    credentials?: RequestCredentials;
    /** What the request tells the server of the page: the browser's default when left out. */
    referrerPolicy?: ReferrerPolicy;
    /** Stops the request. */
    signal?: AbortSignal;
    /** The app's own `fetch`, given the address alone. */
    fetcher?: (url: string) => Promise<FetchedResponse>;
    /** A larger file is refused; each loader says its default and its most. */
    maxBytes?: number;
};

/**
 * The text at `url` (a `what` file, at most `ceiling` bytes) and the address it was fetched from;
 * refused for an unsafe address, a failed request or a file too large.
 */
export async function loadText(
    url: string,
    options: LoadTextOptions,
    what: string,
    ceiling: number,
): Promise<{ text: string; url: string }> {
    const checked = safeUrl(url.trim());

    if (checked === null) {
        throw new TypeError(`sonicframe: the ${what} address is not allowed`);
    }

    const maxBytes = within(options.maxBytes, ceiling, 1, ceiling, Math.floor);
    const fetcher =
        options.fetcher ??
        ((address: string) =>
            fetch(address, {
                credentials: oneOf(
                    options.credentials,
                    ['same-origin', 'omit', 'include'] as const,
                    'same-origin',
                ),
                referrerPolicy: options.referrerPolicy,
                signal: options.signal,
            }));
    const response = await fetchOk(fetcher, checked, what);
    const bytes = await readCapped(
        response,
        maxBytes,
        () => new RangeError(`sonicframe: ${what} file is too large`),
    );

    return { text: new TextDecoder('utf-8').decode(bytes), url: checked };
}
