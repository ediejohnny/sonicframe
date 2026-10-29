import { describe, expect, it } from 'vite-plus/test';
import { fft, fftMagnitudes } from '../src/core/fft';

describe('fft', () => {
    it('peaks at the bin of a pure tone', () => {
        const n = 64;
        const rate = 8000;
        const freq = 1000; // bin = 1000 * 64 / 8000 = 8
        const samples = Float64Array.from({ length: n }, (_, i) =>
            Math.sin((2 * Math.PI * freq * i) / rate),
        );

        const magnitudes = fftMagnitudes(samples);
        let peak = 0;

        for (let k = 1; k < magnitudes.length; k++) {
            if (magnitudes[k] > magnitudes[peak]) {
                peak = k;
            }
        }

        expect(peak).toBe(8);
    });

    it('refuses a length that is not a power of two', () => {
        expect(() => fft(new Float64Array(3), new Float64Array(3))).toThrow(
            /power of two/,
        );
    });

    it('leaves a constant signal all in bin 0', () => {
        const magnitudes = fftMagnitudes(new Float64Array(8).fill(1));

        expect(magnitudes[0]).toBeCloseTo(8, 5);
        for (let k = 1; k < magnitudes.length; k++) {
            expect(magnitudes[k]).toBeCloseTo(0, 5);
        }
    });
});
