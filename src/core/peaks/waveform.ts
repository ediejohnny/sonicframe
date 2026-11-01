/**
 * Waveform files: the peaks of a sound computed ahead of time, by a server or by `writeWaveform`.
 * This is what reading and writing them share: a file read, the options and their limits, the
 * errors, and many points folded into the peaks kept. Nothing here touches the page.
 */

import { within } from '../shared/checked';
import { MAX_PEAKS } from './peaks';

/** `'dat'` and `'json'` are the audiowaveform formats; `'list'` is a list or `{ peaks }`. */
export type WaveformFormat = 'dat' | 'json' | 'list';

/** A waveform file read: its peaks and what the file says about the sound. */
export type WaveformData = {
    /** 0..1, the loudest point of each slice, at most `maxPeaks` of them. */
    readonly peaks: readonly number[];
    /** In seconds (the file's points × samples per point ÷ sample rate), or null when the file has none. */
    readonly duration: number | null;
    /** The sound's samples per second, or null for a list. */
    readonly sampleRate: number | null;
    /** Samples per point in the file (a folded peak covers several points), or null for a list. */
    readonly samplesPerPeak: number | null;
    /** The file's channels (the peaks are one of them, or the loudest of all). */
    readonly channels: number;
    /** 8 or 16, or null for a list. */
    readonly bits: 8 | 16 | null;
    readonly format: WaveformFormat;
};

export type ReadWaveformOptions = {
    /** The most peaks kept; a file with more points is folded while it is read. 20 000; 1 to 1 000 000. */
    maxPeaks?: number;
    /** A larger file is refused before it is read. 8 000 000 bytes; 1 to 64 000 000. */
    maxBytes?: number;
    /** `'all'` keeps the loudest of every channel; a channel number (from 0) keeps that one. */
    channel?: 'all' | number;
    /** Makes the loudest peak 1. */
    normalize?: boolean;
};

const MAX_PEAKS_CEILING = 1_000_000;
/** In bytes. */
const DEFAULT_MAX_BYTES = 8_000_000;
/** In bytes. */
const MAX_BYTES_CEILING = 64_000_000;
/** The most channels a waveform file has. */
export const MAX_CHANNELS = 32;

/** The read options, each kept in its range. */
export type Settings = {
    maxPeaks: number;
    maxBytes: number;
    /** A channel number, or null for the loudest of all. */
    channel: number | null;
    normalize: boolean;
};

export function settings(options: ReadWaveformOptions = {}): Settings {
    const channel = options.channel;

    return {
        maxPeaks: within(
            options.maxPeaks,
            MAX_PEAKS,
            1,
            MAX_PEAKS_CEILING,
            Math.floor,
        ),
        maxBytes: within(
            options.maxBytes,
            DEFAULT_MAX_BYTES,
            1,
            MAX_BYTES_CEILING,
            Math.floor,
        ),
        channel:
            typeof channel === 'number' &&
            Number.isInteger(channel) &&
            channel >= 0
                ? channel
                : null,
        normalize: options.normalize === true,
    };
}

export function tooLarge(): RangeError {
    return new RangeError('sonicframe: waveform file is too large');
}

export function notWaveform(): TypeError {
    return new TypeError(
        'sonicframe: a waveform file is a .dat file, JSON or a list of numbers',
    );
}

export function badHeader(field: string): RangeError {
    return new RangeError(
        `sonicframe: waveform file has an impossible ${field}`,
    );
}

/**
 * Point i of `length` lands in slice floor(i × count ÷ length), where count is at most `maxPeaks`;
 * each slice keeps its loudest point, so short sounds never vanish.
 */
export function foldPoints(
    length: number,
    maxPeaks: number,
    peakAt: (point: number) => number,
): number[] {
    const count = Math.min(length, maxPeaks);
    const peaks = Array.from({ length: count }, () => 0);

    for (let point = 0; point < length; point++) {
        const slice = Math.floor((point * count) / length);
        peaks[slice] = Math.max(peaks[slice], peakAt(point));
    }

    return peaks;
}
