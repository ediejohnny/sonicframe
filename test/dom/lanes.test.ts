/**
 * Lanes on the page: a lane insets the canvas (the wave shrinks), a press on a lane is not a seek,
 * and the frame tells listeners and plugins when the wave area changes size.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { FrameGeometry, Plugin } from '../../src/index';
import { clickAt, fakeMedia, mount, type Mounted } from './helpers';
import { triggerResize } from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

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
