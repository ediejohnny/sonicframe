/**
 * The pointer with a view: a press maps through the view, two fingers zoom and drag it, and a drag
 * held at an edge scrolls it, each only when switched on.
 */

import { describe, expect, it } from 'vite-plus/test';
import { pointerEvent } from '../../support/events';
import { fakeMedia, mountShown, nextFrame } from '../../support/helpers';
import { HALVES } from './zoom-harness';

describe('a press with a view', () => {
    it('seeks to the sound under the pointer through the view', () => {
        const media = fakeMedia({ duration: 100 });
        const { frame, container } = mountShown({ zoom: true, media });
        frame.setView(0.5, 0.75);

        container.dispatchEvent(pointerEvent('pointerdown', 100));
        container.dispatchEvent(pointerEvent('pointerup', 100));

        expect(media.currentTime).toBeCloseTo(62.5, 9);
    });
});

describe('two fingers', () => {
    it('zoom with the distance between them and drag the view with their middle', () => {
        const { frame, container } = mountShown({
            zoom: { pinch: true },
            peaks: HALVES,
        });
        const touch = (id: number, primary: boolean) => ({
            pointerId: id,
            pointerType: 'touch',
            isPrimary: primary,
        });

        container.dispatchEvent(
            pointerEvent('pointerdown', 50, touch(1, true)),
        );
        container.dispatchEvent(
            pointerEvent('pointerdown', 150, touch(2, false)),
        );
        container.dispatchEvent(
            pointerEvent('pointermove', 250, touch(2, false)),
        );

        // Twice as far apart: 2×. The middle (100 px, the sound's middle) moved to 150 px.
        expect(frame.view.level).toBeCloseTo(2, 9);
        expect(frame.view.start).toBeCloseTo(0.125, 9);

        // Three times as far apart: 3×, the middle now at 200 px.
        container.dispatchEvent(
            pointerEvent('pointermove', 350, touch(2, false)),
        );
        expect(frame.view.level).toBeCloseTo(3, 9);
        expect(frame.view.start).toBeCloseTo(0.5 - 1 / 3, 9);

        container.dispatchEvent(
            pointerEvent('pointerup', 350, touch(2, false)),
        );
        container.dispatchEvent(pointerEvent('pointerup', 50, touch(1, true)));
    });

    it('do nothing unless switched on', () => {
        const { frame, container } = mountShown({ zoom: true, peaks: HALVES });

        container.dispatchEvent(
            pointerEvent('pointerdown', 50, {
                pointerType: 'touch',
                pointerId: 1,
            }),
        );
        container.dispatchEvent(
            pointerEvent('pointerdown', 150, {
                pointerType: 'touch',
                pointerId: 2,
                isPrimary: false,
            }),
        );
        container.dispatchEvent(
            pointerEvent('pointermove', 250, {
                pointerType: 'touch',
                pointerId: 2,
                isPrimary: false,
            }),
        );

        expect(frame.view.level).toBe(1);
    });
});

describe('dragging at an edge', () => {
    it('scrolls the view, and the drag lands on the sound now under the pointer', async () => {
        const media = fakeMedia({ duration: 100 });
        const { frame, container } = mountShown({
            zoom: { edgeScroll: true, edgeSpeed: 10 },
            media,
            peaks: HALVES,
        });
        const sources: string[] = [];
        frame.on('viewchange', (_view, source) => sources.push(source));
        frame.setView(0.25, 0.5);

        container.dispatchEvent(pointerEvent('pointerdown', 100));
        container.dispatchEvent(pointerEvent('pointermove', 195));

        for (let i = 0; i < 4; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await nextFrame();
        }

        const view = frame.view;
        const dragged = frame.progress;
        container.dispatchEvent(pointerEvent('pointerup', 195));

        expect(view.start).toBeGreaterThan(0.25);
        expect(sources).toContain('edge');
        // While held, the drag already shows the sound now under the pointer.
        expect(dragged).toBeCloseTo(
            view.start + (195 / 200) * (view.end - view.start),
            9,
        );
        // The media lands there, in seconds, to the microsecond a time is kept to.
        expect(media.currentTime).toBeCloseTo(
            (view.start + (195 / 200) * (view.end - view.start)) * 100,
            6,
        );
    });

    it('scrolls back at the left edge, and never in the middle', async () => {
        const { frame, container } = mountShown({
            zoom: { edgeScroll: true, edgeSpeed: 10 },
            peaks: HALVES,
        });
        frame.setView(0.5, 0.75);

        container.dispatchEvent(pointerEvent('pointerdown', 100));
        container.dispatchEvent(pointerEvent('pointermove', 110));

        for (let i = 0; i < 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await nextFrame();
        }

        expect(frame.view.start).toBe(0.5);

        container.dispatchEvent(pointerEvent('pointermove', 4));

        for (let i = 0; i < 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await nextFrame();
        }

        container.dispatchEvent(pointerEvent('pointerup', 4));
        expect(frame.view.start).toBeLessThan(0.5);
    });

    it('stays still unless switched on', async () => {
        const { frame, container } = mountShown({ zoom: true, peaks: HALVES });
        frame.setView(0.25, 0.5);

        container.dispatchEvent(pointerEvent('pointerdown', 100));
        container.dispatchEvent(pointerEvent('pointermove', 199));
        await new Promise((resolve) => setTimeout(resolve, 40));
        await nextFrame();
        container.dispatchEvent(pointerEvent('pointerup', 199));

        expect(frame.view.start).toBeCloseTo(0.25, 12);
    });
});
