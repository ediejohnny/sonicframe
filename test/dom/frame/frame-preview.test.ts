/**
 * Peaks drawn while a long sound is still read: the first ones grow in, and every later look at
 * them, or the loader's own peaks after them, keeps the bars where they stand.
 */

import { describe, expect, it } from 'vite-plus/test';
import { mountShown, nextFrame } from '../../support/helpers';
import { lastBars } from './zoom-harness';

/** Peaks at full height everywhere: every grown bar is as tall as the frame (40). */
const FULL = Array.from({ length: 100 }, () => 1);

/** The tallest bar of the last picture. */
function tallest(canvas: HTMLCanvasElement): number {
    return Math.max(...lastBars(canvas).map((bar) => bar.height));
}

/** Waits until the bars stopped growing in (they take 180 ms). */
async function grown(): Promise<void> {
    await new Promise((done) => setTimeout(done, 250));
    await nextFrame();
}

describe('peaks previewed while they are read', () => {
    it('grows the first preview in, and never again while the peaks come', async () => {
        let give: (peaks: number[]) => void = () => undefined;
        const { frame, canvas } = mountShown({
            peaks: () => new Promise<number[]>((resolve) => (give = resolve)),
        });

        frame.previewPeaks(FULL);
        await nextFrame();

        expect(tallest(canvas)).toBeLessThan(40);

        await grown();

        expect(tallest(canvas)).toBe(40);

        frame.previewPeaks(FULL);
        await nextFrame();

        expect(tallest(canvas)).toBe(40);

        const taken = new Promise<void>((done) => {
            frame.on('peakschange', () => done());
        });
        give(FULL);
        await taken;
        await nextFrame();

        expect(tallest(canvas)).toBe(40);
    });

    it('still grows in the peaks a new load brings after a preview', async () => {
        const { frame, canvas } = mountShown({ peaks: null });

        frame.previewPeaks(FULL);
        await grown();
        frame.setPeaks(() => Promise.resolve(FULL));
        await Promise.resolve();
        await Promise.resolve();
        await nextFrame();

        expect(tallest(canvas)).toBeLessThan(40);
    });
});
