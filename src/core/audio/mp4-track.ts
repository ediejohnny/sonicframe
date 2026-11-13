/**
 * The sound track of an MP4 or M4A file, read from its `moov` box (ISO/IEC 14496-12 and 14496-14):
 * the first track whose handler is `soun`, its codec (AAC with its AudioSpecificConfig, or MP3) and
 * its sample table, which says where each frame sits in the file and how long it is. Every count is
 * checked against the bytes of its box, so a table never claims more room than it has.
 */

import { textAt, uint32 } from './bytes';
import { notFormat, type CodedFormat } from './frames';

/** The most frames a track may list: 16 777 216 (four days of AAC at 48 kHz). */
const MOST_FRAMES = 16_777_216;

/** Where one box's content runs, inside the bytes read. */
type Box = {
    readonly type: string;
    readonly start: number;
    readonly end: number;
};

/** A track's frames: their sizes and the chunks that hold them, as the file lists them. */
export type Mp4Track = {
    readonly format: CodedFormat;
    /** Each frame's size in bytes, or one size for all. */
    readonly sizes: Uint32Array | number;
    readonly count: number;
    /** Where each chunk of frames starts in the file. */
    readonly chunks: readonly number[];
    /** Runs of chunks with the same number of frames: first chunk (from 1), frames per chunk. */
    readonly runs: readonly (readonly [number, number])[];
    /** Runs of frames with the same length in samples: how many, how long. */
    readonly lengths: readonly (readonly [number, number])[];
};

/** A 64-bit big-endian number (exact up to 2^53). */
function uint64(bytes: Uint8Array, at: number): number {
    return uint32(bytes, at) * 0x100000000 + uint32(bytes, at + 4);
}

/** The boxes laid one after another from `from` to `to`; a box that overflows ends the list. */
export function boxesIn(bytes: Uint8Array, from: number, to: number): Box[] {
    const found: Box[] = [];
    let at = from;

    while (at + 8 <= to) {
        let size = uint32(bytes, at);
        let header = 8;

        if (size === 1) {
            if (at + 16 > to) {
                break;
            }

            size = uint64(bytes, at + 8);
            header = 16;
        } else if (size === 0) {
            size = to - at;
        }

        if (size < header || at + size > to) {
            break;
        }

        found.push({
            type: String.fromCharCode(...bytes.subarray(at + 4, at + 8)),
            start: at + header,
            end: at + size,
        });
        at += size;
    }

    return found;
}

/** The first child of `box` named `type`. */
function child(bytes: Uint8Array, box: Box, type: string, skip = 0): Box {
    const found = boxesIn(bytes, box.start + skip, box.end).find(
        (one) => one.type === type,
    );

    if (found === undefined) {
        throw notFormat('an MP4 sound read here');
    }

    return found;
}

/** A full box's table: its entry count, checked so `width` bytes each fit after `head` bytes. */
function entries(
    bytes: Uint8Array,
    box: Box,
    head: number,
    width: number,
): number {
    const count = uint32(bytes, box.start + head - 4);

    if (
        box.start + head > box.end ||
        count * width > box.end - box.start - head
    ) {
        throw notFormat('an MP4 sound read here');
    }

    return count;
}

/** A descriptor's tag and where its body runs (ISO/IEC 14496-1: lengths of up to four 7-bit bytes). */
function descriptor(
    bytes: Uint8Array,
    at: number,
    end: number,
): { tag: number; start: number; end: number } | null {
    let length = 0;
    let index = at + 1;

    for (let read = 0; read < 4 && index < end; read++) {
        const byte = bytes[index++];
        length = length * 128 + (byte & 0x7f);

        if ((byte & 0x80) === 0) {
            return index + length <= end
                ? { tag: bytes[at], start: index, end: index + length }
                : null;
        }
    }

    return null;
}

/** The codec and its setup bytes from an `esds` box. */
function codecOf(
    bytes: Uint8Array,
    esds: Box,
): { codec: string; description?: Uint8Array } {
    const es = descriptor(bytes, esds.start + 4, esds.end);

    if (es?.tag === 3) {
        const flags = bytes[es.start + 2];
        let at = es.start + 3;
        at += (flags & 0x80) === 0x80 ? 2 : 0;
        at += (flags & 0x40) === 0x40 ? 1 + bytes[at] : 0;
        at += (flags & 0x20) === 0x20 ? 2 : 0;
        const config = at < es.end ? descriptor(bytes, at, es.end) : null;

        if (config?.tag === 4 && config.start + 13 <= config.end) {
            const object = bytes[config.start];

            if (object === 0x69 || object === 0x6b) {
                return { codec: 'mp3' };
            }

            const specific = descriptor(bytes, config.start + 13, config.end);

            if (
                [0x40, 0x66, 0x67, 0x68].includes(object) &&
                specific?.tag === 5 &&
                specific.end - specific.start >= 2
            ) {
                const setup = bytes.slice(specific.start, specific.end);
                const kind = setup[0] >> 3;
                const type =
                    kind === 31
                        ? 32 + (((setup[0] & 7) << 3) | (setup[1] >> 5))
                        : kind;

                return { codec: `mp4a.40.${type}`, description: setup };
            }
        }
    }

    throw notFormat('an MP4 sound read here');
}

/** Whether a track is sound: its `hdlr` says `soun`. */
function isSound(bytes: Uint8Array, trak: Box): boolean {
    const mdia = boxesIn(bytes, trak.start, trak.end).find(
        (one) => one.type === 'mdia',
    );
    const hdlr =
        mdia &&
        boxesIn(bytes, mdia.start, mdia.end).find((one) => one.type === 'hdlr');

    return hdlr !== undefined && textAt(bytes, hdlr.start + 8, 'soun');
}

/** The sound track of the `moov` box at `moov` (its content inside `bytes`). */
export function readMp4Track(bytes: Uint8Array, moov: Box): Mp4Track {
    const trak = boxesIn(bytes, moov.start, moov.end).find(
        (one) => one.type === 'trak' && isSound(bytes, one),
    );

    if (trak === undefined) {
        throw notFormat('an MP4 file with sound');
    }

    const mdia = child(bytes, trak, 'mdia');
    const mdhd = child(bytes, mdia, 'mdhd');
    const stbl = child(bytes, child(bytes, mdia, 'minf'), 'stbl');
    const stsd = child(bytes, stbl, 'stsd');
    const entry = child(bytes, stsd, 'mp4a', 8);
    const version = (bytes[entry.start + 8] << 8) | bytes[entry.start + 9];
    const extra = version === 1 ? 16 : version === 0 ? 0 : -1;

    if (extra < 0 || entry.start + 28 > entry.end) {
        throw notFormat('an MP4 sound read here');
    }

    const { codec, description } = codecOf(
        bytes,
        child(bytes, entry, 'esds', 28 + extra),
    );
    const channels = (bytes[entry.start + 16] << 8) | bytes[entry.start + 17];
    const sampleRate = uint32(bytes, entry.start + 24) / 65536;
    const long = bytes[mdhd.start] === 1;
    const scale = uint32(bytes, mdhd.start + (long ? 20 : 12));
    const duration = long
        ? uint64(bytes, mdhd.start + 24)
        : uint32(bytes, mdhd.start + 16);

    const stsz = child(bytes, stbl, 'stsz');
    const fixed = uint32(bytes, stsz.start + 4);
    const count = uint32(bytes, stsz.start + 8);
    const sizes =
        fixed > 0
            ? fixed
            : bytes.slice(
                  stsz.start + 12,
                  stsz.start + 12 + entries(bytes, stsz, 12, 4) * 4,
              );
    const stsc = child(bytes, stbl, 'stsc');
    const runs = Array.from(
        { length: entries(bytes, stsc, 8, 12) },
        (_, index) => {
            const at = stsc.start + 8 + index * 12;

            return [uint32(bytes, at), uint32(bytes, at + 4)] as const;
        },
    );
    const stts = child(bytes, stbl, 'stts');
    const lengths = Array.from(
        { length: entries(bytes, stts, 8, 8) },
        (_, index) => {
            const at = stts.start + 8 + index * 8;
            const delta = uint32(bytes, at + 4);

            return [
                uint32(bytes, at),
                scale === sampleRate
                    ? delta
                    : Math.round((delta * sampleRate) / scale),
            ] as const;
        },
    );
    const wide = boxesIn(bytes, stbl.start, stbl.end).some(
        (one) => one.type === 'co64',
    );
    const offsets = child(bytes, stbl, wide ? 'co64' : 'stco');
    const width = wide ? 8 : 4;
    const chunks = Array.from(
        { length: entries(bytes, offsets, 8, width) },
        (_, index) => {
            const at = offsets.start + 8 + index * width;

            return wide ? uint64(bytes, at) : uint32(bytes, at);
        },
    );

    if (
        channels < 1 ||
        !(sampleRate > 0) ||
        !(scale > 0) ||
        count > MOST_FRAMES
    ) {
        throw notFormat('an MP4 sound read here');
    }

    return {
        format: {
            codec,
            sampleRate,
            channels,
            ...(description === undefined ? {} : { description }),
            ...(duration > 0
                ? { totalSamples: Math.round((duration * sampleRate) / scale) }
                : {}),
        },
        sizes: typeof sizes === 'number' ? sizes : bigEndianSizes(sizes),
        count,
        chunks,
        runs,
        lengths,
    };
}

/** A table of big-endian 32-bit sizes as numbers. */
function bigEndianSizes(table: Uint8Array): Uint32Array {
    const sizes = new Uint32Array(table.length / 4);

    for (let index = 0; index < sizes.length; index++) {
        sizes[index] = uint32(table, index * 4);
    }

    return sizes;
}
