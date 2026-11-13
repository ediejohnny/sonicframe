/**
 * Which format a sound file is, from its first bytes (never its name or the server's type), and the
 * size of an ID3v2 tag in front, which MP3, AAC and FLAC files may carry.
 */

import { adtsHeader } from './adts';
import { textAt as written } from './bytes';
import { mp3Header } from './mp3';

/** The formats a sound is read in pieces from. */
export type SoundKind =
    | 'mp3'
    | 'adts'
    | 'wav'
    | 'ogg'
    | 'flac'
    | 'webm'
    | 'mp4';

/** Bytes needed to tell a format. */
export const SNIFF_BYTES = 12;

/**
 * The size of the ID3v2 tag the bytes start with (its header, body and footer), 0 when they start
 * with none, or null when fewer than its 10-byte header came.
 */
export function id3Size(bytes: Uint8Array): number | null {
    if (bytes.length < 10) {
        return written(bytes, 0, 'ID3'.slice(0, bytes.length)) ? null : 0;
    }

    const size = bytes.subarray(6, 10);

    if (!written(bytes, 0, 'ID3') || size.some((byte) => byte >= 0x80)) {
        return 0;
    }

    const body =
        size[0] * 0x200000 + size[1] * 0x4000 + size[2] * 0x80 + size[3];

    return 10 + body + ((bytes[5] & 0x10) === 0x10 ? 10 : 0);
}

/** The format the bytes start with (after any ID3 tag), or null when it is none read in pieces. */
export function soundKind(bytes: Uint8Array): SoundKind | null {
    if (
        (written(bytes, 0, 'RIFF') || written(bytes, 0, 'RF64')) &&
        written(bytes, 8, 'WAVE')
    ) {
        return 'wav';
    }

    if (written(bytes, 0, 'OggS')) {
        return 'ogg';
    }

    if (written(bytes, 0, 'fLaC')) {
        return 'flac';
    }

    if (
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3
    ) {
        return 'webm';
    }

    if (written(bytes, 4, 'ftyp')) {
        return 'mp4';
    }

    if (adtsHeader(bytes, 0) !== null) {
        return 'adts';
    }

    return mp3Header(bytes, 0) === null ? null : 'mp3';
}
