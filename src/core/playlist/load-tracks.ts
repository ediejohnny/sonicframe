/**
 * A list of tracks fetched from an address (JSON or M3U) and read by `readTracks`: the address must
 * pass `safeUrl`, a failed request is refused with its status, and the text is read with a ceiling.
 * Cookies go only to the page's own site unless the app says otherwise.
 */

import { fetchOk, readCapped, type FetchedResponse } from '../shared/fetch';
import { oneOf, within } from '../shared/checked';
import { safeUrl } from '../shared/url';
import { readTracks, type Track } from './tracks';

export type LoadTracksOptions = {
    /**
     * The address relative addresses in the list point beside; the list's own address when that is
     * absolute (the playlist hands the page's resolved one).
     */
    base?: string;
    /** Whether the request carries cookies: `'same-origin'` (the default, for any other value), `'omit'` or `'include'`. */
    credentials?: RequestCredentials;
    /** What the request tells the server of the page: the browser's default when left out. */
    referrerPolicy?: ReferrerPolicy;
    /** Stops the request (a playlist destroyed). */
    signal?: AbortSignal;
    /** The app's own `fetch`, given the address alone. */
    fetcher?: (url: string) => Promise<FetchedResponse>;
    /** A larger file is refused. Only lowers 524 288 bytes. */
    maxBytes?: number;
};

/** The largest list fetched, in bytes (512 KB). */
const MAX_BYTES = 524_288;

/** The list's tracks at `url`; refused for an unsafe address, a failed request or a file too large. */
export async function loadTracks(
    url: string,
    options: LoadTracksOptions = {},
): Promise<Track[]> {
    const checked = safeUrl(url.trim());

    if (checked === null) {
        throw new TypeError('sonicframe: the tracks address is not allowed');
    }

    const maxBytes = within(
        options.maxBytes,
        MAX_BYTES,
        1,
        MAX_BYTES,
        Math.floor,
    );
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
    const response = await fetchOk(fetcher, checked, 'tracks');
    const bytes = await readCapped(
        response,
        maxBytes,
        () => new RangeError('sonicframe: tracks file is too large'),
    );

    return readTracks(new TextDecoder('utf-8').decode(bytes), {
        base: options.base ?? (/^https?:/i.test(checked) ? checked : undefined),
    });
}
