import { describe, expect, it } from 'vite-plus/test';
import { frequencyBands, MAX_BANDS } from '../../../src/core/analysis/bands';
import { canTapMedia } from '../../../src/core/analysis/origin';

describe('frequency bands', () => {
    it('puts energy in the band that covers the loud bin', () => {
        // 256 bins over a 22050Hz nyquist: ~86Hz per bin. A spike near 1000Hz is bin ~12.
        const spectrum = new Uint8Array(256);
        spectrum[12] = 255;

        const bands = frequencyBands(spectrum, 16, 44100);
        const loud = bands.findIndex((value) => value > 0.9);

        expect(loud).toBeGreaterThanOrEqual(0);
        expect(bands.filter((value) => value > 0.9)).toHaveLength(1);
    });

    it('returns zeros for an empty spectrum', () => {
        expect(frequencyBands(new Uint8Array(0), 8, 44100)).toEqual(
            Array.from({ length: 8 }, () => 0),
        );
    });

    it('never makes more than MAX_BANDS bands, however many are asked for', () => {
        expect(
            frequencyBands(new Uint8Array(256), 100_000, 44100),
        ).toHaveLength(MAX_BANDS);
        expect(frequencyBands(new Uint8Array(0), 100_000, 44100)).toHaveLength(
            MAX_BANDS,
        );
    });

    it('reads from 40 Hz to 16 kHz when minHz or maxHz is not a number', () => {
        // ~86 Hz per bin: bin 0 is under 100 Hz, bin 180 near 15.5 kHz. Four bands from 40 Hz to
        // 16 kHz run 40-179, 179-800, 800-3578 and 3578-16000 Hz.
        const low = new Uint8Array(256);
        low[0] = 255;
        const high = new Uint8Array(256);
        high[180] = 255;

        for (const odd of [Number.NaN, '1000' as unknown as number]) {
            expect(frequencyBands(low, 4, 44100, { minHz: odd })).toEqual([
                1, 0, 0, 0,
            ]);
            expect(frequencyBands(high, 4, 44100, { maxHz: odd })).toEqual([
                0, 0, 0, 1,
            ]);
        }
    });
});

describe('tapping media', () => {
    const page = 'https://example.com';

    it('taps same-origin, blob and data sources', () => {
        expect(
            canTapMedia({
                src: 'https://example.com/a.mp3',
                crossOrigin: null,
                pageOrigin: page,
            }),
        ).toBe(true);
        expect(
            canTapMedia({
                src: 'blob:abc',
                crossOrigin: null,
                pageOrigin: page,
            }),
        ).toBe(true);
        expect(
            canTapMedia({
                src: 'data:audio/mp3;base64,AA',
                crossOrigin: null,
                pageOrigin: page,
            }),
        ).toBe(true);
    });

    it('refuses a cross-origin source without crossOrigin', () => {
        expect(
            canTapMedia({
                src: 'https://cdn.other.com/a.mp3',
                crossOrigin: null,
                pageOrigin: page,
            }),
        ).toBe(false);
    });

    it('allows a cross-origin source that set crossOrigin', () => {
        expect(
            canTapMedia({
                src: 'https://cdn.other.com/a.mp3',
                crossOrigin: 'anonymous',
                pageOrigin: page,
            }),
        ).toBe(true);
    });
});
