/**
 * A speech-like sound made from numbers (no recording ships with the repository): syllables of a
 * voiced tone with a little breath, in word groups separated by pauses. Always the same sound.
 */

function random(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function wav(samples: Float32Array, rate: number): Blob {
    const data = new DataView(new ArrayBuffer(44 + samples.length * 2));
    const text = (offset: number, value: string): void => {
        for (let i = 0; i < value.length; i++) {
            data.setUint8(offset + i, value.charCodeAt(i));
        }
    };

    text(0, 'RIFF');
    data.setUint32(4, 36 + samples.length * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    data.setUint32(16, 16, true);
    data.setUint16(20, 1, true);
    data.setUint16(22, 1, true);
    data.setUint32(24, rate, true);
    data.setUint32(28, rate * 2, true);
    data.setUint16(32, 2, true);
    data.setUint16(34, 16, true);
    text(36, 'data');
    data.setUint32(40, samples.length * 2, true);

    samples.forEach((sample, index) => {
        const value = Math.max(-1, Math.min(1, sample));
        data.setInt16(44 + index * 2, value * 0x7fff, true);
    });

    return new Blob([data], { type: 'audio/wav' });
}

export function speechLike(
    seconds = 14,
    rate = 16_000,
): { samples: Float32Array; blob: Blob } {
    const next = random(7);
    const samples = new Float32Array(seconds * rate);
    let position = Math.round(0.3 * rate);
    let phase = 0;

    while (position < samples.length - rate * 0.4) {
        const syllables = 2 + Math.floor(next() * 6);

        for (let s = 0; s < syllables; s++) {
            const length = Math.round((0.09 + next() * 0.22) * rate);
            const pitch = 105 + next() * 95;
            const loudness = 0.25 + next() * 0.75;

            for (let i = 0; i < length && position + i < samples.length; i++) {
                const envelope = Math.sin((Math.PI * i) / length) ** 1.5;
                phase +=
                    (2 * Math.PI * pitch * (1 + 0.03 * Math.sin(i / 400))) /
                    rate;
                const voiced =
                    Math.sin(phase) +
                    0.5 * Math.sin(2 * phase) +
                    0.3 * Math.sin(3 * phase);
                const breath = 0.25 * (next() * 2 - 1);
                samples[position + i] =
                    (voiced + breath) * envelope * loudness * 0.32;
            }

            position += length + Math.round((0.02 + next() * 0.06) * rate);
        }

        position += Math.round((0.25 + next() * 0.45) * rate);
    }

    return { samples, blob: wav(samples, rate) };
}
