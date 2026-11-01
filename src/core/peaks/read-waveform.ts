/**
 * Reading a waveform file, from its bytes, its text, JSON already parsed or its address. The format
 * comes from the content, never from the address: bytes that start like a `.dat` file are one, and
 * anything else is JSON, either the audiowaveform JSON or the simple peaks list. Nothing here
 * touches the page.
 */

import {
    fetchOk,
    oncePerPage,
    readCapped,
    type Fetcher,
} from '../shared/fetch';
import { clamp01 } from '../shared/math';
import { isDat, readAudiowaveformJson, readDat } from './audiowaveform';
import { normalize as normalizePeaks } from './peaks';
import {
    foldPoints,
    notWaveform,
    settings,
    tooLarge,
    type ReadWaveformOptions,
    type Settings,
    type WaveformData,
} from './waveform';

export type LoadWaveformOptions = ReadWaveformOptions & {
    /** The same address with the same options is fetched once per page. On by default. */
    shared?: boolean;
    /** The app's own `fetch`. */
    fetcher?: Fetcher;
};

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
    const load = async (): Promise<WaveformData> => {
        const response = await fetchOk(fetcher, url, 'waveform');

        return read(
            await readCapped(response, resolved.maxBytes, tooLarge),
            resolved,
        );
    };

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

    return oncePerPage(loading, key, load);
}
