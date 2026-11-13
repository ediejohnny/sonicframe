/**
 * A reader for codecs whose frames start with a sync word and say their own length (MP3, AAC in
 * ADTS). A frame is taken only when its header reads and matches the stream's first; anything else is
 * skipped a byte at a time until a frame starts again. The first frame counts only when the next one
 * follows where it says, so stray bytes that look like a header are not taken for the sound.
 */

import { ByteQueue } from './byte-queue';
import {
    notFormat,
    type CodedFormat,
    type CodedFrame,
    type FrameReader,
} from './frames';

/** A frame's header, as one codec reads it. */
export type SyncHeader = {
    /** The whole frame's length in bytes, header included. */
    readonly length: number;
    readonly samples: number;
    readonly sampleRate: number;
    readonly channels: number;
    /** What every frame of one stream shares (the version and the rate, say). */
    readonly stream: number;
    readonly codec: string;
};

export type SyncCodec = {
    /** The format's name, for the error when it is not found. */
    readonly name: string;
    /** Bytes needed to read a header. */
    readonly headerBytes: number;
    header(bytes: Uint8Array, at: number): SyncHeader | null;
    /**
     * The whole sound's samples, when the first frame carries them (an MP3's Xing header); such a
     * frame holds no sound and is not given.
     */
    totalIn?(frame: Uint8Array, header: SyncHeader): number | undefined;
};

/** How far the first frame is looked for before the bytes count as another format: 64 KiB. */
const FIRST_SEARCH = 65_536;

export function createSyncReader(codec: SyncCodec): FrameReader {
    const queue = new ByteQueue();
    let format: CodedFormat | null = null;
    let stream = -1;
    let searched = 0;

    const readable = (at: number): SyncHeader | null => {
        const header = codec.header(queue.view(), at);

        return header && (stream < 0 || header.stream === stream)
            ? header
            : null;
    };

    const lose = (): void => {
        queue.skip(1);
        searched++;

        if (format === null && searched > FIRST_SEARCH) {
            throw notFormat(codec.name);
        }
    };

    return {
        get format(): CodedFormat | null {
            return format;
        },
        push(bytes: Uint8Array): CodedFrame[] {
            queue.push(bytes);
            const frames: CodedFrame[] = [];

            while (queue.length >= codec.headerBytes) {
                const header = readable(0);

                if (header === null) {
                    lose();
                    continue;
                }

                if (format === null) {
                    if (queue.length < header.length + codec.headerBytes) {
                        break;
                    }

                    const next = codec.header(queue.view(), header.length);

                    if (next === null || next.stream !== header.stream) {
                        lose();
                        continue;
                    }
                }

                if (queue.length < header.length) {
                    break;
                }

                const data = queue.take(header.length);

                if (format === null) {
                    stream = header.stream;
                    const totalSamples = codec.totalIn?.(data, header);
                    format = {
                        codec: header.codec,
                        sampleRate: header.sampleRate,
                        channels: header.channels,
                        ...(totalSamples === undefined ? {} : { totalSamples }),
                    };

                    if (totalSamples !== undefined) {
                        continue;
                    }
                }

                frames.push({ data, samples: header.samples });
            }

            return frames;
        },
    };
}
