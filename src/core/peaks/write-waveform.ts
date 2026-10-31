/**
 * Writing a waveform file from decoded samples, in the audiowaveform formats (version 2): the bytes
 * of a `.dat` file, or its JSON as an object. Nothing here touches the page.
 */

import { within } from '../shared/checked';
import { MAX_CHANNELS } from './waveform';

export type WriteWaveformOptions = {
    /** The samples' rate, per second. */
    sampleRate: number;
    /** Samples per point: 256 (audiowaveform's own default). */
    samplesPerPeak?: number;
    /** 16 (the default) or 8. */
    bits?: 8 | 16;
    /** `'dat'` (bytes, the default) or `'json'` (an object for `JSON.stringify`). */
    format?: 'dat' | 'json';
    /** `'mix'` (the default) writes one channel, the loudest of all; `'each'` writes every channel. */
    channels?: 'mix' | 'each';
};

/** The audiowaveform JSON, version 2. */
export type WaveformJson = {
    version: 2;
    channels: number;
    sample_rate: number;
    samples_per_pixel: number;
    bits: 8 | 16;
    length: number;
    /** Min/max pairs, interleaved by channel. */
    data: number[];
};

/** The largest value of the int32 fields of a `.dat` header. */
const MAX_INT32 = 2_147_483_647;

/** A sample from -1 to 1 as a whole number of the file's scale (128 or 32768), kept in range. */
function quantize(sample: number, scale: number): number {
    const value = Number.isFinite(sample) ? Math.round(sample * scale) : 0;

    return Math.min(scale - 1, Math.max(-scale, value));
}

/**
 * Writes a waveform file from decoded samples (the channels of an `AudioBuffer`, say, from -1 to 1),
 * in the audiowaveform formats, version 2: the bytes of a `.dat` file, or the JSON as an object.
 * Each point keeps the lowest and highest sample of its slice. Strange options fall back to their
 * defaults; a missing sample rate, no channels or channels of different lengths throw.
 */
export function writeWaveform(
    channels: readonly ArrayLike<number>[],
    options: WriteWaveformOptions & { format: 'json' },
): WaveformJson;
export function writeWaveform(
    channels: readonly ArrayLike<number>[],
    options: WriteWaveformOptions & { format?: 'dat' },
): Uint8Array;
export function writeWaveform(
    channels: readonly ArrayLike<number>[],
    options: WriteWaveformOptions,
): Uint8Array | WaveformJson;
export function writeWaveform(
    channels: readonly ArrayLike<number>[],
    options: WriteWaveformOptions,
): Uint8Array | WaveformJson {
    const rate = options.sampleRate;

    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
        throw new TypeError('sonicframe: writeWaveform needs a sample rate');
    }

    const sampleRate = Math.round(rate);

    if (sampleRate <= 0 || sampleRate > MAX_INT32) {
        throw new RangeError('sonicframe: impossible sample rate');
    }

    if (channels.length === 0 || channels.length > MAX_CHANNELS) {
        throw new RangeError(
            `sonicframe: writeWaveform needs 1 to ${MAX_CHANNELS} channels`,
        );
    }

    const samples = channels[0].length;

    if (channels.some((channel) => channel.length !== samples)) {
        throw new RangeError(
            'sonicframe: every channel must have the same length',
        );
    }

    const perPeak = within(
        options.samplesPerPeak,
        256,
        1,
        MAX_INT32,
        Math.floor,
    );
    const bits = options.bits === 8 ? 8 : 16;
    const scale = bits === 8 ? 128 : 32768;
    const each = options.channels === 'each';
    const groups: (readonly ArrayLike<number>[])[] = each
        ? channels.map((channel) => [channel])
        : [channels];
    const length = Math.ceil(samples / perPeak);
    const data = Array.from({ length: length * groups.length * 2 }, () => 0);

    for (let point = 0; point < length; point++) {
        const from = point * perPeak;
        const to = Math.min(samples, from + perPeak);

        groups.forEach((group, index) => {
            let low = Infinity;
            let high = -Infinity;

            for (const channel of group) {
                for (let i = from; i < to; i++) {
                    const sample = Number.isFinite(channel[i]) ? channel[i] : 0;
                    low = Math.min(low, sample);
                    high = Math.max(high, sample);
                }
            }

            const at = (point * groups.length + index) * 2;
            data[at] = quantize(low, scale);
            data[at + 1] = quantize(high, scale);
        });
    }

    if (options.format === 'json') {
        return {
            version: 2,
            channels: groups.length,
            sample_rate: sampleRate,
            samples_per_pixel: perPeak,
            bits,
            length,
            data,
        };
    }

    const width = bits === 8 ? 1 : 2;
    const bytes = new Uint8Array(24 + data.length * width);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, 2, true);
    view.setUint32(4, bits === 8 ? 1 : 0, true);
    view.setInt32(8, sampleRate, true);
    view.setInt32(12, perPeak, true);
    view.setUint32(16, length, true);
    view.setInt32(20, groups.length, true);

    data.forEach((value, index) => {
        if (bits === 8) {
            view.setInt8(24 + index, value);
        } else {
            view.setInt16(24 + index * 2, value, true);
        }
    });

    return bytes;
}
