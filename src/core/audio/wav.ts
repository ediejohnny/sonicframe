/**
 * A WAV (RIFF, or RF64 past 4 GB) file read as it arrives: the `fmt ` chunk says the sample format,
 * and the `data` chunk's samples come out mixed to one channel, needing no decoder. Integer PCM of 8,
 * 16, 24 and 32 bits and floats of 32 and 64 bits are read, also as WAVE_FORMAT_EXTENSIBLE; other
 * codings (ADPCM, µ-law) are not. A data size of 0 or 0xFFFFFFFF reads to the end of the file.
 */

import { ByteQueue } from './byte-queue';
import { notFormat } from './frames';

/** The sound's format, known once the `data` chunk starts. */
export type PcmFormat = {
    readonly sampleRate: number;
    readonly channels: number;
    /** Samples per channel in the whole sound, when the data chunk says its size. */
    readonly totalSamples?: number;
};

/** A reader giving samples, not frames. */
export type PcmReader = {
    readonly kind: 'pcm';
    readonly format: PcmFormat | null;
    /** Takes the next bytes and gives the samples they complete, mixed to one channel. */
    push(bytes: Uint8Array): Float32Array;
};

/** The largest `fmt ` chunk read: 1 KiB (the extensible one takes 40 bytes). */
const MOST_FORMAT_BYTES = 1024;

/** The most channels read. */
const MOST_CHANNELS = 32;

type Coding = { readonly float: boolean; readonly bits: number };

/** A sample of `coding` at `at`, from -1 to 1. */
function sample(view: DataView, at: number, coding: Coding): number {
    if (coding.float) {
        return coding.bits === 32
            ? view.getFloat32(at, true)
            : view.getFloat64(at, true);
    }

    switch (coding.bits) {
        case 8:
            return (view.getUint8(at) - 128) / 128;
        case 16:
            return view.getInt16(at, true) / 32768;
        case 24:
            return (
                (view.getUint8(at) |
                    (view.getUint8(at + 1) << 8) |
                    (view.getInt8(at + 2) << 16)) /
                8388608
            );
        default:
            return view.getInt32(at, true) / 2147483648;
    }
}

/** The coding a `fmt ` chunk names, or null when it is not one read here. */
function codingOf(chunk: DataView): Coding | null {
    let code = chunk.getUint16(0, true);
    const bits = chunk.getUint16(14, true);

    if (code === 0xfffe && chunk.byteLength >= 26) {
        code = chunk.getUint16(24, true);
    }

    if (code === 1 && [8, 16, 24, 32].includes(bits)) {
        return { float: false, bits };
    }

    return code === 3 && (bits === 32 || bits === 64)
        ? { float: true, bits }
        : null;
}

/** A 4-letter chunk name. */
function nameAt(bytes: Uint8Array, at: number): string {
    return String.fromCharCode(...bytes.subarray(at, at + 4));
}

export function createWavReader(): PcmReader {
    const queue = new ByteQueue();
    let format: PcmFormat | null = null;
    let coding: Coding | null = null;
    let channels = 0;
    let rate = 0;
    let block = 0;
    let started = false;
    let left = 0;

    /** Reads chunk headers until the samples start; false while more bytes are needed. */
    const header = (): boolean => {
        if (!started) {
            if (queue.length < 12) {
                return false;
            }

            const head = queue.take(12);
            const riff = nameAt(head, 0);

            if (
                (riff !== 'RIFF' && riff !== 'RF64') ||
                nameAt(head, 8) !== 'WAVE'
            ) {
                throw notFormat('WAV');
            }

            started = true;
        }

        while (format === null) {
            if (queue.length < 8) {
                return false;
            }

            const head = queue.view();
            const name = nameAt(head, 0);
            const size = new DataView(
                head.buffer,
                head.byteOffset,
                8,
            ).getUint32(4, true);

            if (name === 'data') {
                if (coding === null) {
                    throw notFormat('WAV');
                }

                queue.skip(8);
                const known = size > 0 && size < 0xffffffff;
                left = known ? size - (size % block) : Infinity;
                format = {
                    sampleRate: rate,
                    channels,
                    ...(known ? { totalSamples: left / block } : {}),
                };
            } else if (name === 'fmt ') {
                if (size < 16 || size > MOST_FORMAT_BYTES) {
                    throw notFormat('WAV');
                }

                if (queue.length < 8 + size + (size % 2)) {
                    return false;
                }

                queue.skip(8);
                const chunk = queue.take(size + (size % 2));
                const view = new DataView(chunk.buffer, 0, size);
                coding = codingOf(view);
                channels = view.getUint16(2, true);
                rate = view.getUint32(4, true);
                block = (channels * (coding?.bits ?? 0)) / 8;

                if (
                    coding === null ||
                    channels < 1 ||
                    channels > MOST_CHANNELS ||
                    rate < 1
                ) {
                    throw notFormat('a WAV sound read here');
                }
            } else {
                queue.skip(8 + size + (size % 2));
            }
        }

        return true;
    };

    return {
        kind: 'pcm',
        get format(): PcmFormat | null {
            return format;
        },
        push(bytes: Uint8Array): Float32Array {
            queue.push(bytes);

            if (!header() || coding === null) {
                return new Float32Array(0);
            }

            if (left === 0) {
                queue.skip(queue.length);

                return new Float32Array(0);
            }

            const count = Math.floor(Math.min(queue.length, left) / block);
            const data = queue.take(count * block);
            const view = new DataView(data.buffer);
            const width = coding.bits / 8;
            const samples = new Float32Array(count);
            left -= count * block;

            for (let frame = 0; frame < count; frame++) {
                let sum = 0;

                for (let channel = 0; channel < channels; channel++) {
                    sum += sample(
                        view,
                        frame * block + channel * width,
                        coding,
                    );
                }

                samples[frame] = sum / channels;
            }

            return samples;
        },
    };
}
