/**
 * Lanes on the page: a lane insets the canvas (the wave shrinks), a press on a lane is not a seek,
 * and the frame tells listeners and plugins when the wave area changes size.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { FrameGeometry, Plugin } from '../../../src/index';
import { triggerResize } from '../../support/fakes';
import {
    boxOf,
    clickAt,
    fakeMedia,
    mount,
    mountShown,
    type Mounted,
} from '../../support/helpers';

let mounted: Mounted | null = null;

describe('lanes around the bars', () => {
    it('insets the canvas to make room for a lane below', () => {
        mounted = mount(undefined, { left: 0, top: 0, width: 200, height: 32 });

        const lane = mounted.frame.addLane('below', 14);

        expect(mounted.canvas.style.getPropertyValue('top')).toBe('0px');
        expect(mounted.canvas.style.getPropertyValue('height')).toBe(
            'calc(100% - 14px)',
        );
        expect(lane.element.style.getPropertyValue('display')).toBe('block');
    });

    it('keeps the overlay over the bars, clear of the lanes, made before or after them', () => {
        mounted = mount(undefined, { left: 0, top: 0, width: 200, height: 64 });
        const early = mounted.frame.overlay();
        const above = mounted.frame.addLane('above', 14);
        mounted.frame.addLane('below', 10);

        expect(early.style.getPropertyValue('top')).toBe('14px');
        expect(early.style.getPropertyValue('bottom')).toBe('10px');

        above.remove();

        expect(early.style.getPropertyValue('top')).toBe('0px');
        expect(early.style.getPropertyValue('bottom')).toBe('10px');

        mounted.frame.destroy();
        mounted.unmount();
        mounted = mount(undefined, { left: 0, top: 0, width: 200, height: 64 });
        mounted.frame.addLane('above', 14);
        const late = mounted.frame.overlay();

        expect(late.style.getPropertyValue('top')).toBe('14px');
        expect(late.style.getPropertyValue('bottom')).toBe('0px');
    });

    it("places the lanes on refresh, for the container's height at that moment", () => {
        // A frame made in a box not yet on the page: 16 px leaves the wave 2 px beside a 14 px lane,
        // under the 8 px it keeps, so the lane waits.
        mounted = mount(undefined, { left: 0, top: 0, width: 200, height: 16 });
        mounted.frame.addLane('below', 14);

        expect(mounted.canvas.style.getPropertyValue('height')).toBe('100%');

        // The box joins the page at its real height; nothing has measured the canvas yet.
        boxOf(mounted.container, { left: 0, top: 0, width: 200, height: 64 });
        mounted.frame.refresh();

        expect(mounted.canvas.style.getPropertyValue('height')).toBe(
            'calc(100% - 14px)',
        );
    });

    it('tells listeners the new wave size at once when a lane comes, not at the next size report', () => {
        mounted = mountShown(undefined, {
            left: 0,
            top: 0,
            width: 200,
            height: 40,
        });
        const heights: number[] = [];
        mounted.frame.on('resize', (geometry) => heights.push(geometry.height));

        // The lane takes 14 of the 40 px: the canvas is 26 tall now.
        boxOf(mounted.canvas, { left: 0, top: 0, width: 200, height: 26 });
        mounted.frame.addLane('below', 14);

        expect(heights.at(-1)).toBe(26);
    });

    it('gives the room back to the wave when the lane is removed', () => {
        mounted = mount(undefined, { left: 0, top: 0, width: 200, height: 32 });

        const lane = mounted.frame.addLane('below', 14);
        lane.remove();

        expect(mounted.canvas.style.getPropertyValue('height')).toBe('100%');
    });

    it('does not seek when the press lands on a lane', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media }, { left: 0, top: 0, width: 200, height: 40 });

        const lane = mounted.frame.addLane('below', 14);
        clickAt(lane.element, 50);

        expect(media.currentTime).toBe(0);
    });

    it('reports the wave geometry on resize, to listeners and plugins', () => {
        const seen: FrameGeometry[] = [];
        const plugin: Plugin = {
            name: 'spy',
            resize: (geometry) => {
                seen.push(geometry);
            },
        };
        mounted = mount(
            { lazy: false, plugins: [plugin] },
            { left: 0, top: 0, width: 200, height: 40 },
        );

        const events: FrameGeometry[] = [];
        mounted.frame.on('resize', (geometry) => events.push(geometry));

        triggerResize(mounted.canvas, { width: 200, height: 40 });

        expect(events.at(-1)?.width).toBe(200);
        expect(seen.at(-1)?.width).toBe(200);
    });
});
