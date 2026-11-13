/**
 * Sound files built by hand, byte by byte from the formats' tables, for the readers' tests: frames of
 * silence with real headers, and WAV files of given samples.
 */

import fc from 'fast-check';
import { expect } from 'vite-plus/test';
import type { CodedFrame, FrameReader } from '../../src/core/audio/frames';

/** Bytes of a text, one per letter. */
export function ascii(text: string): number[] {
    return Array.from({ length: text.length }, (_, index) =>
        text.charCodeAt(index),
    );
}

/** Little-endian bytes of a whole number. */
export function little(value: number, size: number): number[] {
    return Array.from(
        { length: size },
        (_, index) => Math.floor(value / 2 ** (8 * index)) % 256,
    );
}

/** Joins pieces of bytes into one array. */
export function bytes(...pieces: (ArrayLike<number> | number)[]): Uint8Array {
    return Uint8Array.from(
        pieces.flatMap((piece) =>
            typeof piece === 'number' ? [piece] : Array.from(piece),
        ),
    );
}

/** MPEG-1 Layer III, 128 kbit/s, 44 100 Hz, joint stereo: 417 bytes, 418 padded. */
export const MP3_HEADER: readonly number[] = [0xff, 0xfb, 0x90, 0x44];
/** MPEG-1 Layer III, 128 kbit/s, 44 100 Hz, padded. */
export const MP3_PADDED_HEADER: readonly number[] = [0xff, 0xfb, 0x92, 0x44];
/** MPEG-2 Layer III, 64 kbit/s, 22 050 Hz, mono: 208 bytes, 576 samples. */
export const MP3_V2_HEADER: readonly number[] = [0xff, 0xf3, 0x80, 0xc0];

/** A frame: its header, then zeros up to `length` bytes. */
export function frame(header: readonly number[], length: number): number[] {
    return [
        ...header,
        ...Array.from({ length: length - header.length }, () => 0),
    ];
}

/** An MP3 of `count` frames of 417 bytes. */
export function mp3(count: number): Uint8Array {
    return bytes(
        ...Array.from({ length: count }, () => frame(MP3_HEADER, 417)),
    );
}

/** An ADTS header: AAC LC, 44 100 Hz, two channels, no checksum, a frame of `length` bytes. */
export function adtsHeader(length: number): number[] {
    return [
        0xff,
        0xf1,
        0x50,
        0x80 | ((length >> 11) & 3),
        (length >> 3) & 0xff,
        ((length & 7) << 5) | 0x1f,
        0xfc,
    ];
}

/** A WAV file: `fmt ` with the given fields, any `extra` chunks, then `data` of `payload`. */
export function wav(options: {
    code?: number;
    channels: number;
    rate?: number;
    bits: number;
    payload: readonly number[];
    dataSize?: number;
    extra?: readonly number[];
    riff?: string;
    extensible?: number;
}): Uint8Array {
    const block = (options.channels * options.bits) / 8;
    const extensible =
        options.extensible === undefined
            ? []
            : [
                  ...little(22, 2),
                  ...little(options.bits, 2),
                  ...little(3, 4),
                  ...little(options.extensible, 2),
                  ...Array.from({ length: 14 }, () => 0),
              ];
    const format = [
        ...little(
            options.extensible === undefined ? (options.code ?? 1) : 0xfffe,
            2,
        ),
        ...little(options.channels, 2),
        ...little(options.rate ?? 8000, 4),
        ...little((options.rate ?? 8000) * block, 4),
        ...little(block, 2),
        ...little(options.bits, 2),
        ...extensible,
    ];

    return bytes(
        ascii(options.riff ?? 'RIFF'),
        little(0, 4),
        ascii('WAVE'),
        ascii('fmt '),
        little(format.length, 4),
        format,
        options.extra ?? [],
        ascii('data'),
        little(options.dataSize ?? options.payload.length, 4),
        options.payload,
    );
}

/**
 * Feeds random bytes to fresh readers: each must end, give only frames that `header` reads as whole,
 * and throw nothing but a TypeError.
 */
export function expectSafeOnAnyBytes(
    make: () => FrameReader,
    header: (bytes: Uint8Array, at: number) => { length: number } | null,
): void {
    fc.assert(
        fc.property(fc.uint8Array({ maxLength: 3000 }), (data) => {
            try {
                for (const one of make().push(data)) {
                    expect(header(one.data, 0)?.length).toBe(one.data.length);
                }
            } catch (error) {
                expect(error).toBeInstanceOf(TypeError);
            }
        }),
    );
}

/**
 * Reads `file` with up to six of its bytes changed at random: `read` must end, and throw nothing but
 * a TypeError.
 */
export function expectSafeWhenDamaged(
    file: Uint8Array,
    read: (damaged: Uint8Array) => void,
): void {
    fc.assert(
        fc.property(
            fc.array(
                fc.tuple(
                    fc.nat({ max: file.length - 1 }),
                    fc.integer({ min: 0, max: 255 }),
                ),
                { minLength: 1, maxLength: 6 },
            ),
            (changes) => {
                const damaged = file.slice();

                for (const [at, value] of changes) {
                    damaged[at] = value;
                }

                try {
                    read(damaged);
                } catch (error) {
                    expect(error).toBeInstanceOf(TypeError);
                }
            },
        ),
    );
}

/** Every frame `reader` gives for `file` pushed in pieces cut at `cuts`, then its end. */
export function readAll(
    reader: FrameReader,
    file: Uint8Array,
    cuts: readonly number[] = [],
): CodedFrame[] {
    const frames = inPieces(file, cuts, (piece) => reader.push(piece)).flat();

    return [...frames, ...(reader.end?.() ?? [])];
}

/** Feeds `data` to `push` in pieces cut at `cuts` (sizes), the rest last. */
export function inPieces<T>(
    data: Uint8Array,
    cuts: readonly number[],
    push: (piece: Uint8Array) => T,
): T[] {
    const out: T[] = [];
    let at = 0;

    for (const cut of cuts) {
        out.push(push(data.subarray(at, at + cut)));
        at += cut;
    }

    out.push(push(data.subarray(at)));

    return out;
}
