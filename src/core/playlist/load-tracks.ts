/**
 * A list of tracks fetched from an address (JSON or M3U) and read by `readTracks`, through `loadText`:
 * a checked address, a refused failure, a ceiling, and cookies only to the page's own site unless the
 * app says otherwise.
 */

import { heldLimit } from '../shared/limits';
import { loadText, type LoadTextOptions } from '../shared/load-text';
import { readTracks, TRACK_TEXT, type Track } from './tracks';

export type LoadTracksOptions = LoadTextOptions & {
    /**
     * The address relative addresses in the list point beside; the list's own address when that is
     * absolute (the playlist hands the page's resolved one).
     */
    base?: string;
    /** The most tracks kept: 1000, from 1 to 10 000 (see `readTracks`). */
    maxTracks?: number;
};

/**
 * The list's tracks at `url`; refused for an unsafe address, a failed request or a file too large:
 * 512 KB, or `maxBytes` up to 5 MB (it shipped able to take any, so past its most it is its most
 * until 2.0).
 */
export async function loadTracks(
    url: string,
    options: LoadTracksOptions = {},
): Promise<Track[]> {
    const maxBytes = heldLimit(options.maxBytes, TRACK_TEXT);
    const loaded = await loadText(url, options, 'tracks', maxBytes);

    return readTracks(loaded.text, {
        base:
            options.base ??
            (/^https?:/i.test(loaded.url) ? loaded.url : undefined),
        maxTracks: options.maxTracks,
        maxSize: maxBytes,
    });
}
