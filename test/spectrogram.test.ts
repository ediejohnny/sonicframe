import { describe, expect, it } from 'vite-plus/test';
import { buildColormap, colormap } from '../src/core/colormap';
import { createSpectrogram } from '../src/core/spectrogram';

describe('colormap', () => {
    it('builds a 256-entry RGB table', () => {
        expect(colormap('viridis')).toHaveLength(768);
    });

    it('runs gray from black to white', () => {
        const gray = colormap('gray');

        expect([gray[0], gray[1], gray[2]]).toEqual([0, 0, 0]);
        expect([gray[765], gray[766], gray[767]]).toEqual([255, 255, 255]);
    });

    it('interpolates between anchors', () => {
        const table = buildColormap([
            [0, 0, 0],
            [100, 0, 0],
        ]);

        expect(table[0]).toBe(0);
        expect(table[255 * 3]).toBe(100);
    });
});

describe('spectrogram', () => {
    const rate = 8000;
    const fftSize = 256;
    const rows = 128;
    const samples = Float32Array.from({ length: rate }, (_, i) =>
        Math.sin((2 * Math.PI * 1000 * i) / rate),
    );

    it('puts the energy of a 1kHz tone at the right frequency row', () => {
        const job = createSpectrogram(samples, rate, {
            fftSize,
            columns: 8,
            rows,
            scale: 'linear',
        });

        job.step(job.columns);
        expect(job.done).toBe(true);
        expect(job.data).toHaveLength(8 * rows);

        // Brightest row in a middle column, mapped back to a frequency.
        const column = 4;
        let best = 0;
        for (let row = 1; row < rows; row++) {
            if (job.data[row * 8 + column] > job.data[best * 8 + column]) {
                best = row;
            }
        }

        const bin = Math.round(
            ((rows - 1 - best) / (rows - 1)) * (fftSize / 2),
        );
        const freq = (bin / (fftSize / 2)) * (rate / 2);
        expect(freq).toBeGreaterThan(800);
        expect(freq).toBeLessThan(1200);
    });

    it('keeps the dimensions finite when given NaN (no infinite loop)', () => {
        const job = createSpectrogram(samples, rate, {
            columns: Number.NaN,
            rows: Number.NaN,
        });
        job.step(job.columns);

        expect(Number.isFinite(job.columns)).toBe(true);
        expect(Number.isFinite(job.rows)).toBe(true);
        expect(job.done).toBe(true);
    });

    it('caps the dimensions and the window size', () => {
        const job = createSpectrogram(samples, rate, {
            fftSize: 3,
            columns: 99999,
            rows: 99999,
        });

        expect(job.columns).toBeLessThanOrEqual(4096);
        expect(job.rows).toBeLessThanOrEqual(1024);
        expect(job.data).toHaveLength(job.columns * job.rows);
    });
});
