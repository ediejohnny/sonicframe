/**
 * Writing a waveform file from decoded samples, checked by reading it back.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { readWaveform } from '../../../src/core/peaks/read-waveform';
import { writeWaveform } from '../../../src/core/peaks/write-waveform';

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
