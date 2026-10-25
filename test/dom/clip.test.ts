/**
 * Exporting a clip on the page: under happy-dom there is no MediaRecorder, so the frame's export
 * rejects with a clear message rather than throwing uncaught — and it rejects when there is no audio.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { fakeMedia, mount, type Mounted } from './helpers';

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
