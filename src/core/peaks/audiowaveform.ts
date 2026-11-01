/**
 * The audiowaveform formats read: the binary `.dat` file and its JSON. Both carry the same header,
 * whose every field is checked, then min/max pairs interleaved by channel, folded into the peaks
 * kept. Nothing here touches the page.
 */

import { normalize as normalizePeaks } from './peaks';
import {
    badHeader,
    foldPoints,
    MAX_CHANNELS,
    notWaveform,
    type Settings,
    type WaveformData,
} from './waveform';

/** The header fields both audiowaveform formats share. */
type Header = {
    version: number;
    bits: number;
    sampleRate: number;
    samplesPerPeak: number;
    channels: number;
    length: number;
};

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
export function isDat(bytes: Uint8Array): boolean {
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
export function readDat(bytes: Uint8Array, options: Settings): WaveformData {
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
export function readAudiowaveformJson(
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
