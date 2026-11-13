/**
 * An Ogg file of Opus or Vorbis read as it arrives (RFC 3533, RFC 7845, Vorbis I): pages are found by
 * their capture pattern, the first logical stream that starts with an Opus or Vorbis header is
 * followed and every other is skipped, and its packets are put back together from their lacing. The
 * header packets become the decoder's setup; each audio packet is a frame, and the samples of a page
 * (from its granule position) go to the last packet it completes. A packet is at most 1 MiB.
 */

import { ByteQueue } from './byte-queue';
import { textAt, uint32le } from './bytes';
import {
    notFormat,
    type CodedFormat,
    type CodedFrame,
    type FrameReader,
} from './frames';

/** Bytes of a page header before its segment table. */
const PAGE_HEAD = 27;

/** How far the first page of a sound is looked for: 64 KiB. */
const FIRST_SEARCH = 65_536;

/** The largest packet put together: 1 MiB. */
const MOST_PACKET = 1_048_576;

/** The lengths of the first two headers in Xiph lacing (255 for each full 255 bytes, then the rest). */
function lacing(length: number): number[] {
    return [
        ...Array.from({ length: Math.floor(length / 255) }, () => 255),
        length % 255,
    ];
}

/** The three Vorbis headers as WebCodecs takes them: their count less one, two lacings, the headers. */
export function xiphHeaders(headers: readonly Uint8Array[]): Uint8Array {
    const head = [
        2,
        ...lacing(headers[0].length),
        ...lacing(headers[1].length),
    ];
    const total =
        head.length + headers.reduce((sum, one) => sum + one.length, 0);
    const out = new Uint8Array(total);
    let at = head.length;
    out.set(head);

    for (const one of headers) {
        out.set(one, at);
        at += one.length;
    }

    return out;
}

/** Joins the pieces of one packet. */
function join(parts: readonly Uint8Array[], size: number): Uint8Array {
    const packet = new Uint8Array(size);
    let at = 0;

    for (const part of parts) {
        packet.set(part, at);
        at += part.length;
    }

    return packet;
}

export function createOggReader(): FrameReader {
    const queue = new ByteQueue();
    let format: CodedFormat | null = null;
    let codec: 'opus' | 'vorbis' | null = null;
    let serial: number | null = null;
    const headers: Uint8Array[] = [];
    let parts: Uint8Array[] = [];
    let size = 0;
    let granule = 0;
    let searched = 0;
    let ended = false;

    /** The first packet of a stream: its codec, or null when it is neither Opus nor Vorbis. */
    const start = (packet: Uint8Array): boolean => {
        if (textAt(packet, 0, 'OpusHead') && packet.length >= 19) {
            codec = 'opus';
        } else if (
            textAt(packet, 1, 'vorbis') &&
            packet[0] === 1 &&
            packet.length >= 16
        ) {
            codec = 'vorbis';
        }

        return codec !== null;
    };

    /** A header packet; once all came, the format. */
    const header = (packet: Uint8Array): void => {
        headers.push(packet);
        const [first] = headers;

        if (codec === 'opus' && headers.length === 2) {
            format = {
                codec: 'opus',
                sampleRate: 48000,
                channels: first[9],
                description: first,
            };
        } else if (codec === 'vorbis' && headers.length === 3) {
            format = {
                codec: 'vorbis',
                sampleRate: uint32le(first, 12),
                channels: first[11],
                description: xiphHeaders(headers),
            };
        }

        if (
            format !== null &&
            (format.channels < 1 || !(format.sampleRate > 0))
        ) {
            throw notFormat('an Ogg sound read here');
        }
    };

    /** One page's packets: the audio ones, with the page's samples on the last. */
    const page = (bytes: Uint8Array, segments: number): CodedFrame[] => {
        const flags = bytes[5];
        const pageSerial = uint32le(bytes, 14);
        const position =
            uint32le(bytes, 10) === 0xffffffff &&
            uint32le(bytes, 6) === 0xffffffff
                ? -1
                : uint32le(bytes, 10) * 0x100000000 + uint32le(bytes, 6);
        const audio: Uint8Array[] = [];

        if (serial === null && (flags & 2) === 0) {
            return [];
        }

        if (serial !== null && pageSerial !== serial) {
            return [];
        }

        if ((flags & 1) === 0) {
            parts = [];
            size = 0;
        }

        let at = PAGE_HEAD + segments;

        for (let segment = 0; segment < segments; segment++) {
            const length = bytes[PAGE_HEAD + segment];
            parts.push(bytes.subarray(at, at + length));
            size += length;
            at += length;

            if (size > MOST_PACKET) {
                throw notFormat('an Ogg sound read here');
            }

            if (length < 255) {
                const packet = join(parts, size);
                parts = [];
                size = 0;

                if (serial === null) {
                    if (!start(packet)) {
                        return [];
                    }

                    serial = pageSerial;
                    header(packet);
                } else if (format === null) {
                    header(packet);
                } else {
                    audio.push(packet);
                }
            }
        }

        if ((flags & 4) === 4 && pageSerial === serial) {
            ended = true;
        }

        const samples = position >= granule ? position - granule : 0;

        if (position >= 0 && format !== null) {
            granule = Math.max(granule, position);
        }

        return audio.map((data, index) => ({
            data,
            samples: index === audio.length - 1 ? samples : 0,
        }));
    };

    return {
        get format(): CodedFormat | null {
            return format;
        },
        push(bytes: Uint8Array): CodedFrame[] {
            queue.push(bytes);
            const frames: CodedFrame[] = [];

            while (!ended && queue.length >= PAGE_HEAD) {
                const head = queue.view();

                if (!textAt(head, 0, 'OggS') || head[4] !== 0) {
                    queue.skip(1);
                    searched++;

                    if (serial === null && searched > FIRST_SEARCH) {
                        throw notFormat('an Ogg sound read here');
                    }

                    continue;
                }

                const segments = head[26];

                if (queue.length < PAGE_HEAD + segments) {
                    break;
                }

                let body = 0;

                for (let segment = 0; segment < segments; segment++) {
                    body += head[PAGE_HEAD + segment];
                }

                if (queue.length < PAGE_HEAD + segments + body) {
                    break;
                }

                frames.push(
                    ...page(queue.take(PAGE_HEAD + segments + body), segments),
                );
            }

            if (ended) {
                queue.skip(queue.length);
            }

            return frames;
        },
    };
}
