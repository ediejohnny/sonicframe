/**
 * Waveform files: the audiowaveform `.dat` and JSON formats and the simple peaks list, read from
 * bytes, text or parsed JSON (the format comes from the content), folded to `maxPeaks` while
 * reading, written back from decoded samples, and fetched with a byte ceiling. The expected values
 * are written by hand or come from the small oracles below, never from the code under test.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    loadWaveform,
    readWaveform,
    writeWaveform,
    type WaveformFetcher,
} from '../src/core/waveform';

type DatFile = {
    version?: 1 | 2;
    bits?: 8 | 16;
    sampleRate?: number;
    samplesPerPeak?: number;
    channels?: number;
    /** Min/max pairs, interleaved by channel: point 0 channel 0 min, max, point 0 channel 1 min… */
    data: readonly number[];
    /** The header's point count; the data's own count when left out. */
    length?: number;
};

/** A `.dat` file written byte by byte from the published layout. */
function dat(file: DatFile): Uint8Array {
    const version = file.version ?? 2;
    const bits = file.bits ?? 16;
    const channels = file.channels ?? 1;
    const header = version === 1 ? 20 : 24;
    const size = bits === 8 ? 1 : 2;
    const bytes = new Uint8Array(header + file.data.length * size);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, version, true);
    view.setUint32(4, bits === 8 ? 1 : 0, true);
    view.setInt32(8, file.sampleRate ?? 8000, true);
    view.setInt32(12, file.samplesPerPeak ?? 80, true);
    view.setUint32(16, file.length ?? file.data.length / (2 * channels), true);

    if (version === 2) {
        view.setInt32(20, channels, true);
    }

    file.data.forEach((value, index) => {
        if (bits === 8) {
            view.setInt8(header + index, value);
        } else {
            view.setInt16(header + index * 2, value, true);
        }
    });

    return bytes;
}

/** The loudest point of each pair, over every channel or one, scaled to 0..1. */
function loudest(
    data: readonly number[],
    channels: number,
    bits: 8 | 16,
    channel: number | 'all' = 'all',
): number[] {
    const scale = bits === 8 ? 128 : 32768;
    const points = data.length / (2 * channels);

    return Array.from({ length: points }, (_, point) => {
        let peak = 0;

        for (let c = 0; c < channels; c++) {
            if (channel === 'all' || channel === c) {
                const at = (point * channels + c) * 2;
                peak = Math.max(
                    peak,
                    Math.abs(data[at]),
                    Math.abs(data[at + 1]),
                );
            }
        }

        return Math.min(1, peak / scale);
    });
}

/** Point i lands in slice floor(i × count ÷ length); each slice keeps its loudest point. */
function fold(values: readonly number[], count: number): number[] {
    const length = values.length;
    const slices = Math.min(length, count);

    return Array.from({ length: slices }, (_, slice) =>
        values
            .filter((_, i) => Math.floor((i * slices) / length) === slice)
            .reduce((a, b) => Math.max(a, b), 0),
    );
}

function respond(
    bytes: Uint8Array,
    options: { status?: number; length?: number; stream?: boolean } = {},
): WaveformFetcher {
    const status = options.status ?? 200;

    return () =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
                get: (name: string) =>
                    name === 'content-length' && options.length !== undefined
                        ? String(options.length)
                        : null,
            },
            body:
                options.stream === false
                    ? null
                    : new ReadableStream<Uint8Array>({
                          start(controller) {
                              controller.enqueue(bytes.slice(0, 7));
                              controller.enqueue(bytes.slice(7));
                              controller.close();
                          },
                      }),
            arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
        });
}

const text = (value: unknown): Uint8Array =>
    new TextEncoder().encode(JSON.stringify(value));

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

describe('readWaveform: options', () => {
    const many = Array.from({ length: 20_001 }, (_, i) => (i % 7) / 7);

    it('keeps 20 000 peaks unless told otherwise, and takes a strange maxPeaks as that', () => {
        expect(readWaveform(many).peaks).toHaveLength(20_000);

        for (const maxPeaks of [NaN, Infinity, '5']) {
            expect(
                readWaveform(many, { maxPeaks: maxPeaks as number }).peaks,
            ).toHaveLength(20_000);
        }
    });

    it('rounds maxPeaks down and keeps it between 1 and 1 000 000', () => {
        expect(readWaveform(many, { maxPeaks: 2.9 }).peaks).toHaveLength(2);
        expect(readWaveform(many, { maxPeaks: 0 }).peaks).toEqual([6 / 7]);
        expect(readWaveform(many, { maxPeaks: -5 }).peaks).toEqual([6 / 7]);

        const huge = new Float64Array(1_000_001);
        expect(
            readWaveform(Array.from(huge), { maxPeaks: 5_000_000 }).peaks,
        ).toHaveLength(1_000_000);
    });

    it('keeps maxBytes between 1 byte and 64 MB, and takes a strange one as 8 MB', () => {
        const file = dat({ data: [0, 1] });

        expect(() => readWaveform(file, { maxBytes: 0 })).toThrow('too large');
        expect(readWaveform(file, { maxBytes: NaN }).peaks).toHaveLength(1);

        const big = new Uint8Array(64_000_001);
        expect(() => readWaveform(big, { maxBytes: 100_000_000 })).toThrow(
            'too large',
        );
        expect(() => readWaveform(new Uint8Array(8_000_001))).toThrow(
            'too large',
        );
    });
});

describe('readWaveform: properties', () => {
    it('ends any bytes in a reading or a TypeError or RangeError, never another failure', () => {
        const header = fc
            .tuple(
                fc.constantFrom(1, 2),
                fc.nat(3),
                fc.integer(),
                fc.integer(),
                fc.nat(),
                fc.integer({ min: -2, max: 40 }),
            )
            .chain(([version, flags, rate, per, length, channels]) =>
                fc.uint8Array({ maxLength: 200 }).map((rest) => {
                    const head = new Uint8Array(24);
                    const view = new DataView(head.buffer);
                    view.setInt32(0, version, true);
                    view.setUint32(4, flags, true);
                    view.setInt32(8, rate, true);
                    view.setInt32(12, per, true);
                    view.setUint32(16, length, true);
                    view.setInt32(20, channels, true);

                    return new Uint8Array([...head, ...rest]);
                }),
            );

        fc.assert(
            fc.property(
                fc.oneof(fc.uint8Array({ maxLength: 300 }), header),
                (bytes) => {
                    try {
                        const wave = readWaveform(bytes);
                        expect(wave.peaks.every((p) => p >= 0 && p <= 1)).toBe(
                            true,
                        );
                    } catch (error) {
                        expect(
                            error instanceof TypeError ||
                                error instanceof RangeError,
                        ).toBe(true);
                    }
                },
            ),
            { numRuns: 2000 },
        );
    });

    it('reads every well-formed .dat file to the loudest of each point, folded to maxPeaks', () => {
        const file = fc
            .record({
                version: fc.constantFrom<1 | 2>(1, 2),
                bits: fc.constantFrom<8 | 16>(8, 16),
                channels: fc.integer({ min: 1, max: 4 }),
                points: fc.nat(120),
                maxPeaks: fc.integer({ min: 1, max: 150 }),
            })
            .map((spec) => ({
                ...spec,
                channels: spec.version === 1 ? 1 : spec.channels,
            }))
            .chain((spec) =>
                fc
                    .array(
                        spec.bits === 8
                            ? fc.integer({ min: -128, max: 127 })
                            : fc.integer({ min: -32768, max: 32767 }),
                        {
                            minLength: spec.points * spec.channels * 2,
                            maxLength: spec.points * spec.channels * 2,
                        },
                    )
                    .map((data) => ({ ...spec, data })),
            );

        fc.assert(
            fc.property(file, (spec) => {
                const wave = readWaveform(dat(spec), {
                    maxPeaks: spec.maxPeaks,
                });
                const expected = fold(
                    loudest(spec.data, spec.channels, spec.bits),
                    spec.maxPeaks,
                );

                expect(wave.peaks).toEqual(expected);
                expect(wave.peaks.length).toBeLessThanOrEqual(spec.maxPeaks);
                expect(wave.duration).toBeCloseTo((spec.points * 80) / 8000, 9);
            }),
        );
    });

    it('folds any simple list to the same slices as the brute-force fold', () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
                    maxLength: 300,
                }),
                fc.integer({ min: 1, max: 400 }),
                (values, maxPeaks) => {
                    expect(readWaveform(values, { maxPeaks }).peaks).toEqual(
                        fold(values, maxPeaks),
                    );
                },
            ),
        );
    });
});

describe('writeWaveform', () => {
    it('writes a version 2 .dat file byte for byte', () => {
        const bytes = writeWaveform(
            [Float32Array.from([0.5, -0.25, 1, -1, 0])],
            {
                sampleRate: 4,
                samplesPerPeak: 2,
            },
        );
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

        expect(bytes.length).toBe(24 + 3 * 2 * 2);
        expect(
            [0, 4, 8, 12, 16, 20].map((at) => view.getInt32(at, true)),
        ).toEqual([2, 0, 4, 2, 3, 1]);
        expect(
            [0, 1, 2, 3, 4, 5].map((i) => view.getInt16(24 + i * 2, true)),
        ).toEqual([-8192, 16384, -32768, 32767, 0, 0]);
    });

    it('writes 8 bits with the flag set, and the audiowaveform JSON when asked', () => {
        const samples = [Float32Array.from([0.5, -0.25])];
        const bytes = writeWaveform(samples, {
            sampleRate: 100,
            samplesPerPeak: 2,
            bits: 8,
        });
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

        expect(view.getUint32(4, true)).toBe(1);
        expect([view.getInt8(24), view.getInt8(25)]).toEqual([-32, 64]);

        expect(
            writeWaveform(samples, {
                sampleRate: 100,
                samplesPerPeak: 2,
                bits: 8,
                format: 'json',
            }),
        ).toEqual({
            version: 2,
            channels: 1,
            sample_rate: 100,
            samples_per_pixel: 2,
            bits: 8,
            length: 1,
            data: [-32, 64],
        });
    });

    it('mixes the channels into the loudest one, or writes each when asked', () => {
        const left = Float32Array.from([0.5, -0.25]);
        const right = Float32Array.from([-0.75, 0.125]);
        const options = {
            sampleRate: 100,
            samplesPerPeak: 2,
            format: 'json',
        } as const;

        expect(writeWaveform([left, right], options)).toMatchObject({
            channels: 1,
            data: [-24576, 16384],
        });
        expect(
            writeWaveform([left, right], { ...options, channels: 'each' }),
        ).toMatchObject({
            channels: 2,
            data: [-8192, 16384, -24576, 4096],
        });
    });

    it('takes strange options as the defaults: 256 samples per peak, 16 bits, .dat, mixed', () => {
        const samples = [new Float32Array(600).fill(0.5)];
        const bytes = writeWaveform(samples, {
            sampleRate: 1000,
            samplesPerPeak: NaN,
            bits: 12 as 16,
            format: 'xml' as 'dat',
            channels: 'some' as 'mix',
        });
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(view.getUint32(4, true)).toBe(0);
        expect(view.getInt32(12, true)).toBe(256);
        expect(view.getUint32(16, true)).toBe(3);
    });

    it('refuses a missing sample rate, no channels, or channels of different lengths', () => {
        const one = new Float32Array(4);

        for (const sampleRate of [undefined, NaN, '8000']) {
            expect(() =>
                writeWaveform([one], { sampleRate: sampleRate as number }),
            ).toThrow(TypeError);
        }

        for (const sampleRate of [0, -1, 2 ** 31]) {
            expect(() => writeWaveform([one], { sampleRate })).toThrow(
                RangeError,
            );
        }

        expect(() => writeWaveform([], { sampleRate: 100 })).toThrow(
            RangeError,
        );
        expect(() =>
            writeWaveform([one, new Float32Array(5)], { sampleRate: 100 }),
        ).toThrow(RangeError);
    });

    it('reads back what it wrote: the loudest sample of each slice, to the nearest step', () => {
        const sound = fc
            .record({
                channels: fc.integer({ min: 1, max: 3 }),
                length: fc.nat(400),
                samplesPerPeak: fc.integer({ min: 1, max: 64 }),
                bits: fc.constantFrom<8 | 16>(8, 16),
                format: fc.constantFrom<'dat' | 'json'>('dat', 'json'),
                mix: fc.constantFrom<'mix' | 'each'>('mix', 'each'),
            })
            .chain((spec) =>
                fc
                    .array(
                        fc.float32Array({
                            min: -1,
                            max: 1,
                            noNaN: true,
                            minLength: spec.length,
                            maxLength: spec.length,
                        }),
                        { minLength: spec.channels, maxLength: spec.channels },
                    )
                    .map((samples) => ({ ...spec, samples })),
            );

        fc.assert(
            fc.property(sound, (spec) => {
                const written = writeWaveform(spec.samples, {
                    sampleRate: 8000,
                    samplesPerPeak: spec.samplesPerPeak,
                    bits: spec.bits,
                    format: spec.format,
                    channels: spec.mix,
                });
                const wave = readWaveform(written, { maxPeaks: 1_000_000 });
                const points = Math.ceil(spec.length / spec.samplesPerPeak);
                const step = 1 / (spec.bits === 8 ? 128 : 32768);

                expect(wave.peaks).toHaveLength(points);
                expect(wave.duration).toBeCloseTo(
                    (points * spec.samplesPerPeak) / 8000,
                    9,
                );

                for (let point = 0; point < points; point++) {
                    let expected = 0;

                    for (const channel of spec.samples) {
                        const from = point * spec.samplesPerPeak;
                        const to = Math.min(
                            spec.length,
                            from + spec.samplesPerPeak,
                        );

                        for (let i = from; i < to; i++) {
                            expected = Math.max(expected, Math.abs(channel[i]));
                        }
                    }

                    expect(
                        Math.abs(wave.peaks[point] - expected),
                    ).toBeLessThanOrEqual(step);
                }
            }),
        );
    });
});

describe('loadWaveform', () => {
    const file = dat({ data: [-16384, 8192, 0, 4096] });

    it('fetches a .dat file piece by piece and reads it', async () => {
        const wave = await loadWaveform('/a.dat', { fetcher: respond(file) });

        expect(wave.peaks).toEqual([0.5, 0.125]);
        expect(wave.format).toBe('dat');
    });

    it('reads the whole body when the response has no stream', async () => {
        const wave = await loadWaveform('/b.json', {
            fetcher: respond(text([0.25, 0.5]), { stream: false }),
        });

        expect(wave.peaks).toEqual([0.25, 0.5]);
    });

    it('fetches an address once for the same options, and again for other options', async () => {
        let calls = 0;
        const fetcher: WaveformFetcher = (url) => {
            calls++;

            return respond(file)(url);
        };

        const [a, b] = await Promise.all([
            loadWaveform('/shared.dat', { fetcher }),
            loadWaveform('/shared.dat', { fetcher }),
        ]);

        expect(b).toBe(a);
        expect(calls).toBe(1);

        await loadWaveform('/shared.dat', { fetcher, channel: 0 });
        expect(calls).toBe(2);
    });

    it('fetches every time when not shared', async () => {
        let calls = 0;
        const fetcher: WaveformFetcher = (url) => {
            calls++;

            return respond(file)(url);
        };

        await loadWaveform('/own.dat', { fetcher, shared: false });
        await loadWaveform('/own.dat', { fetcher, shared: false });
        expect(calls).toBe(2);
    });

    it('forgets a failed fetch so it can be tried again', async () => {
        await expect(
            loadWaveform('/retry.dat', {
                fetcher: respond(file, { status: 503 }),
            }),
        ).rejects.toThrow('503');
        await expect(
            loadWaveform('/retry.dat', { fetcher: respond(file) }),
        ).resolves.toMatchObject({ peaks: [0.5, 0.125] });
    });

    it('stops reading a file that grows past maxBytes, even when its size was not announced', async () => {
        let pulled = 0;
        const endless = new ReadableStream<Uint8Array>({
            pull(controller) {
                pulled++;
                controller.enqueue(new Uint8Array(1024));
            },
        });
        const fetcher: WaveformFetcher = () =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: endless,
                arrayBuffer: () =>
                    Promise.reject(new Error('read the stream instead')),
            });

        await expect(
            loadWaveform('/endless.dat', { fetcher, maxBytes: 10_000 }),
        ).rejects.toThrow('too large');
        expect(pulled).toBeLessThan(15);
    });

    it('refuses a file announced as too large before reading it', async () => {
        let read = false;
        const fetcher: WaveformFetcher = () =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => '9000000' },
                arrayBuffer: () => {
                    read = true;

                    return Promise.resolve(file.slice().buffer);
                },
            });

        await expect(loadWaveform('/huge.dat', { fetcher })).rejects.toThrow(
            RangeError,
        );
        expect(read).toBe(false);
    });
});
