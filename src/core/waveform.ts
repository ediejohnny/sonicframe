/**
 * Waveform files: the peaks of a sound computed ahead of time, by a server or by `writeWaveform`.
 * Reads the audiowaveform formats (the binary `.dat` and its JSON) and the simple peaks list,
 * finding the format in the content, never in the address. Writes the audiowaveform formats from
 * decoded samples. Nothing here touches the page.
 */

import { readCapped, type FetchedResponse } from './fetch';
import { clamp01 } from './math';
import { MAX_PEAKS, normalize as normalizePeaks } from './peaks';

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

/** The part of a `fetch` response that `loadWaveform` reads. */
export type WaveformResponse = FetchedResponse;

/** The part of `fetch` that `loadWaveform` uses, so tests and apps can bring their own. */
export type WaveformFetcher = (url: string) => Promise<WaveformResponse>;

export type LoadWaveformOptions = ReadWaveformOptions & {
    /** The same address with the same options is fetched once per page. On by default. */
    shared?: boolean;
    /** The app's own `fetch`. */
    fetcher?: WaveformFetcher;
};

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

const MAX_PEAKS_CEILING = 1_000_000;
/** In bytes. */
const DEFAULT_MAX_BYTES = 8_000_000;
/** In bytes. */
const MAX_BYTES_CEILING = 64_000_000;
const MAX_CHANNELS = 32;
/** The largest value of the int32 fields of a `.dat` header. */
const MAX_INT32 = 2_147_483_647;

type Settings = {
    maxPeaks: number;
    maxBytes: number;
    /** A channel number, or null for the loudest of all. */
    channel: number | null;
    normalize: boolean;
};

/** The header fields both audiowaveform formats share. */
type Header = {
    version: number;
    bits: number;
    sampleRate: number;
    samplesPerPeak: number;
    channels: number;
    length: number;
};

/** A whole number from `min` to `max` (rounded down); anything that is not a finite number is `fallback`. */
function bounded(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, Math.floor(value)))
        : fallback;
}

function settings(options: ReadWaveformOptions = {}): Settings {
    const channel = options.channel;

    return {
        maxPeaks: bounded(options.maxPeaks, MAX_PEAKS, 1, MAX_PEAKS_CEILING),
        maxBytes: bounded(
            options.maxBytes,
            DEFAULT_MAX_BYTES,
            1,
            MAX_BYTES_CEILING,
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

function tooLarge(): RangeError {
    return new RangeError('sonicframe: waveform file is too large');
}

function notWaveform(): TypeError {
    return new TypeError(
        'sonicframe: a waveform file is a .dat file, JSON or a list of numbers',
    );
}

function badHeader(field: string): RangeError {
    return new RangeError(
        `sonicframe: waveform file has an impossible ${field}`,
    );
}

/**
 * Point i of `length` lands in slice floor(i × count ÷ length), where count is at most `maxPeaks`;
 * each slice keeps its loudest point, so short sounds never vanish.
 */
function foldPoints(
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

/** Throws unless every header field is possible; the data's size is checked by each format. */
function checkHeader(header: Header): void {
    if (header.version !== 1 && header.version !== 2) {
        throw badHeader('version');
    }

    if (header.bits !== 8 && header.bits !== 16) {
        throw badHeader('bit depth');
    }

    if (!Number.isInteger(header.sampleRate) || header.sampleRate <= 0) {
        throw badHeader('sample rate');
    }

    if (
        !Number.isInteger(header.samplesPerPeak) ||
        header.samplesPerPeak <= 0
    ) {
        throw badHeader('number of samples per point');
    }

    if (
        !Number.isInteger(header.channels) ||
        header.channels < 1 ||
        header.channels > MAX_CHANNELS
    ) {
        throw badHeader('number of channels');
    }

    if (!Number.isInteger(header.length) || header.length < 0) {
        throw badHeader('length');
    }
}

/** The peaks of interleaved min/max pairs, then the rest of what the header says. */
function fromPairs(
    header: Header,
    format: 'dat' | 'json',
    value: (index: number) => number,
    options: Settings,
): WaveformData {
    const { channels, length } = header;
    const scale = header.bits === 8 ? 128 : 32768;
    const chosen =
        options.channel !== null && options.channel < channels
            ? options.channel
            : null;
    const first = chosen ?? 0;
    const last = chosen ?? channels - 1;
    const peaks = foldPoints(length, options.maxPeaks, (point) => {
        let loudest = 0;

        for (let channel = first; channel <= last; channel++) {
            const at = (point * channels + channel) * 2;
            loudest = Math.max(
                loudest,
                Math.abs(value(at)),
                Math.abs(value(at + 1)),
            );
        }

        return Math.min(1, loudest / scale);
    });

    return {
        peaks: options.normalize ? normalizePeaks(peaks) : peaks,
        duration: (length * header.samplesPerPeak) / header.sampleRate,
        sampleRate: header.sampleRate,
        samplesPerPeak: header.samplesPerPeak,
        channels,
        bits: header.bits === 8 ? 8 : 16,
        format,
    };
}

/** Whether the bytes start like a `.dat` file: a little-endian version 1 or 2. */
function isDat(bytes: Uint8Array): boolean {
    if (bytes.byteLength < 4) {
        return false;
    }

    const version = new DataView(bytes.buffer, bytes.byteOffset, 4).getInt32(
        0,
        true,
    );

    return version === 1 || version === 2;
}

/** The binary format: a little-endian header (20 bytes, or 24 with channels in version 2), then the pairs. */
function readDat(bytes: Uint8Array, options: Settings): WaveformData {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = view.getInt32(0, true);
    const size = version === 1 ? 20 : 24;

    if (bytes.byteLength < size) {
        throw badHeader('header');
    }

    const header: Header = {
        version,
        // Flag bit 0 set means 8-bit values; the other flags carry nothing read here.
        bits: (view.getUint32(4, true) & 1) === 1 ? 8 : 16,
        sampleRate: view.getInt32(8, true),
        samplesPerPeak: view.getInt32(12, true),
        length: view.getUint32(16, true),
        channels: version === 1 ? 1 : view.getInt32(20, true),
    };
    checkHeader(header);

    const width = header.bits === 8 ? 1 : 2;

    if (
        size + header.length * header.channels * 2 * width !==
        bytes.byteLength
    ) {
        throw badHeader('length');
    }

    return fromPairs(
        header,
        'dat',
        header.bits === 8
            ? (index) => view.getInt8(size + index)
            : (index) => view.getInt16(size + index * 2, true),
        options,
    );
}

/** A header field of the JSON: a finite number, or the file is not a waveform. */
function field(data: Record<string, unknown>, name: string): number {
    const value = data[name];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw notWaveform();
    }

    return value;
}

/** The audiowaveform JSON: the header's fields by name and `data`, the pairs. */
function readAudiowaveformJson(
    data: Record<string, unknown>,
    options: Settings,
): WaveformData {
    const version = field(data, 'version');
    const values = data.data;
    const header: Header = {
        version,
        bits: field(data, 'bits'),
        sampleRate: field(data, 'sample_rate'),
        samplesPerPeak: field(data, 'samples_per_pixel'),
        length: field(data, 'length'),
        channels: version === 1 ? 1 : field(data, 'channels'),
    };

    if (!Array.isArray(values)) {
        throw notWaveform();
    }

    checkHeader(header);

    if (values.length !== header.length * header.channels * 2) {
        throw badHeader('length');
    }

    const limit = header.bits === 8 ? 128 : 32768;

    for (const value of values as unknown[]) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw notWaveform();
        }

        if (value < -limit || value >= limit) {
            throw new RangeError('sonicframe: waveform value out of range');
        }
    }

    return fromPairs(
        header,
        'json',
        (index) => values[index] as number,
        options,
    );
}

/** A list of numbers, or `{ peaks, duration? }`; negative values count as their size, above 1 is 1. */
function readList(
    list: unknown,
    duration: unknown,
    options: Settings,
): WaveformData {
    if (!Array.isArray(list)) {
        throw notWaveform();
    }

    for (const value of list as unknown[]) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw notWaveform();
        }
    }

    if (
        duration !== undefined &&
        duration !== null &&
        (typeof duration !== 'number' || Number.isNaN(duration))
    ) {
        throw notWaveform();
    }

    if (
        typeof duration === 'number' &&
        !(duration > 0 && duration < Infinity)
    ) {
        throw new RangeError('sonicframe: waveform duration must be above 0');
    }

    const values = list as number[];
    const peaks = foldPoints(values.length, options.maxPeaks, (point) =>
        clamp01(Math.abs(values[point])),
    );

    return {
        peaks: options.normalize ? normalizePeaks(peaks) : peaks,
        duration: typeof duration === 'number' ? duration : null,
        sampleRate: null,
        samplesPerPeak: null,
        channels: 1,
        bits: null,
        format: 'list',
    };
}

function readParsed(data: unknown, options: Settings): WaveformData {
    if (Array.isArray(data)) {
        return readList(data, undefined, options);
    }

    if (data === null || typeof data !== 'object') {
        throw notWaveform();
    }

    const object = data as Record<string, unknown>;

    if ('data' in object) {
        return readAudiowaveformJson(object, options);
    }

    if ('peaks' in object) {
        return readList(object.peaks, object.duration, options);
    }

    throw notWaveform();
}

function parse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        throw notWaveform();
    }
}

function asBytes(input: unknown): Uint8Array | null {
    if (input instanceof ArrayBuffer) {
        return new Uint8Array(input);
    }

    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }

    return null;
}

function read(input: unknown, options: Settings): WaveformData {
    const bytes = asBytes(input);

    if (bytes !== null) {
        if (bytes.byteLength > options.maxBytes) {
            throw tooLarge();
        }

        return isDat(bytes)
            ? readDat(bytes, options)
            : readParsed(parse(new TextDecoder().decode(bytes)), options);
    }

    if (typeof input === 'string') {
        if (input.length > options.maxBytes) {
            throw tooLarge();
        }

        return readParsed(parse(input), options);
    }

    return readParsed(input, options);
}

/**
 * Reads a waveform file from its bytes (an `ArrayBuffer` or any view of one), its JSON text, or JSON
 * already parsed. The format comes from the content: bytes starting with version 1 or 2 are a `.dat`
 * file, anything else is JSON. A file that is not one, or whose data does not match its header,
 * throws a `TypeError` or a `RangeError`.
 */
export function readWaveform(
    input: unknown,
    options?: ReadWaveformOptions,
): WaveformData {
    return read(input, settings(options));
}

const loading = new Map<string, Promise<WaveformData>>();

/**
 * Fetches a waveform file and reads it (see `readWaveform`). Unless `shared` is false, an address
 * with the same options is fetched once per page however many frames show it; a failed fetch is
 * forgotten, so it can be tried again.
 */
export function loadWaveform(
    url: string,
    options: LoadWaveformOptions = {},
): Promise<WaveformData> {
    const resolved = settings(options);
    const fetcher = options.fetcher ?? ((address: string) => fetch(address));
    const load = (): Promise<WaveformData> =>
        fetcher(url).then(async (response) => {
            if (!response.ok) {
                throw new Error(
                    `sonicframe: waveform request failed (${response.status})`,
                );
            }

            return read(
                await readCapped(response, resolved.maxBytes, tooLarge),
                resolved,
            );
        });

    if (options.shared === false) {
        return load();
    }

    const key = JSON.stringify([
        url,
        resolved.maxPeaks,
        resolved.maxBytes,
        resolved.channel,
        resolved.normalize,
    ]);
    let pending = loading.get(key);

    if (!pending) {
        pending = load();
        pending.catch(() => loading.delete(key));
        loading.set(key, pending);
    }

    return pending;
}

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

    const perPeak = bounded(options.samplesPerPeak, 256, 1, MAX_INT32);
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
