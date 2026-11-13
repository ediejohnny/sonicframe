/**
 * Small whole files built again from frames, for a browser that decodes only whole files
 * (`decodeAudioData`): MP3 and ADTS frames simply joined, FLAC frames behind their marker and
 * STREAMINFO (its length cleared, since a piece is shorter), and Ogg packets laid in new pages with
 * their CRC-32 (RFC 3533) behind the stream's header packets.
 */

import type { CodedFormat, CodedFrame } from './frames';

/** The CRC-32 of Ogg pages: polynomial 0x04C11DB7, most significant bit first, from 0. */
const CRC32 = Uint32Array.from({ length: 256 }, (_, byte) => {
    let crc = byte << 24;

    for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x80000000) === 0 ? crc << 1 : (crc << 1) ^ 0x04c11db7;
    }

    return crc >>> 0;
});

/** The CRC-32 of a whole page (its CRC field 0). */
export function oggCrc(page: Uint8Array): number {
    let crc = 0;

    for (const byte of page) {
        crc = ((crc << 8) ^ CRC32[((crc >>> 24) ^ byte) & 255]) >>> 0;
    }

    return crc;
}

/** Joins byte arrays into one. */
export function joinBytes(parts: readonly Uint8Array[]): Uint8Array {
    const out = new Uint8Array(
        parts.reduce((sum, part) => sum + part.length, 0),
    );
    let at = 0;

    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }

    return out;
}

/** A FLAC file of `frames`: the setup's marker and STREAMINFO, its whole length cleared. */
export function flacPiece(
    format: CodedFormat,
    frames: readonly CodedFrame[],
): Uint8Array {
    const head = Uint8Array.from(format.description ?? []);

    if (head.length >= 26) {
        head[21] &= 0xf0;
        head.fill(0, 22, 26);
    }

    return joinBytes([head, ...frames.map((frame) => frame.data)]);
}

/** The three Vorbis headers out of their Xiph lacing. */
function xiphSplit(setup: Uint8Array): Uint8Array[] {
    let at = 1;
    const sizes: number[] = [];

    for (let header = 0; header < 2; header++) {
        let size = 0;

        do {
            size += setup[at];
        } while (setup[at++] === 255 && at < setup.length);

        sizes.push(size);
    }

    const first = setup.subarray(at, at + sizes[0]);
    const second = setup.subarray(at + sizes[0], at + sizes[0] + sizes[1]);

    return [first, second, setup.subarray(at + sizes[0] + sizes[1])];
}

/** One Ogg page: its header with the CRC worked out, then the segments. */
function oggPage(
    flags: number,
    granule: number,
    sequence: number,
    lacing: readonly number[],
    body: Uint8Array,
): Uint8Array {
    const page = new Uint8Array(27 + lacing.length + body.length);
    const view = new DataView(page.buffer);
    page.set([0x4f, 0x67, 0x67, 0x53, 0, flags]);

    if (granule < 0) {
        view.setUint32(6, 0xffffffff, true);
        view.setUint32(10, 0xffffffff, true);
    } else {
        view.setUint32(6, granule % 0x100000000, true);
        view.setUint32(10, Math.floor(granule / 0x100000000), true);
    }

    view.setUint32(14, 1, true);
    view.setUint32(18, sequence, true);
    page[26] = lacing.length;
    page.set(lacing, 27);
    page.set(body, 27 + lacing.length);
    view.setUint32(22, oggCrc(page), true);

    return page;
}

/**
 * An Ogg file of `frames`: the header packets of the stream (the OpusHead with a bare OpusTags, or
 * the three Vorbis headers) on pages of their own with granule 0, then the audio packets, the granule
 * counting from Opus's pre-skip.
 */
export function oggPiece(
    format: CodedFormat,
    frames: readonly CodedFrame[],
): Uint8Array {
    const setup = format.description ?? new Uint8Array(0);
    const opus = format.codec === 'opus';
    const tags = Uint8Array.from([
        0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const headers = opus ? [setup, tags] : xiphSplit(setup);
    const pages: Uint8Array[] = [];
    let sequence = 0;
    let granule = 0;

    /** Lays packets on pages of at most 255 segments; the granule goes on pages where one ends. */
    const lay = (packets: readonly CodedFrame[], last: boolean): void => {
        let lacing: number[] = [];
        let parts: Uint8Array[] = [];
        let ended = false;
        /** Whether the page being laid starts inside a packet. */
        let continued = false;

        const flush = (closing: boolean, inside: boolean): void => {
            const flags =
                (continued ? 1 : 0) |
                (sequence === 0 ? 2 : 0) |
                (closing ? 4 : 0);
            pages.push(
                oggPage(
                    flags,
                    ended ? granule : -1,
                    sequence++,
                    lacing,
                    joinBytes(parts),
                ),
            );
            lacing = [];
            parts = [];
            ended = false;
            continued = inside;
        };

        packets.forEach((packet, index) => {
            let offset = 0;
            let piece = 255;

            while (piece === 255) {
                piece = Math.min(255, packet.data.length - offset);
                lacing.push(piece);
                parts.push(packet.data.subarray(offset, offset + piece));
                offset += piece;

                if (piece < 255) {
                    granule += packet.samples;
                    ended = true;
                }

                if (lacing.length === 255) {
                    const done = piece < 255;
                    flush(last && done && index === packets.length - 1, !done);
                }
            }
        });

        if (lacing.length > 0) {
            flush(last, false);
        }
    };

    lay(
        headers.slice(0, 1).map((data) => ({ data, samples: 0 })),
        false,
    );
    lay(
        headers.slice(1).map((data) => ({ data, samples: 0 })),
        false,
    );
    granule = preSkip(format);
    lay(frames, true);

    return joinBytes(pages);
}

/** Whether `codec` can be built back into a whole file here. */
export function remuxable(codec: string): boolean {
    return (
        ['mp3', 'flac', 'opus', 'vorbis'].includes(codec) ||
        codec.startsWith('mp4a.')
    );
}

/** The whole file of `frames` for `format`, as `decodeAudioData` takes it. */
export function wholePiece(
    format: CodedFormat,
    frames: readonly CodedFrame[],
): Uint8Array {
    if (format.codec === 'flac') {
        return flacPiece(format, frames);
    }

    if (format.codec === 'opus' || format.codec === 'vorbis') {
        return oggPiece(format, frames);
    }

    return joinBytes(frames.map((frame) => frame.data));
}

/** Opus's pre-skip, in 48 kHz samples (0 for other codecs). */
export function preSkip(format: CodedFormat): number {
    const setup = format.description;

    return format.codec === 'opus' && setup && setup.length >= 12
        ? setup[10] | (setup[11] << 8)
        : 0;
}
