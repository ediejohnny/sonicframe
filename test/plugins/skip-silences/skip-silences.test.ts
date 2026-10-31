/**
 * skipSilences on the page: during forward playback the playhead jumps past a silence, but a seek
 * into one does not trigger a jump.
 */

import { describe, expect, it } from 'vite-plus/test';
import { skipSilences } from '../../../src/index';
import { playTo } from '../../support/events';
import { fakeMedia, mount } from '../../support/helpers';

/** A 40-second sound playing on a frame that skips the silence from 5 s to 10 s; its media. */
function playing(): ReturnType<typeof fakeMedia> {
    const media = fakeMedia({ duration: 40, paused: false });
    mount({
        media,
        plugins: [skipSilences({ silences: [{ start: 5, end: 10 }] })],
    });

    return media;
}

describe('skipSilences', () => {
    it('jumps to just before the end of a silence while playing forward', () => {
        const media = playing();

        playTo(media, 4); // first tick only sets the baseline
        playTo(media, 4.5); // playing, before the silence
        playTo(media, 5.4); // runs into the silence

        // The default lead (0.1 s) keeps the start of the next word.
        expect(media.currentTime).toBeCloseTo(9.9);
    });

    it('does not jump right after a seek into a silence', () => {
        const media = playing();

        playTo(media, 1); // baseline
        playTo(media, 6); // a jump of 5s reads as a seek, not playback

        expect(media.currentTime).toBe(6);
    });
});
