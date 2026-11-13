/**
 * WebM files built element by element for the reader's tests (RFC 8794, Matroska): IDs and sizes as
 * variable-length numbers, a track list, and clusters of blocks whose frames are filled with a number.
 */

import { ascii, bytes } from './sound-files';

/** An ID's bytes (its marker is part of it). */
function idBytes(id: number): number[] {
    const width = id > 0xffffff ? 4 : id > 0xffff ? 3 : id > 0xff ? 2 : 1;

    return Array.from(
        { length: width },
        (_, index) => Math.floor(id / 256 ** (width - 1 - index)) % 256,
    );
}

/** A size in the fewest bytes, or `unknown` (all ones in 8 bytes). */
export function sizeBytes(size: number | 'unknown'): number[] {
    if (size === 'unknown') {
        return [0x01, ...Array.from({ length: 7 }, () => 0xff)];
    }

    let width = 1;

    while (size >= 2 ** (7 * width) - 1) {
        width++;
    }

    const out = Array.from(
        { length: width },
        (_, index) => Math.floor(size / 256 ** (width - 1 - index)) % 256,
    );
    out[0] |= 0x100 >> width;

    return out;
}

/** An element: its ID, its size, its content. */
export function element(
    id: number,
    ...content: (ArrayLike<number> | number)[]
): number[] {
    const body = bytes(...content);

    return [...idBytes(id), ...sizeBytes(body.length), ...body];
}

/** A master element whose size is unknown. */
export function open(
    id: number,
    ...content: (ArrayLike<number> | number)[]
): number[] {
    return [...idBytes(id), ...sizeBytes('unknown'), ...bytes(...content)];
}

/** An unsigned number element of `width` bytes. */
export function uintElement(id: number, value: number, width = 1): number[] {
    return element(
        id,
        Array.from(
            { length: width },
            (_, index) => Math.floor(value / 256 ** (width - 1 - index)) % 256,
        ),
    );
}

/** A float element of 8 bytes. */
export function floatElement(id: number, value: number, width = 8): number[] {
    const view = new DataView(new ArrayBuffer(width));

    if (width === 4) {
        view.setFloat32(0, value);
    } else {
        view.setFloat64(0, value);
    }

    return element(id, new Uint8Array(view.buffer));
}

export type TrackOptions = {
    number: number;
    type?: number;
    codec: string;
    setup?: readonly number[];
    rate?: number;
    /** The rate written as a 4-byte float. */
    float32?: boolean;
    channels?: number;
};

export function trackEntry(track: TrackOptions): number[] {
    return element(
        0xae,
        uintElement(0xd7, track.number),
        uintElement(0x83, track.type ?? 2),
        element(0x86, ascii(track.codec)),
        track.setup ? element(0x63a2, track.setup) : [],
        element(
            0xe1,
            floatElement(0xb5, track.rate ?? 48000, track.float32 ? 4 : 8),
            uintElement(0x9f, track.channels ?? 2),
        ),
    );
}

/** A block's content: its track, time, flags, then laced frames. */
export function blockContent(
    track: number,
    time: number,
    frames: readonly (readonly number[])[],
    lacing = 0,
): number[] {
    const head = [
        0x80 | track,
        (time >> 8) & 255,
        time & 255,
        0x80 | (lacing << 1),
    ];

    if (lacing === 0) {
        return [...head, ...frames[0]];
    }

    const count = [frames.length - 1];
    const lengths = frames.slice(0, -1).map((frame) => frame.length);
    let sizes: number[] = [];

    if (lacing === 1) {
        sizes = lengths.flatMap((length) => [
            ...Array.from({ length: Math.floor(length / 255) }, () => 255),
            length % 255,
        ]);
    } else if (lacing === 3) {
        sizes = lengths.flatMap((length, index) => {
            if (index === 0) {
                return sizeBytes(length);
            }

            const coded = length - lengths[index - 1] + 8191;

            return [0x40 | (coded >> 8), coded & 255];
        });
    }

    return [...head, ...count, ...sizes, ...frames.flat()];
}

/** A frame of `length` bytes filled with `fill`. */
export function fillFrame(length: number, fill: number): number[] {
    return Array.from({ length }, () => fill);
}

export const OPUS_PRIVATE: readonly number[] = [
    ...ascii('OpusHead'),
    1,
    2,
    0x38,
    1,
    0x80,
    0xbb,
    0,
    0,
    0,
    0,
    0,
];

/** A WebM file: the EBML header, a segment with Info and Tracks, then the clusters given. */
export function webm(options: {
    tracks: TrackOptions[];
    clusters: number[][];
    duration?: number;
    scale?: number;
    openSegment?: boolean;
}): Uint8Array {
    const header = element(0x1a45dfa3, element(0x4282, ascii('webm')));
    const info = element(
        0x1549a966,
        options.scale ? uintElement(0x2ad7b1, options.scale, 3) : [],
        options.duration === undefined
            ? []
            : floatElement(0x4489, options.duration),
    );
    const tracks = element(0x1654ae6b, ...options.tracks.map(trackEntry));
    const content = [...info, ...tracks, ...options.clusters.flat()];

    return bytes(
        header,
        options.openSegment
            ? open(0x18538067, content)
            : element(0x18538067, content),
    );
}

/** A cluster at `time` holding `blocks` (each a whole SimpleBlock or BlockGroup element). */
export function cluster(time: number, ...blocks: number[][]): number[] {
    return element(0x1f43b675, uintElement(0xe7, time, 2), ...blocks);
}

export function simpleBlock(
    track: number,
    time: number,
    frames: readonly (readonly number[])[],
    lacing = 0,
): number[] {
    return element(0xa3, blockContent(track, time, frames, lacing));
}
