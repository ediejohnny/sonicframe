/**
 * The timeline on the page: once the frame has a size and a duration, a lane fills with labelled
 * ticks on round seconds.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { timeline } from '../../src/index';
import { fakeMedia, mount, type Mounted } from './helpers';
import { triggerResize, triggerVisible } from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

describe('the timeline plugin', () => {
    it('lays out labelled ticks once sized', () => {
        const media = fakeMedia({ duration: 60 });
        mounted = mount(
            { media, lazy: false, plugins: [timeline()] },
            { left: 0, top: 0, width: 300, height: 40 },
        );

        triggerResize(mounted.canvas, { width: 300, height: 40 });
        triggerVisible(mounted.canvas, true);

        expect(mounted.container.textContent).toContain('0:10');
    });

    it('redraws the ruler when the duration changes while the position stays put', () => {
        mounted = mount(
            { duration: 60, lazy: false, plugins: [timeline()] },
            { left: 0, top: 0, width: 300, height: 40 },
        );
        triggerResize(mounted.canvas, { width: 300, height: 40 });
        triggerVisible(mounted.canvas, true);

        mounted.frame.setDuration(600);

        expect(mounted.container.textContent).toContain('10:00');
        expect(mounted.container.textContent).not.toContain('0:50');
    });
});
