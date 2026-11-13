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
import type { ClipOptions } from '../../../src/dom/clip/clip';
import { recordingOf } from '../../support/fakes';
import { mount, fakeMedia, type Mounted } from '../../support/helpers';
import { FakeRecorder } from '../../support/recording';

let mounted: Mounted | null = null;

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

/** An audio context whose `resume` settles or, like a page before any user gesture, never does. */
class FakeAudioContext {
    static last: FakeAudioContext | null = null;
    static resumes = true;
    /** How long, in seconds, every decoded sound turns out to be. */
    static decoded = 2;

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
        return Promise.resolve(sound(FakeAudioContext.decoded));
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
        FakeAudioContext.decoded = 2;
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

    /** Stands in for `fetch` with a small file, counting the downloads. */
    function smallDownloads(): { count: number } {
        const downloads = { count: 0 };
        globalThis.fetch = (() => {
            downloads.count++;

            return Promise.resolve(new Response(new Uint8Array(16)));
        }) as typeof fetch;

        return downloads;
    }

    it("refuses its own media's over-long source before downloading anything", async () => {
        const downloads = smallDownloads();
        const media = fakeMedia({ duration: 20 * 60 });
        Object.assign(media, { currentSrc: '/long.mp3' });
        mounted = mount({ media, peaks: [0.5, 0.5] });

        const outcome = watch(mounted.frame.exportClip());
        await vi.advanceTimersByTimeAsync(0);

        expect((outcome() as Error).message).toMatch(/too long/);
        expect(downloads.count).toBe(0);
        expect(FakeAudioContext.last).toBeNull();
    });

    it('refuses an over-long source right after decoding when its length was not known', async () => {
        smallDownloads();
        FakeAudioContext.decoded = 20 * 60;
        mounted = mount({ peaks: [0.5, 0.5] });

        const outcome = watch(mounted.frame.exportClip({ audio: '/long.mp3' }));
        await vi.advanceTimersByTimeAsync(0);

        expect((outcome() as Error).message).toMatch(/too long/);
        expect(FakeAudioContext.last?.state).toBe('closed');
    });

    it('records a longer source when the app raises the limit', async () => {
        smallDownloads();
        FakeAudioContext.decoded = 20 * 60;
        mounted = mount({ peaks: [0.5, 0.5] });

        const outcome = watch(
            mounted.frame.exportClip({
                audio: '/long.mp3',
                maxSourceSeconds: 60 * 60,
            }),
        );
        await vi.advanceTimersByTimeAsync(121_100);

        expect(outcome()).toBe('resolved');
    });

    it('holds an Infinity limit at 2 hours of source, the most it may decode', async () => {
        smallDownloads();
        mounted = mount({ peaks: [0.5, 0.5] });

        FakeAudioContext.decoded = 3 * 60 * 60;
        const long = watch(
            mounted.frame.exportClip({
                audio: '/long.mp3',
                maxSourceSeconds: Infinity,
            }),
        );
        await vi.advanceTimersByTimeAsync(0);
        expect((long() as Error).message).toMatch(/too long/);

        FakeAudioContext.decoded = 2 * 60 * 60;
        const most = watch(
            mounted.frame.exportClip({
                audio: '/long.mp3',
                maxSourceSeconds: Infinity,
                end: 1,
            }),
        );
        await vi.advanceTimersByTimeAsync(2_100);
        expect(most()).toBe('resolved');
    });

    it('cuts a clip at 120 s, or at maxSeconds up to 600, refusing one past it', async () => {
        smallDownloads();
        FakeAudioContext.decoded = 20 * 60;
        mounted = mount({ peaks: [0.5, 0.5] });
        const { frame } = mounted;
        const lengths: number[] = [];
        const record = (options: Partial<ClipOptions>): Promise<void> =>
            frame
                .exportClip({ audio: '/long.mp3', ...options })
                .then((clip) => {
                    lengths.push(clip.duration);
                });

        const plain = record({ maxSourceSeconds: 3600 });
        await vi.advanceTimersByTimeAsync(121_100);
        await plain;
        const raised = record({ maxSourceSeconds: 3600, maxSeconds: 600 });
        await vi.advanceTimersByTimeAsync(601_100);
        await raised;

        expect(lengths).toEqual([120, 600]);
        await expect(record({ maxSeconds: 601 })).rejects.toThrow(
            new RangeError(
                'sonicframe: maxSeconds goes past its most, 600 (601)',
            ),
        );
    });

    it('records at 8 Mbps, or at the bitrate asked up to 50 Mbps, refusing one past it', async () => {
        mounted = mount({ peaks: [0.5, 0.5] });
        const { frame } = mounted;
        const bitrates = async (
            bitrate?: number,
        ): Promise<number | undefined> => {
            const done = frame.exportClip({ audio: sound(1), bitrate });
            await vi.advanceTimersByTimeAsync(2_100);
            await done;

            return FakeRecorder.made.at(-1)?.options.videoBitsPerSecond;
        };

        expect(await bitrates()).toBe(8_000_000);
        expect(await bitrates(50_000_000)).toBe(50_000_000);
        await expect(
            frame.exportClip({ audio: sound(1), bitrate: 50_000_001 }),
        ).rejects.toThrow('bitrate goes past its most, 50000000');
    });

    it('takes a source and a clip of up to maxBytes, 100 MiB unless asked, up to 1 GiB', async () => {
        smallDownloads();
        mounted = mount({ peaks: [0.5, 0.5] });

        await expect(
            mounted.frame.exportClip({ audio: '/a.mp3', maxBytes: 10 }),
        ).rejects.toThrow('too large');
        await expect(
            mounted.frame.exportClip({
                audio: '/a.mp3',
                maxBytes: 1_073_741_825,
            }),
        ).rejects.toThrow('maxBytes goes past its most, 1073741824');
    });

    it('draws a video up to 3840 × 2160 when asked; past that, 3840 × 2160', async () => {
        mounted = mount({ peaks: [0.5, 0.5] });
        const made = vi.spyOn(document, 'createElement');
        const done = mounted.frame.exportClip({
            audio: sound(1),
            width: 1e9,
            height: 1e9,
        });
        await vi.advanceTimersByTimeAsync(2_100);
        await done;
        const canvas = made.mock.results.find(
            (result) => result.value instanceof HTMLCanvasElement,
        )?.value as HTMLCanvasElement;
        made.mockRestore();

        expect([canvas.width, canvas.height]).toEqual([3840, 2160]);
    });

    it('keeps the wave in the middle of the room above the caption', async () => {
        mounted = mount({ peaks: [0.5, 0.5] });
        // Every element made from here on is the clip's: the one canvas is the video's.
        const made = vi.spyOn(document, 'createElement');

        const outcome = watch(
            mounted.frame.exportClip({
                audio: sound(2),
                caption: 'Reply at 0:42',
            }),
        );
        await vi.advanceTimersByTimeAsync(3_100);
        const clip = made.mock.results
            .map((result) => result.value as unknown)
            .find((element) => element instanceof HTMLCanvasElement);
        made.mockRestore();

        expect(outcome()).toBe('resolved');
        expect(clip).toBeInstanceOf(HTMLCanvasElement);
        const bars = recordingOf(clip as HTMLCanvasElement)
            .paths.flatMap((path) => path.calls)
            .filter(([name]) => name === 'rect' || name === 'roundRect');
        expect(bars.length).toBeGreaterThan(0);

        // 720 pixels tall less the caption's 28: the wave's middle is at 346.
        for (const [, , y, , height] of bars) {
            expect(
                Math.abs(Number(y) + Number(height) / 2 - 346),
            ).toBeLessThanOrEqual(1);
        }
    });
});
