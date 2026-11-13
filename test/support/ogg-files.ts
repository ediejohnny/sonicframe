/**
 * Ogg pages built by hand for the reader's tests (RFC 3533): a 27-byte header, the lacing values,
 * then the packets. Checksums are left at zero; the reader does not check them.
 */

import { ascii, bytes, little } from './sound-files';

export type PageOptions = {
    serial?: number;
    /** 1: continues a packet, 2: first page of a stream, 4: last page. */
    flags?: number;
    /** The granule position; -1 when no packet ends on the page. */
    granule?: number;
    packets: readonly (readonly number[])[];
    /** The last packet goes on in the next page (its lacing has no end). */
    open?: boolean;
};

/** Lacing values for a packet: 255 for each full 255 bytes, then the rest (never for an open one). */
function laceOf(length: number, open: boolean): number[] {
    const full = Array.from({ length: Math.floor(length / 255) }, () => 255);

    return open ? full : [...full, length % 255];
}

export function page(options: PageOptions): number[] {
    const table = options.packets.flatMap((packet, index) =>
        laceOf(
            packet.length,
            options.open === true && index === options.packets.length - 1,
        ),
    );
    const granule =
        options.granule === -1
            ? Array.from({ length: 8 }, () => 0xff)
            : little(options.granule ?? 0, 8);

    return [
        ...ascii('OggS'),
        0,
        options.flags ?? 0,
        ...granule,
        ...little(options.serial ?? 7, 4),
        ...little(0, 4),
        ...little(0, 4),
        table.length,
        ...table,
        ...options.packets.flat(),
    ];
}

/** A packet of `length` bytes, each `fill`. */
export function packet(length: number, fill: number): number[] {
    return Array.from({ length }, () => fill);
}

/** An OpusHead with `channels`. */
export function opusHead(channels = 2): number[] {
    return [
        ...ascii('OpusHead'),
        1,
        channels,
        ...little(312, 2),
        ...little(44100, 4),
        0,
        0,
        0,
    ];
}

/** A Vorbis identification header of 30 bytes. */
export function vorbisId(channels = 1, rate = 44100): number[] {
    return [
        1,
        ...ascii('vorbis'),
        ...little(0, 4),
        channels,
        ...little(rate, 4),
        ...packet(14, 0),
    ];
}

/** A whole Opus file: the two headers, then pages of `audio` packets with their granules. */
export function opusFile(
    audio: readonly { packets: number[][]; granule: number }[],
): Uint8Array {
    return bytes(
        page({ flags: 2, packets: [opusHead()] }),
        page({ packets: [[...ascii('OpusTags'), 0, 0, 0, 0, 0, 0, 0, 0]] }),
        ...audio.map((one) => page(one)),
    );
}
