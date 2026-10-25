/**
 * Turning samples into a spectrogram, pure and resumable so the page can compute it a slice at a
 * time without freezing. `createSpectrogram` returns a job; `step` advances a few columns and fills
 * a byte-per-cell intensity image (0..255), which the drawing side maps through a color map. Every
 * dimension is capped, so neither memory nor time can run away.
 */

import { fft } from './fft';

const MIN_FFT = 32;
const MAX_FFT = 8192;
const MAX_COLUMNS = 4096;
const MAX_ROWS = 1024;

export type SpectrogramOptions = {
    /** Window size (a power of two, 32..8192). */
    fftSize?: number;
    /** Columns across (time). */
    columns?: number;
    /** Rows down (frequency). */
    rows?: number;
    /** Decibels mapped to black and to the brightest color. */
    minDb?: number;
    maxDb?: number;
    /** Spread rows evenly over frequency (`linear`) or over octaves (`log`). */
    scale?: 'linear' | 'log';
};

export type SpectrogramJob = {
    readonly columns: number;
    readonly rows: number;
    readonly sampleRate: number;
    /** Row-major intensity bytes, `columns * rows` of them (row 0 is the highest frequency). */
    readonly data: Uint8Array;
    readonly done: boolean;
    /** Computes up to `maxColumns` more columns. */
    step(maxColumns: number): void;
};

function toPowerOfTwo(value: number): number {
    let size = MIN_FFT;

    while (size < value && size < MAX_FFT) {
        size <<= 1;
    }

    return Math.min(MAX_FFT, Math.max(MIN_FFT, size));
}

function hann(size: number): Float64Array {
    const weights = new Float64Array(size);

    for (let i = 0; i < size; i++) {
        weights[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }

    return weights;
}

export function createSpectrogram(
    samples: ArrayLike<number>,
    sampleRate: number,
    options: SpectrogramOptions = {},
): SpectrogramJob {
    const fftSize = toPowerOfTwo(options.fftSize ?? 1024);
    const columns = Math.max(1, Math.min(MAX_COLUMNS, options.columns ?? 512));
    const rows = Math.max(1, Math.min(MAX_ROWS, options.rows ?? 256));
    const minDb = options.minDb ?? -90;
    const maxDb = options.maxDb ?? -20;
    const logScale = options.scale === 'log';
    const bins = fftSize / 2;

    const windowFn = hann(fftSize);
    const data = new Uint8Array(columns * rows);
    const hop = Math.max(
        1,
        (samples.length - fftSize) / Math.max(1, columns - 1),
    );

    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    let column = 0;

    // Imported lazily to keep this module's own graph tiny; both are pure core.
    const rowBin = (row: number): number => {
        const up = (rows - 1 - row) / Math.max(1, rows - 1);

        return logScale
            ? Math.round(2 ** (up * Math.log2(bins + 1)) - 1)
            : Math.round(up * bins);
    };

    function computeColumn(index: number): void {
        const start = Math.floor(index * hop);

        for (let i = 0; i < fftSize; i++) {
            re[i] = (samples[start + i] ?? 0) * windowFn[i];
            im[i] = 0;
        }

        fft(re, im);

        for (let row = 0; row < rows; row++) {
            const bin = Math.min(bins, rowBin(row));
            const magnitude = Math.hypot(re[bin], im[bin]) / bins;
            const db = magnitude > 0 ? 20 * Math.log10(magnitude) : minDb;
            const level = (db - minDb) / Math.max(1e-6, maxDb - minDb);
            data[row * columns + index] = Math.max(
                0,
                Math.min(255, Math.round(level * 255)),
            );
        }
    }

    return {
        columns,
        rows,
        sampleRate,
        data,
        get done(): boolean {
            return column >= columns;
        },
        step(maxColumns: number): void {
            const until = Math.min(columns, column + Math.max(1, maxColumns));

            for (; column < until; column++) {
                computeColumn(column);
            }
        },
    };
}
