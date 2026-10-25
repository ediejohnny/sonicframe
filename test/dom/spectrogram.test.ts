/**
 * The spectrogram on the page: from ready-made samples it computes (in slices) and draws its image
 * onto the frame, without throwing under happy-dom's stand-in canvas.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { spectrogram } from '../../src/index';
import { mount, nextFrame, type Mounted } from './helpers';
import { recordingOf, triggerResize, triggerVisible } from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

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

        // Let the chunked job finish, then let a frame paint.
        await new Promise((resolve) => setTimeout(resolve, 40));
        await nextFrame();

        expect(recordingOf(mounted.canvas).ops).toContain('drawImage');
    });
});
