/**
 * A FLAC file read as it arrives (RFC 9639). The STREAMINFO block gives the decoder's setup and the
 * whole length; the other metadata blocks (cover art among them) are skipped without being kept.
 * A frame does not say its length, so it ends where the next frame's header starts: a sync code whose
 * header reads and passes its CRC-8, with the frame before it passing its CRC-16. The last frame is
 * given by `end`, once its CRC-16 holds. A frame longer than the STREAMINFO's largest (or 16 MiB) is
 * damaged and dropped up to the next header found inside it.
 */

import { ByteQueue } from './byte-queue';
import { textAt, uint32 } from './bytes';
import {
    notFormat,
    type CodedFormat,
    type CodedFrame,
    type FrameReader,
} from './frames';

/** The largest frame looked through for its end: 16 MiB. */
const MOST_FRAME = 16_777_216;

/** The most metadata blocks read before the frames. */
const MOST_BLOCKS = 1024;

/** A CRC table for `polynomial` of `width` bits, most significant bit first. */
function crcTable(polynomial: number, width: number): Uint16Array {
    const top = 1 << (width - 1);
    const mask = (1 << width) - 1;

    return Uint16Array.from({ length: 256 }, (_, byte) => {
        let crc = byte << (width - 8);

        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & top) === 0 ? crc << 1 : (crc << 1) ^ polynomial;
        }

        return crc & mask;
    });
}

const CRC8 = crcTable(0x07, 8);
const CRC16 = crcTable(0x8005, 16);

/** The CRC-8 of `bytes` from `from` to `to`. */
function crc8(bytes: Uint8Array, from: number, to: number): number {
    let crc = 0;

    for (let at = from; at < to; at++) {
        crc = CRC8[crc ^ bytes[at]];
    }

    return crc;
}

/** The CRC-16 after one more byte. */
function crc16(crc: number, byte: number): number {
    return ((crc << 8) & 0xffff) ^ CRC16[(crc >> 8) ^ byte];
}

/** Samples in a frame by its block size code (6 and 7 read after the coded number). */
function blockSize(code: number, bytes: Uint8Array, at: number): number {
    if (code === 1) {
        return 192;
    }

    if (code <= 5) {
        return 576 * 2 ** (code - 2);
    }

    if (code === 6) {
        return bytes[at] + 1;
    }

    return code === 7
        ? ((bytes[at] << 8) | bytes[at + 1]) + 1
        : 256 * 2 ** (code - 8);
}

/**
 * The samples of the frame whose header starts at `at`, once the header reads and its CRC-8 holds;
 * null when it does not, or undefined when more bytes are needed to tell.
 */
export function flacHeader(
    bytes: Uint8Array,
    at: number,
): number | null | undefined {
    if (at + 6 > bytes.length) {
        return undefined;
    }

    const sizeCode = bytes[at + 2] >> 4;
    const rateCode = bytes[at + 2] & 15;
    const layout = bytes[at + 3] >> 4;
    const depth = (bytes[at + 3] >> 1) & 7;

    if (
        bytes[at] !== 0xff ||
        (bytes[at + 1] & 0xfe) !== 0xf8 ||
        sizeCode === 0 ||
        rateCode === 15 ||
        layout > 10 ||
        depth === 3 ||
        (bytes[at + 3] & 1) === 1
    ) {
        return null;
    }

    const lead = bytes[at + 4];
    let ones = 0;

    while (ones < 8 && (lead & (0x80 >> ones)) !== 0) {
        ones++;
    }

    if (ones === 1 || ones === 8) {
        return null;
    }

    let end = at + 4 + Math.max(1, ones);

    if (end > bytes.length) {
        return undefined;
    }

    for (let index = at + 5; index < end; index++) {
        if ((bytes[index] & 0xc0) !== 0x80) {
            return null;
        }
    }

    const sizeAt = end;
    end += sizeCode === 6 ? 1 : sizeCode === 7 ? 2 : 0;
    end += rateCode === 12 ? 1 : rateCode === 13 || rateCode === 14 ? 2 : 0;

    if (end + 1 > bytes.length) {
        return undefined;
    }

    return crc8(bytes, at, end) === bytes[end]
        ? blockSize(sizeCode, bytes, sizeAt)
        : null;
}

export function createFlacReader(): FrameReader {
    const queue = new ByteQueue();
    let format: CodedFormat | null = null;
    let started = false;
    let blocks = 0;
    /** How far into the waiting frame its end was looked for, and the CRC-16 up to there. */
    let scanned = 0;
    let crc = 0;
    let samples = 0;
    /** Where in the waiting frame a header passed its CRC-8 while the frame failed its CRC-16. */
    let damaged = 0;
    /** The longest frame: the STREAMINFO's largest, when it says one. */
    let longest = MOST_FRAME;

    /** Reads the marker and the metadata blocks; false while more bytes are needed. */
    const metadata = (): boolean => {
        if (!started) {
            if (queue.length < 4) {
                return false;
            }

            if (!textAt(queue.take(4), 0, 'fLaC')) {
                throw notFormat('FLAC');
            }

            started = true;
        }

        while (format === null || blocks >= 0) {
            if (queue.length < 4) {
                return false;
            }

            const head = queue.view();
            const last = (head[0] & 0x80) === 0x80;
            const type = head[0] & 0x7f;
            const length = (head[1] << 16) | (head[2] << 8) | head[3];

            if (format === null) {
                if (type !== 0 || length !== 34) {
                    throw notFormat('FLAC');
                }

                if (queue.length < 38) {
                    return false;
                }

                const block = queue.take(38);
                const info = block.subarray(4);
                const sampleRate =
                    (info[10] << 12) | (info[11] << 4) | (info[12] >> 4);
                const total = (info[13] & 15) * 0x100000000 + uint32(info, 14);
                const description = new Uint8Array(42);
                description.set([0x66, 0x4c, 0x61, 0x43]);
                description.set(block, 4);
                description[4] |= 0x80;

                if (sampleRate === 0) {
                    throw notFormat('FLAC');
                }

                const largest = (info[7] << 16) | (info[8] << 8) | info[9];
                longest =
                    largest > 0 ? Math.min(largest, MOST_FRAME) : MOST_FRAME;

                format = {
                    codec: 'flac',
                    sampleRate,
                    channels: ((info[12] >> 1) & 7) + 1,
                    description,
                    ...(total > 0 ? { totalSamples: total } : {}),
                };
            } else {
                queue.skip(4 + length);
            }

            blocks++;

            if (last) {
                blocks = -1;
            } else if (blocks > MOST_BLOCKS) {
                throw notFormat('FLAC');
            }
        }

        return true;
    };

    /** The waiting frame, `length` bytes long. */
    const take = (length: number): CodedFrame => {
        const frame = { data: queue.take(length), samples };
        scanned = 0;
        crc = 0;

        return frame;
    };

    return {
        get format(): CodedFormat | null {
            return format;
        },
        push(bytes: Uint8Array): CodedFrame[] {
            queue.push(bytes);
            const frames: CodedFrame[] = [];

            if (!metadata()) {
                return frames;
            }

            for (;;) {
                const view = queue.view();

                if (scanned === 0) {
                    const first = flacHeader(view, 0);

                    if (first === undefined) {
                        return frames;
                    }

                    if (first === null) {
                        queue.skip(1);
                        continue;
                    }

                    samples = first;
                    crc = crc16(crc16(0, view[0]), view[1]);
                    scanned = 2;
                    damaged = 0;
                }

                let found = false;

                while (scanned < view.length) {
                    if (view[scanned] === 0xff) {
                        if (scanned + 1 === view.length) {
                            return frames;
                        }

                        const next =
                            (view[scanned + 1] & 0xfe) === 0xf8
                                ? flacHeader(view, scanned)
                                : null;

                        if (next === undefined) {
                            return frames;
                        }

                        if (next !== null && crc === 0) {
                            frames.push(take(scanned));
                            found = true;
                            break;
                        }

                        if (next !== null && damaged === 0) {
                            damaged = scanned;
                        }
                    }

                    crc = crc16(crc, view[scanned]);
                    scanned++;

                    if (scanned > longest) {
                        // A frame this long is damaged: it is dropped up to the next header seen.
                        if (damaged === 0) {
                            throw notFormat('FLAC');
                        }

                        queue.skip(damaged);
                        scanned = 0;
                        crc = 0;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    return frames;
                }
            }
        },
        end(): CodedFrame[] {
            const view = queue.view();

            if (scanned === 0) {
                return [];
            }

            while (scanned < view.length) {
                crc = crc16(crc, view[scanned]);
                scanned++;
            }

            return crc === 0 ? [take(scanned)] : [];
        },
    };
}
