/**
 * The audiowaveform formats, read through `readWaveform`: the `.dat` file (versions 1 and 2, 8 and
 * 16 bits, one or more channels) and the JSON, the format coming from the content.
 */

import { describe, expect, it } from 'vite-plus/test';
import { readWaveform } from '../../../src/core/peaks/read-waveform';
import { dat, text } from './waveform-files';

describe('readWaveform: the .dat file', () => {
    it('reads a version 1, 16-bit file: each pair becomes its larger size over 32768', () => {
        const wave = readWaveform(
            dat({
                version: 1,
                sampleRate: 8000,
                samplesPerPeak: 80,
                data: [-16384, 8192, -100, 32767, 0, 0],
            }),
        );

        expect(wave.peaks).toEqual([0.5, 32767 / 32768, 0]);
        expect(wave.duration).toBeCloseTo(0.03, 12);
        expect(wave).toMatchObject({
            format: 'dat',
            sampleRate: 8000,
            samplesPerPeak: 80,
            channels: 1,
            bits: 16,
        });
    });

    it('reads a version 2, 8-bit stereo file: the loudest channel, or the one asked for', () => {
        // Point 0: left -64..32, right -16..96. Point 1: left -128..0, right 0..32.
        const file = dat({
            version: 2,
            bits: 8,
            channels: 2,
            sampleRate: 44100,
            samplesPerPeak: 441,
            data: [-64, 32, -16, 96, -128, 0, 0, 32],
        });

        expect(readWaveform(file).peaks).toEqual([0.75, 1]);
        expect(readWaveform(file, { channel: 0 }).peaks).toEqual([0.5, 1]);
        expect(readWaveform(file, { channel: 1 }).peaks).toEqual([0.75, 0.25]);
        expect(readWaveform(file).duration).toBeCloseTo(0.02, 12);
        expect(readWaveform(file)).toMatchObject({ channels: 2, bits: 8 });
    });

    it('takes a channel it does not have, or a strange one, as every channel', () => {
        const file = dat({ channels: 2, data: [0, 1000, 0, 3000] });
        const all = readWaveform(file).peaks;

        expect(all).toEqual([3000 / 32768]);

        for (const channel of [2, -1, 0.5, NaN, 'left']) {
            expect(
                readWaveform(file, { channel: channel as number }).peaks,
            ).toEqual(all);
        }
    });

    it('reads the same bytes from an ArrayBuffer, a view into a larger buffer, or a DataView', () => {
        const file = dat({ data: [-16384, 8192, 0, 4096] });
        const larger = new Uint8Array(file.length + 9);
        larger.set(file, 5);
        const inside = larger.subarray(5, 5 + file.length);
        const expected = [0.5, 0.125];

        expect(readWaveform(file.slice().buffer).peaks).toEqual(expected);
        expect(readWaveform(inside).peaks).toEqual(expected);
        expect(
            readWaveform(new DataView(larger.buffer, 5, file.length)).peaks,
        ).toEqual(expected);
    });

    it('refuses a file cut short or with bytes left over', () => {
        const file = dat({ data: [0, 100, 0, 200] });

        expect(() => readWaveform(file.subarray(0, file.length - 1))).toThrow(
            RangeError,
        );
        expect(() => readWaveform(file.subarray(0, 22))).toThrow(RangeError);

        const longer = new Uint8Array(file.length + 2);
        longer.set(file);
        expect(() => readWaveform(longer)).toThrow(RangeError);
    });

    it('refuses a header with an impossible field', () => {
        for (const file of [
            dat({ sampleRate: 0, data: [0, 1] }),
            dat({ sampleRate: -8000, data: [0, 1] }),
            dat({ samplesPerPeak: 0, data: [0, 1] }),
            dat({ channels: 0, data: [] }),
            dat({ channels: 33, data: Array(66).fill(0) }),
            dat({ data: [0, 1], length: 4_000_000_000 }),
        ]) {
            expect(() => readWaveform(file)).toThrow(RangeError);
        }
    });

    it('folds a file with more points than maxPeaks, keeping the loudest of each slice', () => {
        // Ten points into four slices: 0-2, 3-4, 5-7, 8-9 (point i in slice floor(i × 4 ÷ 10)).
        const sizes = [100, 900, 200, 300, 800, 100, 0, 400, 500, 200];
        const wave = readWaveform(
            dat({ data: sizes.flatMap((size) => [-size, size / 2]) }),
            { maxPeaks: 4 },
        );

        expect(wave.peaks.map((peak) => peak * 32768)).toEqual([
            900, 800, 400, 500,
        ]);
        expect(wave.duration).toBeCloseTo((10 * 80) / 8000, 12);
        expect(wave.samplesPerPeak).toBe(80);
    });

    it('makes the loudest peak 1 when asked to normalize, and leaves silence silent', () => {
        expect(
            readWaveform(dat({ data: [-8192, 0, 0, 4096] }), {
                normalize: true,
            }).peaks,
        ).toEqual([1, 0.5]);
        expect(
            readWaveform(dat({ data: [0, 0, 0, 0] }), { normalize: true })
                .peaks,
        ).toEqual([0, 0]);
    });

    it('refuses bytes past maxBytes before reading them', () => {
        const file = dat({ data: Array(64).fill(1) });

        expect(() => readWaveform(file, { maxBytes: file.length - 1 })).toThrow(
            'too large',
        );
        expect(
            readWaveform(file, { maxBytes: file.length }).peaks,
        ).toHaveLength(32);
    });
});

describe('readWaveform: JSON', () => {
    const json = {
        version: 2,
        channels: 2,
        sample_rate: 44100,
        samples_per_pixel: 441,
        bits: 8,
        length: 2,
        data: [-64, 32, -16, 96, -128, 0, 0, 32],
    };

    it('reads the audiowaveform JSON like the .dat file with the same numbers', () => {
        const wave = readWaveform(json);

        expect(wave.peaks).toEqual([0.75, 1]);
        expect(wave.duration).toBeCloseTo(0.02, 12);
        expect(wave).toMatchObject({
            format: 'json',
            channels: 2,
            sampleRate: 44100,
            samplesPerPeak: 441,
            bits: 8,
        });
        expect(readWaveform(json, { channel: 1 }).peaks).toEqual([0.75, 0.25]);
    });

    it('reads version 1, which has no channels field, as one channel', () => {
        const wave = readWaveform({
            version: 1,
            sample_rate: 8000,
            samples_per_pixel: 80,
            bits: 16,
            length: 1,
            data: [-16384, 8192],
        });

        expect(wave.peaks).toEqual([0.5]);
        expect(wave.channels).toBe(1);
    });

    it('finds JSON in text and in bytes, with or without a byte order mark', () => {
        const encoded = text(json);
        const marked = new Uint8Array([0xef, 0xbb, 0xbf, ...encoded]);

        expect(readWaveform(JSON.stringify(json)).peaks).toEqual([0.75, 1]);
        expect(readWaveform(encoded).peaks).toEqual([0.75, 1]);
        expect(readWaveform(marked).peaks).toEqual([0.75, 1]);
    });

    it('refuses data that does not match its header, or a value out of range', () => {
        for (const bad of [
            { ...json, length: 3 },
            { ...json, data: json.data.slice(1) },
            { ...json, data: [...json.data, 0, 0, 0, 0] },
            { ...json, data: [...json.data.slice(1), 128] },
            { ...json, bits: 16, data: [...json.data.slice(1), -32769] },
            { ...json, bits: 12 },
            { ...json, sample_rate: 0 },
            { ...json, samples_per_pixel: -1 },
            { ...json, channels: 0 },
            { ...json, version: 3 },
        ]) {
            expect(() => readWaveform(bad)).toThrow(RangeError);
        }

        for (const bad of [
            { ...json, data: [...json.data.slice(1), '5'] },
            { ...json, data: [...json.data.slice(1), NaN] },
            { ...json, data: 'x' },
            { ...json, sample_rate: '44100' },
        ]) {
            expect(() => readWaveform(bad)).toThrow(TypeError);
        }
    });

    it('reads the simple list and { peaks, duration }, like readPeaks, folding instead of refusing', () => {
        const list = readWaveform([0.25, -0.75, 3]);

        expect(list.peaks).toEqual([0.25, 0.75, 1]);
        expect(list).toMatchObject({
            format: 'list',
            duration: null,
            sampleRate: null,
            samplesPerPeak: null,
            channels: 1,
            bits: null,
        });

        const object = readWaveform(
            { peaks: [0.1, 0.9, 0.2, 0.3], duration: 12 },
            {
                maxPeaks: 2,
            },
        );

        expect(object.peaks).toEqual([0.9, 0.3]);
        expect(object.duration).toBe(12);
    });

    it('refuses a simple list with something that is not a finite number, or a strange duration', () => {
        for (const bad of [
            [0.1, '2'],
            [Infinity],
            { peaks: 'x' },
            { peaks: [0.5], duration: '12' },
            {},
            null,
            42,
            'not json',
        ]) {
            expect(() => readWaveform(bad)).toThrow(TypeError);
        }

        expect(() => readWaveform({ peaks: [0.5], duration: -1 })).toThrow(
            RangeError,
        );
        expect(readWaveform({ peaks: [0.5], duration: null }).duration).toBe(
            null,
        );
    });
});
