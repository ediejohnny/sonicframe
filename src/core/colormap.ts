/**
 * Color maps for the spectrogram: a 256-entry lookup table (red, green, blue bytes) built by
 * interpolating a few anchor colors. Pure, so the table is the same everywhere; the bytes only ever
 * land in an `ImageData`, never in CSS.
 */

export type ColormapName = 'gray' | 'viridis' | 'magma';

const ANCHORS: Record<ColormapName, [number, number, number][]> = {
    gray: [
        [0, 0, 0],
        [255, 255, 255],
    ],
    viridis: [
        [68, 1, 84],
        [59, 82, 139],
        [33, 145, 140],
        [94, 201, 98],
        [253, 231, 37],
    ],
    magma: [
        [0, 0, 4],
        [81, 18, 124],
        [183, 55, 121],
        [252, 137, 97],
        [252, 253, 191],
    ],
};

/** Builds a 256×RGB lookup table by interpolating the anchor colors. */
export function buildColormap(
    anchors: readonly [number, number, number][],
): Uint8Array {
    const stops = anchors.length > 0 ? anchors : ANCHORS.gray;
    const table = new Uint8Array(256 * 3);

    for (let i = 0; i < 256; i++) {
        const position = (i / 255) * (stops.length - 1);
        const low = Math.floor(position);
        const high = Math.min(stops.length - 1, low + 1);
        const fraction = position - low;

        for (let channel = 0; channel < 3; channel++) {
            table[i * 3 + channel] = Math.round(
                stops[low][channel] +
                    (stops[high][channel] - stops[low][channel]) * fraction,
            );
        }
    }

    return table;
}

/** A named color map, or `gray` for an unknown name. */
export function colormap(name: ColormapName): Uint8Array {
    return buildColormap(ANCHORS[name] ?? ANCHORS.gray);
}
