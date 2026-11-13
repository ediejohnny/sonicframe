/**
 * Peaks are the loudest points of a sound, one per slice, as values from 0 to 1. A server usually
 * computes them once per file; a browser can compute them from audio it has decoded (a recording's
 * preview). Nothing here touches the page.
 */

import {
    fetchOk,
    oncePerPage,
    readBody,
    readCapped,
    type Fetcher,
} from '../shared/fetch';
import { heldLimit, limitOf, type Limit } from '../shared/limits';
import { clamp01 } from '../shared/math';

/**
 * The most peaks accepted from a file: 20 000 (plenty for any screen, small enough to read quickly),
 * up to 1 000 000 (10 hours at about 27 a second).
 */
export const PEAKS_COUNT: Limit = {
    value: 20_000,
    least: 1,
    most: 1_000_000,
    whole: true,
};

/** The default of `PEAKS_COUNT`. */
export const MAX_PEAKS: number = PEAKS_COUNT.value;

/**
 * A peaks file larger than this is refused, and reading it stops there (it is never parsed): 2 MB,
 * up to 64 MB.
 */
export const PEAKS_BYTES: Limit = {
    value: 2_000_000,
    least: 1,
    most: 64_000_000,
    whole: true,
};

/** @deprecated The response of a `PeaksFetcher`; goes in 2.0 with it. */
export type PeaksResponse = {
    ok: boolean;
    status: number;
    headers?: { get(name: string): string | null };
    /** Read piece by piece, so an oversized file is dropped as soon as it passes the limit. */
    body?: ReadableStream<Uint8Array> | null;
    /** Used when there is no body stream. */
    text(): Promise<string>;
};

/** @deprecated Give `loadPeaks` a `Fetcher` as `{ fetcher }`; goes in 2.0. */
export type PeaksFetcher = (url: string) => Promise<PeaksResponse>;

function tooLarge(): RangeError {
    return new RangeError('sonicframe: peaks file is too large');
}

/** The response as text, refusing it once it passes the default of `PEAKS_BYTES`. */
async function readText(response: PeaksResponse): Promise<string> {
    const most = PEAKS_BYTES.value;

    if (Number(response.headers?.get('content-length')) > most) {
        throw tooLarge();
    }

    if (response.body) {
        return new TextDecoder().decode(
            await readBody(response.body, most, tooLarge),
        );
    }

    const text = await response.text();

    if (text.length > most) {
        throw tooLarge();
    }

    return text;
}

/**
 * Reads peaks out of parsed JSON: either a list of numbers or `{ "peaks": [...] }`. Anything else, a
 * value that is not a finite number, or more than `most` values is refused. Negative values count as
 * their size and values above 1 are capped, so a list in -1..1 also works. `most` is 20 000 unless
 * given, up to 1 000 000 (past it, 1 000 000 until 2.0; see `heldLimit`).
 */
export function readPeaks(
    data: unknown,
    most: number = PEAKS_COUNT.value,
): number[] {
    const limit = heldLimit(most, PEAKS_COUNT);
    const list: unknown = Array.isArray(data)
        ? data
        : data !== null && typeof data === 'object' && 'peaks' in data
          ? data.peaks
          : null;

    if (!Array.isArray(list)) {
        throw new TypeError('sonicframe: peaks must be a list of numbers');
    }

    if (list.length > limit) {
        throw new RangeError(
            `sonicframe: too many peaks (${list.length}, at most ${limit})`,
        );
    }

    return list.map((value: unknown) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new TypeError('sonicframe: peaks must be a list of numbers');
        }

        return clamp01(Math.abs(value));
    });
}

export type LoadPeaksOptions = {
    /** The same address is fetched once per page. On by default. */
    shared?: boolean;
    /** The app's own `fetch`. */
    fetcher?: Fetcher;
    /** The most peaks read: 20 000, from 1 to 1 000 000; past either end, a `RangeError`. */
    maxPeaks?: number;
    /** The largest file read, in bytes: 2 000 000, from 1 to 64 000 000; past either end, a `RangeError`. */
    maxBytes?: number;
};

const loading = new Map<string, Promise<number[]>>();

/**
 * Fetches a peaks file (see `readPeaks`). Unless `shared` is false, each address is fetched once per
 * page however many frames show it; a failed fetch is forgotten, so it can be tried again.
 */
export function loadPeaks(
    url: string,
    options?: LoadPeaksOptions,
): Promise<number[]>;
/** @deprecated Pass the fetcher as `{ fetcher }`; a fetcher in its place goes in 2.0. */
export function loadPeaks(
    url: string,
    fetcher: PeaksFetcher,
): Promise<number[]>;
export function loadPeaks(
    url: string,
    options: LoadPeaksOptions | PeaksFetcher = {},
): Promise<number[]> {
    if (typeof options === 'function') {
        return oncePerPage(loading, url, async () =>
            readPeaks(
                JSON.parse(
                    await readText(await fetchOk(options, url, 'peaks')),
                ),
            ),
        );
    }

    const fetcher = options.fetcher ?? ((address: string) => fetch(address));
    const load = async (): Promise<number[]> => {
        const maxPeaks = limitOf('maxPeaks', options.maxPeaks, PEAKS_COUNT);
        const maxBytes = limitOf('maxBytes', options.maxBytes, PEAKS_BYTES);
        const response = await fetchOk(fetcher, url, 'peaks');
        const bytes = await readCapped(response, maxBytes, tooLarge);

        return readPeaks(JSON.parse(new TextDecoder().decode(bytes)), maxPeaks);
    };

    return options.shared === false ? load() : oncePerPage(loading, url, load);
}

/**
 * Fits peaks into `count` values. Folding keeps the loudest point of each slice, so short sounds
 * never vanish; stretching blends neighbours, so a short list does not turn into steps.
 */
export function resample(peaks: ArrayLike<number>, count: number): number[] {
    const length = peaks.length;
    const total = Math.floor(count);

    if (length === 0 || total <= 0) {
        return [];
    }

    if (total === length) {
        return Array.from(peaks);
    }

    if (total > length) {
        return Array.from({ length: total }, (_, index) => {
            const position = (index * (length - 1)) / (total - 1);
            const left = Math.floor(position);
            const right = Math.min(length - 1, left + 1);

            return (
                peaks[left] + (peaks[right] - peaks[left]) * (position - left)
            );
        });
    }

    return Array.from({ length: total }, (_, index) => {
        const start = Math.floor((index * length) / total);
        const end = Math.floor(((index + 1) * length) / total);
        let loudest = 0;

        for (let i = start; i < end; i++) {
            loudest = Math.max(loudest, peaks[i]);
        }

        return loudest;
    });
}

/** Scales peaks so the loudest one is 1 (silence stays silence). */
export function normalize(peaks: readonly number[]): number[] {
    let loudest = 0;

    for (const peak of peaks) {
        loudest = Math.max(loudest, Math.abs(peak));
    }

    return peaks.map((peak) => (loudest === 0 ? 0 : Math.abs(peak) / loudest));
}

/**
 * Exactly `count` peaks of decoded samples (one channel of an `AudioBuffer`, say), normalized so the
 * loudest is 1.
 */
export function peaksFromChannel(
    channel: ArrayLike<number>,
    count: number,
): number[] {
    const length = channel.length;
    const total = Math.floor(count);

    if (length === 0 || total <= 0) {
        return [];
    }

    const peaks: number[] = [];

    for (let index = 0; index < total; index++) {
        const start = Math.floor((index * length) / total);
        const end = Math.max(
            start + 1,
            Math.floor(((index + 1) * length) / total),
        );
        let loudest = 0;

        for (let i = start; i < Math.min(end, length); i++) {
            loudest = Math.max(loudest, Math.abs(channel[i]));
        }

        peaks.push(loudest);
    }

    return normalize(peaks);
}
