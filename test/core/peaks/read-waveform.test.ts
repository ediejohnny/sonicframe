/**
 * Reading a waveform file: the options (`maxPeaks` folding while reading, a channel), the
 * properties that hold for any file, and `loadWaveform` fetching one with a byte ceiling.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    loadWaveform,
    readWaveform,
} from '../../../src/core/peaks/read-waveform';
import type { Fetcher } from '../../../src/core/shared/fetch';
import { serve } from '../../support/responses';
import { dat, loudest, text } from './waveform-files';

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

/** A response that streams `bytes` in two pieces, the first one 7 bytes long. */
function respond(
    bytes: Uint8Array,
    options: { status?: number; length?: number; stream?: boolean } = {},
): Fetcher {
    return serve(bytes, { split: 7, ...options });
}

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
        const fetcher: Fetcher = (url) => {
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
        const fetcher: Fetcher = (url) => {
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
        const fetcher: Fetcher = () =>
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
        const fetcher: Fetcher = () =>
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
