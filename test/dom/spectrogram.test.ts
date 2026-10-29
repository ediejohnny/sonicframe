/**
 * The spectrogram on the page: from ready-made samples it computes (in slices) and draws its image
 * onto the frame, without throwing under happy-dom's stand-in canvas.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { spectrogram } from '../../src/index';
import { mount, nextFrame, type Mounted } from './helpers';
import { recordingOf, triggerResize, triggerVisible } from './fakes';

let mounted: Mounted | null = null;
const realFetch = globalThis.fetch;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
    globalThis.fetch = realFetch;
});

/** Stands in for `fetch` with a download that never ends, keeping each call's abort signal. */
function endlessDownloads(): (AbortSignal | undefined)[] {
    const signals: (AbortSignal | undefined)[] = [];
    globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal ?? undefined);

        return new Promise<Response>(() => undefined);
    }) as typeof fetch;

    return signals;
}

describe('the spectrogram plugin', () => {
    it('computes from samples and draws its image', async () => {
        const rate = 8000;
        const samples = Float32Array.from({ length: rate }, (_, i) =>
            Math.sin((2 * Math.PI * 1000 * i) / rate),
        );
        mounted = mount({
            lazy: false,
            plugins: [
                spectrogram({
                    samples,
                    sampleRate: rate,
                    columns: 16,
                    rows: 32,
                    fftSize: 256,
                }),
            ],
        });

        triggerResize(mounted.canvas, { width: 200, height: 40 });
        triggerVisible(mounted.canvas, true);

        // The job runs in slices between frames: wait for the picture, not for a fixed time, so a busy
        // machine only makes this slower, never red.
        const { canvas } = mounted;
        await vi.waitFor(
            () => expect(recordingOf(canvas).ops).toContain('drawImage'),
            { timeout: 3_000, interval: 20 },
        );
    });

    it('stops downloading the audio when the frame is destroyed', async () => {
        const downloads = endlessDownloads();
        mounted = mount({
            lazy: false,
            plugins: [spectrogram({ source: '/voice.mp3' })],
        });
        triggerResize(mounted.canvas, { width: 200, height: 40 });
        triggerVisible(mounted.canvas, true);
        await nextFrame();

        expect(downloads).toHaveLength(1);

        mounted.frame.destroy();

        expect(downloads[0]?.aborted).toBe(true);
    });
});
