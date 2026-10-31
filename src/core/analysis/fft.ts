/**
 * A small radix-2 FFT, pure and dependency-free, for the spectrogram. It works in place on real and
 * imaginary arrays whose length is a power of two; the twiddle factors and the bit-reversal order
 * are cached per size, so repeated transforms of the same window size stay cheap.
 */

type Tables = { cos: Float64Array; sin: Float64Array; reversed: Uint32Array };

const cache = new Map<number, Tables>();

function isPowerOfTwo(n: number): boolean {
    return n >= 2 && (n & (n - 1)) === 0;
}

function tablesFor(n: number): Tables {
    const cached = cache.get(n);

    if (cached !== undefined) {
        return cached;
    }

    const cos = new Float64Array(n);
    const sin = new Float64Array(n);

    for (let i = 0; i < n; i++) {
        cos[i] = Math.cos((-2 * Math.PI * i) / n);
        sin[i] = Math.sin((-2 * Math.PI * i) / n);
    }

    const bits = Math.log2(n);
    const reversed = new Uint32Array(n);

    for (let i = 0; i < n; i++) {
        let value = i;
        let result = 0;

        for (let b = 0; b < bits; b++) {
            result = (result << 1) | (value & 1);
            value >>= 1;
        }

        reversed[i] = result;
    }

    const tables = { cos, sin, reversed };
    cache.set(n, tables);

    return tables;
}

/** In-place FFT; `re` and `im` must share a power-of-two length. */
export function fft(re: Float64Array, im: Float64Array): void {
    const n = re.length;

    if (!isPowerOfTwo(n)) {
        throw new Error('sonicframe: FFT length must be a power of two');
    }

    const { cos, sin, reversed } = tablesFor(n);

    for (let i = 0; i < n; i++) {
        const j = reversed[i];

        if (j > i) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }

    for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1;
        const step = n / size;

        for (let start = 0; start < n; start += size) {
            for (let k = 0; k < half; k++) {
                const twiddle = k * step;
                const c = cos[twiddle];
                const s = sin[twiddle];
                const a = start + k;
                const b = a + half;
                const reB = re[b] * c - im[b] * s;
                const imB = re[b] * s + im[b] * c;
                re[b] = re[a] - reB;
                im[b] = im[a] - imB;
                re[a] += reB;
                im[a] += imB;
            }
        }
    }
}

/** Magnitudes of the first half of the spectrum (bins 0..n/2) of real `samples`. */
export function fftMagnitudes(samples: Float64Array): Float64Array {
    const n = samples.length;
    const re = Float64Array.from(samples);
    const im = new Float64Array(n);
    fft(re, im);

    const out = new Float64Array(n / 2 + 1);

    for (let k = 0; k <= n / 2; k++) {
        out[k] = Math.hypot(re[k], im[k]);
    }

    return out;
}
