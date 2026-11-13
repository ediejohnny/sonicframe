/**
 * MP4 (M4A) files built box by box for the reader's tests: a sound track of AAC frames, each frame
 * filled with its own number so the order shows, with the `moov` before or after the data.
 */

import { ascii, bytes } from './sound-files';

/** Big-endian bytes of a whole number. */
export function big(value: number, size: number): number[] {
    return Array.from(
        { length: size },
        (_, index) => Math.floor(value / 2 ** (8 * (size - 1 - index))) % 256,
    );
}

/** A box: its size, its name, its content. */
export function box(
    type: string,
    ...content: (ArrayLike<number> | number)[]
): number[] {
    const body = bytes(...content);

    return [...big(8 + body.length, 4), ...ascii(type), ...body];
}

/** A full box: version, three bytes of flags, then the content. */
function full(
    type: string,
    ...content: (ArrayLike<number> | number)[]
): number[] {
    return box(type, 0, 0, 0, 0, ...content);
}

/** AAC LC, 44 100 Hz, two channels. */
export const AAC_SETUP: readonly number[] = [0x12, 0x10];

/** An `esds` box for an object type, with a setup (AudioSpecificConfig) or none. */
export function esds(
    object: number,
    setup: readonly number[] = AAC_SETUP,
): number[] {
    const specific = setup.length > 0 ? [5, setup.length, ...setup] : [];
    const config = [
        4,
        13 + specific.length,
        object,
        0x15,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        ...specific,
    ];
    const es = [3, 3 + config.length + 3, 0, 1, 0, ...config, 6, 1, 2];

    return full('esds', es);
}

/** A track's `trak` box. */
function trak(handler: string, sample: number[], tables: number[][]): number[] {
    return box(
        'trak',
        box(
            'tkhd',
            Array.from({ length: 20 }, () => 0),
        ),
        box(
            'mdia',
            full('mdhd', big(0, 8), big(44100, 4), big(5120, 4), big(0, 4)),
            full(
                'hdlr',
                big(0, 4),
                ascii(handler),
                Array.from({ length: 13 }, () => 0),
            ),
            box(
                'minf',
                box('stbl', full('stsd', big(1, 4), sample), ...tables),
            ),
        ),
    );
}

export type M4aOptions = {
    /** Each frame's size; frame `i` is filled with the byte `i + 1`. */
    sizes: readonly number[];
    /** Frames per chunk. */
    perChunk: number;
    moovFirst?: boolean;
    /** Bytes of something else between chunks. */
    gap?: number;
    /** One size for every frame (the sizes' first) instead of a table. */
    fixed?: boolean;
    co64?: boolean;
    esds?: number[];
    /** A video track listed before the sound. */
    video?: boolean;
    /** The sample entry's version (QuickTime 1 adds 16 bytes). */
    entryVersion?: number;
};

/** The `moov` box for frames whose chunks start at `offsets`. */
function moov(options: M4aOptions, offsets: readonly number[]): number[] {
    const count = options.sizes.length;
    const extra =
        options.entryVersion === 1 ? Array.from({ length: 16 }, () => 0) : [];
    const entry = box(
        'mp4a',
        [0, 0, 0, 0, 0, 0, 0, 1],
        big(options.entryVersion ?? 0, 2),
        [0, 0, 0, 0, 0, 0],
        big(2, 2),
        big(16, 2),
        [0, 0, 0, 0],
        big(44100 * 65536, 4),
        extra,
        options.esds ?? esds(0x40),
    );
    const sizes = options.fixed
        ? full('stsz', big(options.sizes[0], 4), big(count, 4))
        : full(
              'stsz',
              big(0, 4),
              big(count, 4),
              ...options.sizes.map((size) => big(size, 4)),
          );
    const width = options.co64 ? 8 : 4;
    const tables = [
        full('stts', big(1, 4), big(count, 4), big(1024, 4)),
        full('stsc', big(1, 4), big(1, 4), big(options.perChunk, 4), big(1, 4)),
        sizes,
        full(
            options.co64 ? 'co64' : 'stco',
            big(offsets.length, 4),
            ...offsets.map((at) => big(at, width)),
        ),
    ];
    const video = options.video
        ? [
              trak(
                  'vide',
                  box(
                      'avc1',
                      Array.from({ length: 78 }, () => 0),
                  ),
                  [],
              ),
          ]
        : [];

    return box(
        'moov',
        box(
            'mvhd',
            Array.from({ length: 100 }, () => 0),
        ),
        ...video,
        trak('soun', entry, tables),
    );
}

/** The whole file, and where its `moov` starts. */
export function m4a(options: M4aOptions): { file: Uint8Array; moovAt: number } {
    const ftyp = box('ftyp', ascii('M4A '), big(0, 4), ascii('M4A isom'));
    const chunks: number[][] = [];

    for (
        let start = 0;
        start < options.sizes.length;
        start += options.perChunk
    ) {
        chunks.push(
            options.sizes
                .slice(start, start + options.perChunk)
                .flatMap((size, index) =>
                    Array.from(
                        { length: options.fixed ? options.sizes[0] : size },
                        () => start + index + 1,
                    ),
                ),
        );
    }

    const gap = Array.from({ length: options.gap ?? 0 }, () => 0xee);
    const layout = (dataStart: number): number[] => {
        let at = dataStart;

        return chunks.map((chunk) => {
            const here = at;
            at += chunk.length + gap.length;

            return here;
        });
    };
    const data = chunks.flatMap((chunk) => [...chunk, ...gap]);
    const placeholder = moov(options, layout(0));

    if (options.moovFirst !== false) {
        const dataStart = ftyp.length + placeholder.length + 8;

        return {
            file: bytes(
                ftyp,
                moov(options, layout(dataStart)),
                box('mdat', data),
            ),
            moovAt: ftyp.length,
        };
    }

    const dataStart = ftyp.length + 8;
    const mdat = box('mdat', data);

    return {
        file: bytes(ftyp, mdat, moov(options, layout(dataStart))),
        moovAt: ftyp.length + mdat.length,
    };
}
