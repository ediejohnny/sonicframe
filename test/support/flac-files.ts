/**
 * FLAC files built by hand for the reader's tests (RFC 9639): a STREAMINFO block, other metadata
 * blocks, and frames whose CRC-8 and CRC-16 are worked out bit by bit here.
 */

import { ascii, bytes } from './sound-files';

/** A CRC of `width` bits, most significant bit first, from 0, one bit at a time. */
function crcBits(
    data: readonly number[],
    polynomial: number,
    width: number,
): number {
    let crc = 0;

    for (const byte of data) {
        for (let bit = 7; bit >= 0; bit--) {
            const top = ((crc >> (width - 1)) & 1) ^ ((byte >> bit) & 1);
            crc = (crc << 1) & ((1 << width) - 1);

            if (top === 1) {
                crc ^= polynomial;
            }
        }
    }

    return crc;
}

export function crc8(data: readonly number[]): number {
    return crcBits(data, 0x07, 8);
}

export function crc16(data: readonly number[]): number {
    return crcBits(data, 0x8005, 16);
}

/** A metadata block: last flag, type, 24-bit length, content. */
export function block(
    type: number,
    content: readonly number[],
    last = false,
): number[] {
    const length = content.length;

    return [
        (last ? 0x80 : 0) | type,
        (length >> 16) & 255,
        (length >> 8) & 255,
        length & 255,
        ...content,
    ];
}

/** STREAMINFO's 34 bytes: 44 100 Hz, two channels, 16 bits, `total` samples, `largest` frame bytes. */
export function streamInfo(total: number, largest = 0, rate = 44100): number[] {
    return [
        0x10,
        0x00,
        0x10,
        0x00,
        0,
        0,
        0,
        (largest >> 16) & 255,
        (largest >> 8) & 255,
        largest & 255,
        (rate >> 12) & 255,
        (rate >> 4) & 255,
        ((rate & 15) << 4) | (1 << 1) | 0,
        0xf0 | (Math.floor(total / 0x100000000) & 15),
        ...[24, 16, 8, 0].map((shift) => Math.floor(total / 2 ** shift) & 255),
        ...Array.from({ length: 16 }, () => 0),
    ];
}

/** A frame of 100 samples (block size code 6), numbered `number`, with `payload`, both CRCs right. */
export function flacFrame(
    number: number,
    payload: readonly number[],
): number[] {
    const header = [0xff, 0xf8, 0x69, 0x08, number, 99];
    const head = [...header, crc8(header)];
    const body = [...head, ...payload];
    const crc = crc16(body);

    return [...body, crc >> 8, crc & 255];
}

/** A FLAC file: the marker, STREAMINFO, any other blocks, then frames. */
export function flacFile(
    frames: readonly number[][],
    options: { total?: number; largest?: number; blocks?: number[][] } = {},
): Uint8Array {
    const others = options.blocks ?? [];
    const info = block(
        0,
        streamInfo(options.total ?? 0, options.largest),
        others.length === 0,
    );

    return bytes(ascii('fLaC'), info, ...others, ...frames);
}
