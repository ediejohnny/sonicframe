/**
 * A WebM or Matroska file read as it arrives. The Segment, its Clusters and BlockGroups are walked
 * into; Info and Tracks are read whole (up to 1 MiB) for the sound's setup; every other element (cues,
 * tags, cover art) is skipped without being kept. The first audio track of a codec WebCodecs names
 * (Opus, Vorbis, AAC, FLAC, MP3) is followed, and its blocks, laced or not, become frames; blocks of
 * other tracks are skipped unread. A frame's samples come from the time to the next one, so each is
 * given when the next arrives, and the last by `end`.
 */

import { ByteQueue } from './byte-queue';
import { aacCodec } from './codecs';
import { ebmlFloat, ebmlHeader, ebmlUint, vint } from './ebml';
import {
    notFormat,
    type CodedFormat,
    type CodedFrame,
    type FrameReader,
} from './frames';

const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const TRACK_NUMBER = 0xd7;
const TRACK_TYPE = 0x83;
const CODEC_ID = 0x86;
const CODEC_PRIVATE = 0x63a2;
const AUDIO = 0xe1;
const SAMPLING_FREQUENCY = 0xb5;
const CHANNELS = 0x9f;
const CLUSTER = 0x1f43b675;
const TIMECODE = 0xe7;
const SIMPLE_BLOCK = 0xa3;
const BLOCK_GROUP = 0xa0;
const BLOCK = 0xa1;

/** The largest Info or Tracks element read: 1 MiB. */
const MOST_SETUP = 1_048_576;

/** The largest block of the followed track: 16 MiB. */
const MOST_BLOCK = 16_777_216;

/** Bytes enough to read a block's track number, time and flags. */
const BLOCK_HEAD = 11;

type Element = {
    readonly id: number;
    readonly start: number;
    readonly end: number;
};

/** The elements laid one after another inside `bytes` from `from` to `to`; an unknown size ends them. */
function children(bytes: Uint8Array, from: number, to: number): Element[] {
    const found: Element[] = [];
    let at = from;

    while (at < to) {
        const header = ebmlHeader(bytes, at);

        if (
            !header ||
            header.size === null ||
            at + header.length + header.size > to
        ) {
            break;
        }

        found.push({
            id: header.id,
            start: at + header.length,
            end: at + header.length + header.size,
        });
        at += header.length + header.size;
    }

    return found;
}

/** The codec of a track, as WebCodecs takes it; null when it is not one read here. */
function trackCodec(
    bytes: Uint8Array,
    entry: Element,
): {
    number: number;
    codec: string;
    rate: number;
    channels: number;
    description?: Uint8Array;
} | null {
    let number = 0;
    let type = 0;
    let id = '';
    let setup: Uint8Array | undefined;
    let rate = 8000;
    let channels = 1;

    for (const one of children(bytes, entry.start, entry.end)) {
        const size = one.end - one.start;

        if (one.id === TRACK_NUMBER) {
            number = ebmlUint(bytes, one.start, size);
        } else if (one.id === TRACK_TYPE) {
            type = ebmlUint(bytes, one.start, size);
        } else if (one.id === CODEC_ID) {
            id = String.fromCharCode(...bytes.subarray(one.start, one.end));
        } else if (one.id === CODEC_PRIVATE) {
            setup = bytes.slice(one.start, one.end);
        } else if (one.id === AUDIO) {
            for (const field of children(bytes, one.start, one.end)) {
                const width = field.end - field.start;

                if (field.id === SAMPLING_FREQUENCY) {
                    rate = ebmlFloat(bytes, field.start, width);
                } else if (field.id === CHANNELS) {
                    channels = ebmlUint(bytes, field.start, width);
                }
            }
        }
    }

    if (type !== 2 || number < 1) {
        return null;
    }

    const track = { number, rate, channels };

    switch (id) {
        case 'A_OPUS':
            return {
                ...track,
                codec: 'opus',
                rate: 48000,
                ...(setup ? { description: setup } : {}),
            };
        case 'A_MPEG/L3':
            return { ...track, codec: 'mp3' };
        case 'A_AAC': {
            const codec = setup ? aacCodec(setup) : null;

            return codec && setup
                ? { ...track, codec, description: setup }
                : null;
        }
        case 'A_VORBIS':
        case 'A_FLAC':
            return setup
                ? {
                      ...track,
                      codec: id === 'A_FLAC' ? 'flac' : 'vorbis',
                      description: setup,
                  }
                : null;
        default:
            return null;
    }
}

/**
 * Where a block's laced frames start and their sizes, the lacing read from `at` (Xiph 1, fixed 2,
 * EBML 3); null when the sizes do not fit the block.
 */
function laced(
    bytes: Uint8Array,
    at: number,
    end: number,
    lacing: number,
): { start: number; sizes: number[] } | null {
    const count = bytes[at] + 1;
    let index = at + 1;
    const sizes: number[] = [];

    for (let frame = 0; frame < count - 1 && lacing !== 2; frame++) {
        if (lacing === 1) {
            let size = 0;

            do {
                size += bytes[index];
            } while (bytes[index++] === 255 && index < end);

            sizes.push(size);
        } else {
            const number = vint(bytes, index, 8, false);

            if (!number) {
                return null;
            }

            index += number.width;
            const bias = frame === 0 ? 0 : 2 ** (7 * number.width - 1) - 1;
            sizes.push(
                frame === 0
                    ? number.value
                    : sizes[frame - 1] + number.value - bias,
            );
        }
    }

    const room = end - index;

    if (lacing === 2) {
        return room % count === 0
            ? {
                  start: index,
                  sizes: Array.from({ length: count }, () => room / count),
              }
            : null;
    }

    const used = sizes.reduce((sum, size) => sum + size, 0);

    return sizes.every((size) => size >= 0) && used <= room
        ? { start: index, sizes: [...sizes, room - used] }
        : null;
}

export function createWebmReader(): FrameReader {
    const queue = new ByteQueue();
    let started = false;
    let track: ReturnType<typeof trackCodec> = null;
    let scale = 1_000_000;
    let duration: number | null = null;
    let clusterTime = 0;
    let pending: { data: Uint8Array; time: number } | null = null;
    let step = 0;

    /** The frames a block holds, each given once the next one's time is known. */
    const block = (data: Uint8Array, frames: CodedFrame[]): void => {
        if (track === null) {
            return;
        }

        const number = vint(data, 0, 8, false);

        if (
            !number ||
            number.value !== track.number ||
            number.width + 3 > data.length
        ) {
            return;
        }

        const at = number.width;
        const offset = ((data[at] << 24) >> 16) | data[at + 1];
        const time = ((clusterTime + offset) * scale) / 1e9;
        const lacing = (data[at + 2] >> 1) & 3;
        const lace =
            lacing === 0
                ? { start: at + 3, sizes: [data.length - at - 3] }
                : laced(data, at + 3, data.length, lacing);

        if (lace === null) {
            throw notFormat('a WebM sound read here');
        }

        let from = lace.start;

        for (const size of lace.sizes) {
            if (pending !== null) {
                const samples = Math.max(
                    0,
                    Math.round((time - pending.time) * track.rate),
                );
                step = samples || step;
                frames.push({ data: pending.data, samples });
            }

            pending = { data: data.slice(from, from + size), time };
            from += size;
        }
    };

    return {
        get format(): CodedFormat | null {
            if (track === null) {
                return null;
            }

            const { codec, rate, channels, description } = track;

            return {
                codec,
                sampleRate: rate,
                channels,
                ...(description ? { description } : {}),
                ...(duration !== null && duration > 0
                    ? {
                          totalSamples: Math.round(
                              ((duration * scale) / 1e9) * rate,
                          ),
                      }
                    : {}),
            };
        },
        push(bytes: Uint8Array): CodedFrame[] {
            queue.push(bytes);
            const frames: CodedFrame[] = [];

            for (;;) {
                const view = queue.view();
                const header = ebmlHeader(view, 0);

                if (header === undefined) {
                    return frames;
                }

                if (header === null || (!started && header.id !== EBML)) {
                    throw notFormat('WebM');
                }

                started = true;
                const { id, size, length } = header;

                if (id === SEGMENT || id === CLUSTER || id === BLOCK_GROUP) {
                    queue.skip(length);
                    continue;
                }

                if (size === null) {
                    throw notFormat('a WebM sound read here');
                }

                if (id === INFO || id === TRACKS || id === TIMECODE) {
                    if (size > MOST_SETUP) {
                        throw notFormat('a WebM sound read here');
                    }

                    if (view.length < length + size) {
                        return frames;
                    }

                    const element = queue.take(length + size);

                    if (id === TIMECODE) {
                        clusterTime = ebmlUint(
                            element,
                            length,
                            Math.min(size, 8),
                        );
                    } else if (id === INFO) {
                        for (const one of children(
                            element,
                            length,
                            length + size,
                        )) {
                            if (one.id === TIMECODE_SCALE) {
                                scale =
                                    ebmlUint(
                                        element,
                                        one.start,
                                        one.end - one.start,
                                    ) || scale;
                            } else if (one.id === DURATION) {
                                duration = ebmlFloat(
                                    element,
                                    one.start,
                                    one.end - one.start,
                                );
                            }
                        }
                    } else if (track === null) {
                        track =
                            children(element, length, length + size)
                                .filter((one) => one.id === TRACK_ENTRY)
                                .map((entry) => trackCodec(element, entry))
                                .find((one) => one !== null) ?? null;

                        if (
                            track === null ||
                            track.channels < 1 ||
                            !(track.rate > 0)
                        ) {
                            throw notFormat('a WebM file with sound read here');
                        }
                    }

                    continue;
                }

                if (id === SIMPLE_BLOCK || id === BLOCK) {
                    if (view.length < length + Math.min(size, BLOCK_HEAD)) {
                        return frames;
                    }

                    const number = vint(view, length, 8, false);

                    if (
                        track === null ||
                        !number ||
                        number.value !== track.number
                    ) {
                        queue.skip(length + size);
                        continue;
                    }

                    if (size > MOST_BLOCK) {
                        throw notFormat('a WebM sound read here');
                    }

                    if (view.length < length + size) {
                        return frames;
                    }

                    block(queue.take(length + size).subarray(length), frames);
                    continue;
                }

                queue.skip(length + size);
            }
        },
        end(): CodedFrame[] {
            if (pending === null) {
                return [];
            }

            const last = { data: pending.data, samples: step };
            pending = null;

            return [last];
        },
    };
}
