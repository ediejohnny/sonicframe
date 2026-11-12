/**
 * A list of tracks fetched from an address (JSON or M3U) and read by `readTracks`, through `loadText`:
 * a checked address, a refused failure, a ceiling, and cookies only to the page's own site unless the
 * app says otherwise.
 */

import { loadText, type LoadTextOptions } from '../shared/load-text';
import { readTracks, type Track } from './tracks';

export type LoadTracksOptions = LoadTextOptions & {
    /**
     * The address relative addresses in the list point beside; the list's own address when that is
     * absolute (the playlist hands the page's resolved one).
     */
    base?: string;
};

/** The largest list fetched, in bytes (512 KB). */
const MAX_BYTES = 524_288;

/** The list's tracks at `url`; refused for an unsafe address, a failed request or a file too large. */
export async function loadTracks(
    url: string,
    options: LoadTracksOptions = {},
): Promise<Track[]> {
    const loaded = await loadText(url, options, 'tracks', MAX_BYTES);

    return readTracks(loaded.text, {
        base:
            options.base ??
            (/^https?:/i.test(loaded.url) ? loaded.url : undefined),
    });
}
