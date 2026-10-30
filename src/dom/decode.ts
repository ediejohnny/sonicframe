/**
 * Decoding audio to mono samples for the peaks and the spectrogram, off the page's own `<audio>`.
 * The download is capped and read as a stream (stopping the moment it is too big, like
 * `loadPeaks`), decoding uses an `OfflineAudioContext` (which needs no user gesture), and a sound
 * longer than the length cap is read evenly through, with the rate of the samples given back.
 */

import { mixdown } from '../core/analysis';

/** The largest download decoded, in bytes (50 MiB). */
export const MAX_DECODE_BYTES = 52_428_800;
/** The most seconds of sound decoded; a longer sound is read evenly through (30 minutes). */
export const MAX_DECODE_SECONDS = 1800;

export async function readCapped(
    response: Response,
    maxBytes: number,
): Promise<ArrayBuffer> {
    const announced = Number(response.headers.get('content-length') ?? '0');

    if (announced > maxBytes) {
        throw new Error('sonicframe: audio is too large to decode');
    }

    const reader = response.body?.getReader();

    if (reader === undefined) {
        return response.arrayBuffer();
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        total += value.byteLength;

        if (total > maxBytes) {
            await reader.cancel();
            throw new Error('sonicframe: audio is too large to decode');
        }

        chunks.push(value);
    }

    const out = new Uint8Array(total);
    let at = 0;

    for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.byteLength;
    }

    return out.buffer;
}

/** A cap the app asks for, kept at or under SonicFrame's own. */
function lowered(value: number | undefined, ceiling: number): number {
    return typeof value === 'number' && value > 0
        ? Math.min(ceiling, value)
        : ceiling;
}

/**
 * Fetches (or reads a blob) and decodes to mono samples; throws past the byte cap, and once
 * `signal` fires (the download stops at once; a decode cannot be cut short, so it is skipped).
 * `maxBytes` and `maxSeconds` can only lower SonicFrame's caps. Past `maxSeconds`, the samples are
 * picked evenly through the whole sound, and `sampleRate` is theirs, not the file's; `duration` is
 * always the whole sound's.
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
    const maxBytes = lowered(options.maxBytes, MAX_DECODE_BYTES);
    const maxSeconds = lowered(options.maxSeconds, MAX_DECODE_SECONDS);
    const rate = options.sampleRate ?? 22050;
    let data: ArrayBuffer;

    if (typeof source === 'string') {
        const response = await fetch(source, { signal: options.signal });

        if (!response.ok) {
            throw new Error(
                `sonicframe: could not fetch audio (${response.status})`,
            );
        }

        data = await readCapped(response, maxBytes);
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
