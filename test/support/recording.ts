/**
 * Stand-ins for recording, which happy-dom lacks: a microphone that is granted or refused, a
 * `MediaRecorder` that keeps its state and hands chunks as asked, an audio context whose analyser
 * hears a level the test sets and remembers what it was connected to, and a decoder. Each is taken
 * off after the test.
 */

import { vi } from 'vite-plus/test';
import { afterTest } from './helpers';

/** A microphone track: it only remembers being stopped. */
export class FakeTrack {
    stopped = false;

    stop(): void {
        this.stopped = true;
    }
}

/** What `getUserMedia` gives: one track. */
export class FakeStream {
    readonly track: FakeTrack = new FakeTrack();

    getTracks(): FakeTrack[] {
        return [this.track];
    }
}

/**
 * A recorder that keeps only its state; as in browsers, stopping an idle one does nothing and fires
 * nothing, and stopping a running one hands its last chunk, then fires `onstop`.
 */
export class FakeRecorder {
    static failStart = false;
    /** Which types it can record; every one by default. */
    static supported: (type: string) => boolean = () => true;
    static made: FakeRecorder[] = [];

    static isTypeSupported(type: string): boolean {
        return FakeRecorder.supported(type);
    }

    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    readonly mimeType: string;
    timeslice: number | undefined;
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;

    constructor(
        _stream?: unknown,
        readonly options: {
            mimeType?: string;
            audioBitsPerSecond?: number;
        } = {},
    ) {
        this.mimeType = options.mimeType ?? '';
        FakeRecorder.made.push(this);
    }

    start(timeslice?: number): void {
        if (FakeRecorder.failStart) {
            throw new DOMException('no tracks to record', 'NotSupportedError');
        }

        this.timeslice = timeslice;
        this.state = 'recording';
    }

    pause(): void {
        if (this.state === 'recording') {
            this.state = 'paused';
        }
    }

    resume(): void {
        if (this.state === 'paused') {
            this.state = 'recording';
        }
    }

    stop(): void {
        if (this.state === 'inactive') {
            return;
        }

        this.state = 'inactive';
        this.give(3);
        this.onstop?.();
    }

    /** Hands a chunk of `bytes` bytes, as a browser does every second. */
    give(bytes: number): void {
        this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
    }

    /** Hands a chunk said to be `bytes` bytes, never held in memory (for the size caps of long recordings). */
    announce(bytes: number): void {
        this.ondataavailable?.({ data: { size: bytes } as Blob });
    }
}

/** An analyser that hears `level` on its first sample, and remembers where it was connected. */
export class FakeAnalyser {
    static level = 0.5;
    fftSize = 2048;
    readonly connected: unknown[] = [];

    connect(target: unknown): void {
        this.connected.push(target);
    }

    getFloatTimeDomainData(buffer: Float32Array): void {
        buffer.fill(0);
        buffer[0] = -FakeAnalyser.level;
    }
}

/** An audio context whose nodes remember their connections; its `destination` is one of them. */
export class FakeAudioContext {
    static analysers: FakeAnalyser[] = [];
    static sources: { disconnected: boolean }[] = [];
    readonly destination = { name: 'speakers' };
    state = 'suspended';

    resume(): Promise<void> {
        this.state = 'running';

        return Promise.resolve();
    }

    createMediaStreamSource(): {
        disconnected: boolean;
        connect(target: unknown): void;
        disconnect(): void;
    } {
        const source = {
            disconnected: false,
            connect: (): void => undefined,
            disconnect(): void {
                source.disconnected = true;
            },
        };
        FakeAudioContext.sources.push(source);

        return source;
    }

    createAnalyser(): FakeAnalyser {
        const analyser = new FakeAnalyser();
        FakeAudioContext.analysers.push(analyser);

        return analyser;
    }
}

/** How the microphone answers: a stream, or the error a browser gives. */
export type Answer = 'grant' | 'pending' | DOMException;

/** The page's microphone, answering every request with `answer`; what each was asked with is kept. */
export function stubMicrophone(answer: Answer = 'grant'): {
    asked: unknown[];
    streams: FakeStream[];
    grant(): void;
} {
    const asked: unknown[] = [];
    const streams: FakeStream[] = [];
    let release: (() => void) | null = null;
    const getUserMedia = (constraints: unknown): Promise<FakeStream> => {
        asked.push(constraints);
        const stream = new FakeStream();
        streams.push(stream);

        if (answer instanceof DOMException) {
            return Promise.reject(answer);
        }

        return answer === 'grant'
            ? Promise.resolve(stream)
            : new Promise((resolve) => {
                  release = () => resolve(stream);
              });
    };

    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
    });
    afterTest({
        destroy: () => Reflect.deleteProperty(navigator, 'mediaDevices'),
    });

    return { asked, streams, grant: () => release?.() };
}

/** A recorder and an audio context for the page, fresh for the test. */
export function stubRecording(): void {
    FakeRecorder.failStart = false;
    FakeRecorder.supported = () => true;
    FakeRecorder.made = [];
    FakeAnalyser.level = 0.5;
    FakeAudioContext.analysers = [];
    FakeAudioContext.sources = [];
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    afterTest({ destroy: () => vi.unstubAllGlobals() });
}

/** A decoder whose every sound is `samples`, one second long. */
export function stubDecoder(samples: readonly number[] | Error): void {
    vi.stubGlobal(
        'OfflineAudioContext',
        class {
            decodeAudioData(): Promise<AudioBuffer> {
                if (samples instanceof Error) {
                    return Promise.reject(samples);
                }

                const data = Float32Array.from(samples);

                return Promise.resolve({
                    length: data.length,
                    duration: 1,
                    sampleRate: data.length,
                    numberOfChannels: 1,
                    getChannelData: () => data,
                } as unknown as AudioBuffer);
            }
        },
    );
}
