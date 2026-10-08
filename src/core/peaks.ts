/**
 * Peaks are the loudest points of a sound, one per slice, as values from 0 to 1. A server usually
 * computes them once per file; a browser can compute them from audio it has decoded (a recording's
 * preview). Nothing here touches the page.
 */

import { clamp01 } from './math';

/** The most peaks accepted from a file: plenty for any screen, small enough to read quickly. */
export const MAX_PEAKS = 20_000;

/** A peaks file larger than this is refused, and reading it stops there (it is never parsed). */
const MAX_PEAKS_BYTES = 2_000_000;

/** The part of a `fetch` response that `loadPeaks` reads. */
export type PeaksResponse = {
    ok: boolean;
    status: number;
    headers?: { get(name: string): string | null };
    /** Read piece by piece, so an oversized file is dropped as soon as it passes the limit. */
    body?: ReadableStream<Uint8Array> | null;
    /** Used when there is no body stream. */
    text(): Promise<string>;
};

/** The part of `fetch` that `loadPeaks` uses, so tests and apps can bring their own. */
export type PeaksFetcher = (url: string) => Promise<PeaksResponse>;

function tooLarge(): RangeError {
    return new RangeError('sonicframe: peaks file is too large');
}

/** The response as text, refusing it once it passes `MAX_PEAKS_BYTES`. */
async function readCapped(response: PeaksResponse): Promise<string> {
    if (Number(response.headers?.get('content-length')) > MAX_PEAKS_BYTES) {
        throw tooLarge();
    }

    if (!response.body) {
        const text = await response.text();

        if (text.length > MAX_PEAKS_BYTES) {
            throw tooLarge();
        }

        return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let text = '';

    for (;;) {
        const { done, value } = await reader.read();

        if (done) {
            return text + decoder.decode();
        }

        size += value.byteLength;

        if (size > MAX_PEAKS_BYTES) {
            void reader.cancel();
            throw tooLarge();
        }

        text += decoder.decode(value, { stream: true });
    }
}

/**
 * Reads peaks out of parsed JSON: either a list of numbers or `{ "peaks": [...] }`. Anything else, a
 * value that is not a finite number, or more than `limit` values is refused. Negative values count as
 * their size and values above 1 are capped, so a list in -1..1 also works.
 */
export function readPeaks(data: unknown, limit: number = MAX_PEAKS): number[] {
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

const loading = new Map<string, Promise<number[]>>();

/**
 * Fetches a peaks file (see `readPeaks`). Each address is fetched once per page however many frames
 * show it; a failed fetch is forgotten, so it can be tried again.
 */
export function loadPeaks(
    url: string,
    fetcher: PeaksFetcher = (address) => fetch(address),
): Promise<number[]> {
    let pending = loading.get(url);

    if (!pending) {
        pending = fetcher(url).then(async (response) => {
            if (!response.ok) {
                throw new Error(
                    `sonicframe: peaks request failed (${response.status})`,
                );
            }

            return readPeaks(JSON.parse(await readCapped(response)));
        });
        pending.catch(() => loading.delete(url));
        loading.set(url, pending);
    }

    return pending;
}

/**
 * Fits peaks into `count` values. Folding keeps the loudest point of each slice, so short sounds
 * never vanish; stretching blends neighbours, so a short list does not turn into steps.
 */
export function resample(peaks: readonly number[], count: number): number[] {
    const length = peaks.length;
    const total = Math.floor(count);

    if (length === 0 || total <= 0) {
        return [];
    }

    if (total === length) {
        return [...peaks];
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
