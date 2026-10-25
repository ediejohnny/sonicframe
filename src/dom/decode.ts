/**
 * Decoding audio to mono samples for the spectrogram, off the page's own `<audio>`. The download is
 * capped and read as a stream (stopping the moment it is too big, like `loadPeaks`), decoding uses
 * an `OfflineAudioContext` (which needs no user gesture), and the result is trimmed to a safe length.
 */

import { mixdown } from '../core/analysis';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SECONDS = 30 * 60;

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

/** Fetches (or reads a blob) and decodes to mono samples; throws past the byte or length caps. */
export async function decodeAudio(
    source: string | Blob,
    options: { maxBytes?: number; sampleRate?: number } = {},
): Promise<{ samples: Float32Array; sampleRate: number }> {
    const maxBytes = options.maxBytes ?? MAX_BYTES;
    const rate = options.sampleRate ?? 22050;
    let data: ArrayBuffer;

    if (typeof source === 'string') {
        const response = await fetch(source);

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

    const Decoder = window.OfflineAudioContext;

    if (typeof Decoder !== 'function') {
        throw new Error('sonicframe: this browser has no audio decoder');
    }

    const context = new Decoder(1, Math.max(1, Math.round(rate)), rate);
    const buffer = await context.decodeAudioData(data);
    const cap = Math.min(
        buffer.length,
        Math.round(MAX_SECONDS * buffer.sampleRate),
    );

    return { samples: mixdown(buffer, cap), sampleRate: buffer.sampleRate };
}
