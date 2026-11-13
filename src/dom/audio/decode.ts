/**
 * Decoding audio to mono samples for the peaks and the spectrogram, off the page's own `<audio>`.
 * The download is capped and read as a stream (stopping the moment it is too big, like
 * `loadPeaks`), decoding uses an `OfflineAudioContext` (which needs no user gesture), and a sound
 * longer than the length cap is read evenly through, with the rate of the samples given back. Both caps
 * are options with a most (see `core/shared/limits`).
 */

import { mixdown } from '../../core/analysis/analysis';
import { finiteOr } from '../../core/shared/checked';
import { readCapped } from '../../core/shared/fetch';
import { heldLimit, type Limit } from '../../core/shared/limits';

/**
 * The largest download decoded, in bytes: 50 MiB, up to 256 MiB. A decoded sound takes about 635 MB an
 * hour (two channels at 22 050 samples a second), and browser tabs fall over past a few GB.
 */
export const DECODE_BYTES: Limit = {
    value: 52_428_800,
    least: 1,
    most: 268_435_456,
    whole: true,
};
/** The most seconds of sound read; a longer sound is read evenly through: 30 minutes, up to 10 hours. */
export const DECODE_SECONDS: Limit = {
    value: 1800,
    least: 1,
    most: 36_000,
    whole: false,
};
/** A sound's bytes, downloaded from its address; the download stops as soon as they pass `maxBytes`. */
export async function fetchAudio(
    url: string,
    maxBytes: number,
    signal: AbortSignal | undefined,
): Promise<ArrayBuffer> {
    const response = await fetch(url, { signal });

    if (!response.ok) {
        throw new Error(
            `sonicframe: could not fetch audio (${response.status})`,
        );
    }

    const bytes = await readCapped(
        response,
        maxBytes,
        () => new Error('sonicframe: audio is too large to decode'),
    );

    return bytes.buffer;
}

/**
 * Fetches (or reads a blob) and decodes to mono samples; throws past the byte cap, and once
 * `signal` fires (the download stops at once; a decode cannot be cut short, so it is skipped).
 * `maxBytes` and `maxSeconds` go up to their most (past it, they are their most until 2.0; see
 * `heldLimit`). Past `maxSeconds`, the samples are picked evenly through the whole sound, and
 * `sampleRate` is theirs, not the file's; `duration` is always the whole sound's. The browser decodes
 * the whole file first, so `maxSeconds` saves no memory: `maxBytes` does.
 */
export async function decodeAudio(
    source: string | Blob,
    options: {
        maxBytes?: number;
        maxSeconds?: number;
        sampleRate?: number;
        signal?: AbortSignal;
    } = {},
): Promise<{ samples: Float32Array; sampleRate: number; duration: number }> {
    const maxBytes = heldLimit(options.maxBytes, DECODE_BYTES);
    const maxSeconds = heldLimit(options.maxSeconds, DECODE_SECONDS);
    const rate = finiteOr(options.sampleRate, 22050);
    let data: ArrayBuffer;

    if (typeof source === 'string') {
        data = await fetchAudio(source, maxBytes, options.signal);
    } else {
        if (source.size > maxBytes) {
            throw new Error('sonicframe: audio is too large to decode');
        }

        data = await source.arrayBuffer();
    }

    options.signal?.throwIfAborted();

    const Decoder = window.OfflineAudioContext;

    if (typeof Decoder !== 'function') {
        throw new Error('sonicframe: this browser has no audio decoder');
    }

    const context = new Decoder(1, Math.max(1, Math.round(rate)), rate);
    const buffer = await context.decodeAudioData(data);
    const cap = Math.min(
        buffer.length,
        Math.round(maxSeconds * buffer.sampleRate),
    );
    const samples = mixdown(buffer, cap);

    return {
        samples,
        sampleRate:
            cap < buffer.length && buffer.duration > 0
                ? samples.length / buffer.duration
                : buffer.sampleRate,
        duration: buffer.duration,
    };
}
