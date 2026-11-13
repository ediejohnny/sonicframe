/**
 * Stand-ins for reading a sound in pieces, which happy-dom lacks: a server that sends a file a few
 * bytes at a time (answering `Range` or not) and counts what was taken, a WebCodecs decoder whose
 * every frame becomes samples at the level its byte `at` says, and an `OfflineAudioContext` that
 * remembers the files it was given.
 */

import { vi } from 'vite-plus/test';
import { afterTest } from './helpers';

/** What the fake server was asked and how many bytes were read from it. */
export type Served = { requests: { range: string | null }[]; sent: number };

/** Serves `file` for every fetch, `piece` bytes at a time; with `ranges`, a `Range` gets a 206. */
export function serve(
    file: Uint8Array,
    options: { piece?: number; ranges?: boolean; status?: number } = {},
): Served {
    const served: Served = { requests: [], sent: 0 };
    const piece = options.piece ?? 64;

    vi.stubGlobal('fetch', (_url: string, init: RequestInit = {}) => {
        const range =
            (init.headers as Record<string, string> | undefined)?.Range ?? null;
        const from =
            range !== null && options.ranges ? Number(range.slice(6, -1)) : 0;
        let at = from;
        served.requests.push({ range });

        const body = new ReadableStream<Uint8Array>({
            pull(controller): void {
                if (init.signal?.aborted) {
                    controller.error(new DOMException('stopped', 'AbortError'));

                    return;
                }

                const next = file.slice(at, at + piece);
                at += next.length;
                served.sent += next.length;

                if (next.length > 0) {
                    controller.enqueue(next);
                }

                if (at >= file.length) {
                    controller.close();
                }
            },
        });
        const status =
            options.status ?? (range !== null && options.ranges ? 206 : 200);

        return Promise.resolve({ ok: status < 400, status, body });
    });
    afterTest({ destroy: () => vi.unstubAllGlobals() });

    return served;
}

/** A decoded piece, as WebCodecs gives one. */
class FakeAudioData {
    closed = false;

    constructor(
        readonly sampleRate: number,
        readonly numberOfChannels: number,
        readonly numberOfFrames: number,
        private readonly level: number,
    ) {}

    copyTo(target: Float32Array, options: { planeIndex: number }): void {
        // Channel c holds level × (c + 1), so a mix to one channel is level × (channels + 1) / 2.
        target.fill(this.level * (options.planeIndex + 1));
    }

    close(): void {
        this.closed = true;
    }
}

export type DecoderState = {
    /** Which codecs it says it can decode. */
    supports: (codec: string) => boolean;
    /** Each config it was set up with. */
    configs: AudioDecoderConfig[];
    /** Each chunk's time, in µs. */
    times: number[];
    /** The byte of each frame that says its level (out of 255). */
    at: number;
    /** Samples given per frame. */
    samples: number;
    /** A frame whose level byte is this fails to decode. */
    failOn: number | null;
    /** How long the queue claims to be after each decode, for a millisecond. */
    queue: number;
    /** Frames sent while the queue was longer than 32. */
    crowded: number;
    data: FakeAudioData[];
};

/** A WebCodecs `AudioDecoder` and `EncodedAudioChunk` for the page. */
export function stubWebCodecs(state: Partial<DecoderState> = {}): DecoderState {
    const seen: DecoderState = {
        supports: () => true,
        configs: [],
        times: [],
        at: 4,
        samples: 100,
        failOn: null,
        queue: 0,
        crowded: 0,
        data: [],
        ...state,
    };

    class Chunk {
        readonly timestamp: number;
        readonly data: Uint8Array;

        constructor(init: { timestamp: number; data: Uint8Array }) {
            this.timestamp = init.timestamp;
            this.data = Uint8Array.from(init.data);
        }
    }

    class Decoder extends EventTarget {
        static isConfigSupported(
            config: AudioDecoderConfig,
        ): Promise<{ supported: boolean }> {
            return Promise.resolve({ supported: seen.supports(config.codec) });
        }

        state = 'unconfigured';
        decodeQueueSize = 0;
        private config: AudioDecoderConfig | null = null;

        constructor(
            private readonly init: {
                output: (data: FakeAudioData) => void;
                error: (error: unknown) => void;
            },
        ) {
            super();
        }

        configure(config: AudioDecoderConfig): void {
            this.config = config;
            this.state = 'configured';
            seen.configs.push(config);
        }

        decode(chunk: Chunk): void {
            const level = chunk.data[seen.at] ?? 0;
            seen.times.push(chunk.timestamp);

            if (this.decodeQueueSize > 32) {
                seen.crowded++;
            }

            if (level === seen.failOn) {
                this.init.error(
                    new DOMException('Decoding error', 'EncodingError'),
                );

                return;
            }

            const data = new FakeAudioData(
                this.config?.sampleRate ?? 1,
                this.config?.numberOfChannels ?? 1,
                seen.samples,
                level / 255,
            );
            seen.data.push(data);
            this.init.output(data);

            if (seen.queue > 0) {
                this.decodeQueueSize = seen.queue;
                setTimeout(() => {
                    this.decodeQueueSize = 0;
                    this.dispatchEvent(new Event('dequeue'));
                }, 1);
            }
        }

        flush(): Promise<void> {
            return Promise.resolve();
        }

        close(): void {
            this.state = 'closed';
        }
    }

    vi.stubGlobal('AudioDecoder', Decoder);
    vi.stubGlobal('EncodedAudioChunk', Chunk);
    afterTest({ destroy: () => vi.unstubAllGlobals() });

    return seen;
}

/** An `OfflineAudioContext` whose every file decodes to `samples` samples of its first level byte. */
export function stubWholeDecoder(options: {
    samples: number;
    at: number;
    rate?: number;
}): Uint8Array[] {
    const files: Uint8Array[] = [];

    vi.stubGlobal(
        'OfflineAudioContext',
        class {
            constructor(
                _channels: number,
                _length: number,
                readonly sampleRate: number,
            ) {}

            decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
                const bytes = new Uint8Array(buffer);
                files.push(bytes);
                const data = Float32Array.from(
                    { length: options.samples },
                    () => (bytes[options.at] ?? 0) / 255,
                );

                return Promise.resolve({
                    length: data.length,
                    duration: data.length / (options.rate ?? this.sampleRate),
                    sampleRate: options.rate ?? this.sampleRate,
                    numberOfChannels: 1,
                    getChannelData: () => data,
                } as unknown as AudioBuffer);
            }
        },
    );
    afterTest({ destroy: () => vi.unstubAllGlobals() });

    return files;
}
