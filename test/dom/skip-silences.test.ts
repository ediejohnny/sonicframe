/**
 * skipSilences on the page: during forward playback the playhead jumps past a silence, but a seek
 * into one does not trigger a jump.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { skipSilences } from '../../src/index';
import { FakeMedia, fakeMedia, mount, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

function advance(media: FakeMedia, time: number): void {
    media.currentTime = time;
    media.fire('timeupdate');
}

describe('skipSilences', () => {
    it('jumps to just before the end of a silence while playing forward', () => {
        const media = fakeMedia({ duration: 40, paused: false });
        mounted = mount({
            media,
            plugins: [skipSilences({ silences: [{ start: 5, end: 10 }] })],
        });

        advance(media, 4); // first tick only sets the baseline
        advance(media, 4.5); // playing, before the silence
        advance(media, 5.4); // runs into the silence

        // The default lead (0.1 s) keeps the start of the next word.
        expect(media.currentTime).toBeCloseTo(9.9);
    });

    it('does not jump right after a seek into a silence', () => {
        const media = fakeMedia({ duration: 40, paused: false });
        mounted = mount({
            media,
            plugins: [skipSilences({ silences: [{ start: 5, end: 10 }] })],
        });

        advance(media, 1); // baseline
        advance(media, 6); // a jump of 5s reads as a seek, not playback

        expect(media.currentTime).toBe(6);
    });
});
