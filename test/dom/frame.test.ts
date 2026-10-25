/**
 * The page-level test harness, proven on the simplest real behaviour: a click on the frame seeks the
 * media it follows. If this runs, happy-dom, the fakes and the mount helper are wired correctly.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { clickAt, fakeMedia, mount, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

describe('pointer seeking in the page', () => {
    it('a click at 25% seeks the media to 25% of its duration', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media }, { left: 0, top: 0, width: 200, height: 40 });

        clickAt(mounted.container, 50);

        expect(media.currentTime).toBe(10);
    });

    it('does not seek when the frame is not interactive', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media, interact: false });

        clickAt(mounted.container, 50);

        expect(media.currentTime).toBe(0);
    });
});
