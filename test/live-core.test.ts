import { describe, expect, it } from 'vite-plus/test';
import { frequencyBands } from '../src/core/bands';
import { canTapMedia } from '../src/core/origin';

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
