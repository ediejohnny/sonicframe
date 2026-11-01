/**
 * What the frame draws with a view: the bars on screen come from the part in view, and the cursor
 * shows only while the position is in it; plugins get the view.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { PaintContext, ViewState } from '../../../src/index';
import { recordingOf } from '../../support/fakes';
import { mountShown, nextFrame } from '../../support/helpers';
import { HALVES, lastBars } from './zoom-harness';

describe('what the frame draws with a view', () => {
    it('draws the bars of the view only, from the detail of the peaks', async () => {
        // No growing bars, so every picture shows the peaks at their height.
        const { frame, canvas } = mountShown({
            zoom: true,
            peaks: HALVES,
            animate: false,
        });
        await nextFrame();
        const whole = lastBars(canvas);

        expect(whole.filter((bar) => bar.height === 40).length).toBe(
            whole.length / 2,
        );

        frame.setView(0.6, 0.9);
        await nextFrame();
        const zoomed = lastBars(canvas);

        expect(zoomed.length).toBeGreaterThan(0);
        expect(zoomed.every((bar) => bar.height === 40)).toBe(true);

        // New peaks: the zoomed bars come from them, not from the old ones.
        frame.setPeaks(HALVES.map((value) => 1 - value));
        await nextFrame();
        const flipped = lastBars(canvas);

        expect(flipped.length).toBeGreaterThan(0);
        expect(flipped.every((bar) => bar.height === 2)).toBe(true);
    });

    it('draws the same picture as without zoom while the whole sound is in view', async () => {
        const plain = mountShown({
            peaks: HALVES.map((v, i) => v * ((i % 7) / 7)),
        });
        await nextFrame();
        const before = lastBars(plain.canvas);
        plain.frame.destroy();
        plain.unmount();

        const { canvas } = mountShown({
            zoom: true,
            peaks: HALVES.map((v, i) => v * ((i % 7) / 7)),
        });
        await nextFrame();

        expect(lastBars(canvas)).toEqual(before);
    });

    it('shows the cursor only while the position is in view', async () => {
        const { frame, canvas } = mountShown({
            zoom: { view: { start: 0.5, end: 1 } },
            peaks: HALVES,
            colors: { cursor: 'red' },
        });
        const cursors = (): number =>
            recordingOf(canvas).ops.filter((op) => op === 'fillRect').length;

        frame.setProgress(0.2);
        await nextFrame();
        const hidden = cursors();

        frame.setProgress(0.7);
        await nextFrame();

        expect(hidden).toBe(0);
        expect(cursors()).toBe(1);
    });

    it('gives plugins the view, with xAt and ratioAt through it', async () => {
        const seen: { view: ViewState; x: number; ratio: number }[] = [];
        const { frame } = mountShown({ zoom: true, peaks: HALVES });
        frame.use({
            name: 'probe',
            draw: (paint: PaintContext) =>
                seen.push({
                    view: paint.view,
                    x: paint.xAt(0.625),
                    ratio: paint.ratioAt(100),
                }),
        });
        frame.setView(0.5, 0.75);
        await nextFrame();

        expect(seen.at(-1)).toMatchObject({
            view: { start: 0.5, end: 0.75, level: 4 },
            x: 100,
            ratio: 0.625,
        });
        expect(frame.view).toEqual(seen.at(-1)?.view);
    });
});
