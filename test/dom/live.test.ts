/**
 * Live frequency on the page: without Web Audio (happy-dom has none) the plugin refuses with an
 * error rather than muting playback, and setValues overrides the bars.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { liveFrequency } from '../../src/index';
import { mount, nextFrame, fakeMedia, type Mounted } from './helpers';
import { recordingOf, triggerResize, triggerVisible } from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

describe('live frequency', () => {
    it('reports an error when it cannot tap the audio', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media });

        const errors: unknown[] = [];
        mounted.frame.on('error', (error) => errors.push(error));
        mounted.frame.use(liveFrequency());

        expect(errors).toHaveLength(1);
    });
});

describe('setValues', () => {
    it('draws the overridden bars', async () => {
        mounted = mount({ lazy: false });
        triggerResize(mounted.canvas, { width: 200, height: 40 });
        triggerVisible(mounted.canvas, true);

        mounted.frame.setValues([1, 0.2, 0.8, 0.1, 0.9]);
        await nextFrame();

        expect(recordingOf(mounted.canvas).ops).toContain('fill');
    });
});
