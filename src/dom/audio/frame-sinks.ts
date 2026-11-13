/**
 * Where coded frames become samples, one channel at a time: the browser's WebCodecs `AudioDecoder`,
 * fed frame by frame and held back while its queue is long, or, without it, `decodeAudioData` on
 * small whole files built again from batches of frames. Each gives its samples mixed to one channel,
 * with their rate, and keeps nothing once given.
 */

import { mixdown } from '../../core/analysis/analysis';
import type { CodedFormat, CodedFrame } from '../../core/audio/frames';
import { wholePiece } from '../../core/audio/remux';

/** Takes samples mixed to one channel, at `rate` a second. */
export type SampleTaker = (samples: Float32Array, rate: number) => void;

/** Frames in, samples out through the taker. */
export type FrameSink = {
    push(frames: readonly CodedFrame[]): Promise<void>;
    /** Decodes what is still held; the sink is closed after. */
    finish(): Promise<void>;
    /** Stops at once, dropping what is held. */
    close(): void;
};

/** Frames waiting in the decoder before the reading waits for it. */
const QUEUE = 32;

/** How long a wait for the decoder's queue lasts at most, in ms (for browsers without `dequeue`). */
const QUEUE_WAIT = 50;

/** Seconds of sound decoded together without WebCodecs. */
const BATCH_SECONDS = 30;

/** Bytes decoded together without WebCodecs, at most: 4 MiB. */
const BATCH_BYTES = 4_194_304;

/** MP3 frames put again in front of a batch, so the bits a frame borrows from earlier ones are there. */
const MP3_PRIMING = 8;

/** The samples of a decoded `AudioData`, mixed to one channel. */
export function mixAudioData(data: AudioData): Float32Array {
    const frames = data.numberOfFrames;
    const channels = data.numberOfChannels;
    const mixed = new Float32Array(frames);
    const plane = new Float32Array(frames);

    for (let channel = 0; channel < channels; channel++) {
        data.copyTo(plane, { planeIndex: channel, format: 'f32-planar' });

        for (let index = 0; index < frames; index++) {
            mixed[index] += plane[index];
        }
    }

    if (channels > 1) {
        for (let index = 0; index < frames; index++) {
            mixed[index] /= channels;
        }
    }

    return mixed;
}

/** The decoder's setup for `format`. */
function configOf(format: CodedFormat): AudioDecoderConfig {
    return {
        codec: format.codec,
        sampleRate: format.sampleRate,
        numberOfChannels: format.channels,
        ...(format.description ? { description: format.description } : {}),
    };
}

/**
 * A sink on the browser's `AudioDecoder`, or null when the browser has none or cannot decode
 * `format`.
 */
export async function webCodecsSink(
    format: CodedFormat,
    take: SampleTaker,
): Promise<FrameSink | null> {
    const Decoder = globalThis.AudioDecoder;
    const Chunk = globalThis.EncodedAudioChunk;

    if (typeof Decoder !== 'function' || typeof Chunk !== 'function') {
        return null;
    }

    const config = configOf(format);
    const support = await Decoder.isConfigSupported(config).catch(() => null);

    if (support?.supported !== true) {
        return null;
    }

    let failure: unknown = null;
    let time = 0;
    const decoder = new Decoder({
        output: (data): void => {
            try {
                take(mixAudioData(data), data.sampleRate);
            } finally {
                data.close();
            }
        },
        error: (error): void => {
            failure = error;
        },
    });
    decoder.configure(config);

    const close = (): void => {
        if (decoder.state !== 'closed') {
            decoder.close();
        }
    };

    return {
        async push(frames: readonly CodedFrame[]): Promise<void> {
            for (const frame of frames) {
                if (failure !== null) {
                    throw failure;
                }

                decoder.decode(
                    new Chunk({
                        type: 'key',
                        timestamp: time,
                        data: frame.data,
                    }),
                );
                time += (frame.samples / format.sampleRate) * 1_000_000;

                while (decoder.decodeQueueSize > QUEUE && failure === null) {
                    await new Promise<void>((resolve) => {
                        decoder.addEventListener('dequeue', () => resolve(), {
                            once: true,
                        });
                        setTimeout(resolve, QUEUE_WAIT);
                    });
                }
            }
        },
        async finish(): Promise<void> {
            try {
                if (failure === null) {
                    await decoder.flush();
                }
            } finally {
                close();
            }

            if (failure !== null) {
                throw failure;
            }
        },
        close,
    };
}

/**
 * A sink on `decodeAudioData`: frames are held until a batch is long enough, then built into a small
 * whole file and decoded at `rate`. MP3 batches start with the last frames of the one before, and
 * their samples are dropped.
 */
export function wholeFileSink(
    format: CodedFormat,
    take: SampleTaker,
    rate: number,
): FrameSink {
    let batch: CodedFrame[] = [];
    let primed: CodedFrame[] = [];
    let samples = 0;
    let bytes = 0;
    let closed = false;

    const decode = async (): Promise<void> => {
        const Context = globalThis.OfflineAudioContext;

        if (batch.length === 0 || closed) {
            return;
        }

        if (typeof Context !== 'function') {
            throw new Error('sonicframe: this browser has no audio decoder');
        }

        const frames = [...primed, ...batch];
        const piece = wholePiece(format, frames);
        const buffer = await new Context(1, 1, rate).decodeAudioData(
            piece.buffer as ArrayBuffer,
        );
        const skipped = primed.reduce((sum, frame) => sum + frame.samples, 0);
        const drop = Math.round(
            (skipped * buffer.sampleRate) / format.sampleRate,
        );
        const mixed = mixdown(buffer, 0);

        primed = format.codec === 'mp3' ? batch.slice(-MP3_PRIMING) : [];
        batch = [];
        samples = 0;
        bytes = 0;

        if (!closed) {
            take(
                mixed.subarray(Math.min(drop, mixed.length)),
                buffer.sampleRate,
            );
        }
    };

    return {
        async push(frames: readonly CodedFrame[]): Promise<void> {
            for (const frame of frames) {
                batch.push(frame);
                samples += frame.samples;
                bytes += frame.data.length;

                if (
                    samples >= format.sampleRate * BATCH_SECONDS ||
                    bytes >= BATCH_BYTES
                ) {
                    await decode();
                }
            }
        },
        async finish(): Promise<void> {
            await decode();
            closed = true;
        },
        close(): void {
            closed = true;
            batch = [];
            primed = [];
        },
    };
}
