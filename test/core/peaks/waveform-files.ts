/**
 * Waveform files written by hand for the tests, from the published layouts, and the small oracle
 * of what reading one should give. The expected values come from here, never from the code
 * under test.
 */

export type DatFile = {
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
export function dat(file: DatFile): Uint8Array {
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
export function loudest(
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

export const text = (value: unknown): Uint8Array =>
    new TextEncoder().encode(JSON.stringify(value));
