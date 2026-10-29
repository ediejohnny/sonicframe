/**
 * Exporting a clip on the page. Without MediaRecorder (happy-dom has none) the export rejects with a
 * clear message, and it rejects when there is no audio. With a stand-in recorder and audio context
 * it never hangs: a cancelled request, audio that never starts and a recorder that refuses to start
 * all reject, and every one of them closes the audio it opened.
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { mount, fakeMedia, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

describe('frame.exportClip', () => {
    it('rejects when the browser cannot record', async () => {
        mounted = mount({
            media: fakeMedia({ duration: 40 }),
            peaks: [0.5, 0.5],
        });

        await expect(
            mounted.frame.exportClip({ audio: 'blob:abc' }),
        ).rejects.toThrow(/cannot record/);
    });

    it('rejects when there is no audio to record', async () => {
        mounted = mount({ peaks: [0.5, 0.5] });

        await expect(mounted.frame.exportClip()).rejects.toThrow(/no audio/);
    });
});

/** A recorder that keeps only its state; as in browsers, stopping an idle one does nothing and fires nothing. */
class FakeRecorder {
    static failStart = false;

    static isTypeSupported(): boolean {
        return true;
    }

    state: 'inactive' | 'recording' = 'inactive';
    readonly mimeType = 'video/webm';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;

    start(): void {
        if (FakeRecorder.failStart) {
            throw new DOMException('no tracks to record', 'NotSupportedError');
        }

        this.state = 'recording';
    }

    stop(): void {
        if (this.state === 'inactive') {
            return;
        }

        this.state = 'inactive';
        this.onstop?.();
    }
}

/** An audio context whose `resume` settles or, like a page before any user gesture, never does. */
class FakeAudioContext {
    static last: FakeAudioContext | null = null;
    static resumes = true;

    state: 'suspended' | 'running' | 'closed' = 'suspended';
    currentTime = 0;

    constructor() {
        FakeAudioContext.last = this;
    }

    resume(): Promise<void> {
        if (!FakeAudioContext.resumes) {
            return new Promise(() => undefined);
        }

        this.state = 'running';

        return Promise.resolve();
    }

    close(): Promise<void> {
        this.state = 'closed';

        return Promise.resolve();
    }

    createBufferSource(): { buffer: unknown; connect(): void; start(): void } {
        return {
            buffer: null,
            connect: () => undefined,
            start: () => undefined,
        };
    }

    createMediaStreamDestination(): {
        stream: { getAudioTracks(): never[] };
    } {
        return { stream: { getAudioTracks: () => [] } };
    }

    decodeAudioData(): Promise<AudioBuffer> {
        return Promise.resolve(sound(2));
    }
}

/** A decoded sound `seconds` long; the recorder stand-in never reads its samples. */
function sound(seconds: number): AudioBuffer {
    return {
        duration: seconds,
        getChannelData: () => new Float32Array(0),
    } as unknown as AudioBuffer;
}

/** Reads where a promise stands without waiting on it: 'pending', 'resolved', or its error. */
function watch(promise: Promise<unknown>): () => unknown {
    let state: unknown = 'pending';
    promise.then(
        () => {
            state = 'resolved';
        },
        (error: unknown) => {
            state = error;
        },
    );

    return () => state;
}

describe('frame.exportClip while recording', () => {
    const realFetch = globalThis.fetch;
    // The descriptor, not the method: it is only put back, and happy-dom may have none at all.
    const realCaptureStream = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        'captureStream',
    );

    beforeEach(() => {
        vi.useFakeTimers();
        FakeRecorder.failStart = false;
        FakeAudioContext.resumes = true;
        FakeAudioContext.last = null;
        Object.assign(globalThis, {
            MediaRecorder: FakeRecorder,
            AudioContext: FakeAudioContext,
        });
        HTMLCanvasElement.prototype.captureStream = function (): MediaStream {
            return {
                addTrack: () => undefined,
                getTracks: () => [],
            } as unknown as MediaStream;
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.fetch = realFetch;

        if (realCaptureStream === undefined) {
            delete (HTMLCanvasElement.prototype as { captureStream?: unknown })
                .captureStream;
        } else {
            Object.defineProperty(
                HTMLCanvasElement.prototype,
                'captureStream',
                realCaptureStream,
            );
        }
        Object.assign(globalThis, {
            MediaRecorder: undefined,
            AudioContext: undefined,
        });
    });

    it('rejects at once when the signal was aborted before, opening no audio', async () => {
        mounted = mount({ peaks: [0.5, 0.5] });
        const controller = new AbortController();
        controller.abort();

        const outcome = watch(
            mounted.frame.exportClip({
                audio: sound(2),
                signal: controller.signal,
            }),
        );
        await vi.advanceTimersByTimeAsync(0);

        expect((outcome() as Error).name).toBe('AbortError');
        expect(FakeAudioContext.last).toBeNull();
    });

    it('rejects and closes the audio when the recording never starts', async () => {
        FakeAudioContext.resumes = false;
        mounted = mount({ peaks: [0.5, 0.5] });

        const outcome = watch(mounted.frame.exportClip({ audio: sound(2) }));
        await vi.advanceTimersByTimeAsync(3_100);

        expect((outcome() as Error).message).toMatch(/never started/);
        expect(FakeAudioContext.last?.state).toBe('closed');
    });

    it('rejects at once and closes the audio when the recorder refuses to start', async () => {
        FakeRecorder.failStart = true;
        mounted = mount({ peaks: [0.5, 0.5] });

        const outcome = watch(mounted.frame.exportClip({ audio: sound(2) }));
        await vi.advanceTimersByTimeAsync(0);

        expect((outcome() as Error).name).toBe('NotSupportedError');
        expect(FakeAudioContext.last?.state).toBe('closed');
    });

    it('stops the download when the signal fires, and closes the audio', async () => {
        globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(new DOMException('aborted', 'AbortError')),
                );
            })) as typeof fetch;
        mounted = mount({ peaks: [0.5, 0.5] });
        const controller = new AbortController();

        const outcome = watch(
            mounted.frame.exportClip({
                audio: '/voice.mp3',
                signal: controller.signal,
            }),
        );
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        await vi.advanceTimersByTimeAsync(0);

        expect((outcome() as Error).name).toBe('AbortError');
        expect(FakeAudioContext.last?.state).toBe('closed');
    });
});
