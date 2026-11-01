/**
 * Playing a range through the controller: it loops or stops at its end, at the media's own pace
 * off screen too, and a seek out of it abandons it.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { MediaEventType } from '../../../src/core/frame/media-events';
import { loaded, setup, type FakeMedia } from './controller-harness';

describe('ranges', () => {
    /** Playback reaches the end of the media; a browser then reports these events, already ended. */
    function playToTheEnd(
        media: FakeMedia,
        fire: (...types: MediaEventType[]) => void,
    ): void {
        media.advance(media.duration);
        media.ended = true;
        media.paused = true;
        fire('timeupdate', 'pause', 'ended');
    }

    const rangeEnds = (events: [string, unknown[]][]) =>
        events.filter(([name]) => name === 'rangeend');

    it('starts a looping range again when the media ends inside it', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(20, 30, true);
        playToTheEnd(media, fire);

        expect(media.currentTime).toBe(20);
        expect(media.plays).toBe(2);
        expect(rangeEnds(events)).toEqual([]);
    });

    it('ends a range that runs to the end of the media, and says so once', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(20, 30);
        playToTheEnd(media, fire);
        fire('ended');

        expect(rangeEnds(events)).toHaveLength(1);
    });

    it('stops a range off screen at the media own pace', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(5, 10);
        media.advance(10.2);
        fire('timeupdate');

        expect(media.paused).toBe(true);
        expect(rangeEnds(events)).toHaveLength(1);
    });

    it('loops a range off screen at the media own pace', () => {
        const { controller, media, fire, events } = setup();
        loaded(media, 30);
        controller.bind(media);

        controller.playRange(5, 10, true);
        media.advance(10.2);
        fire('timeupdate');

        expect(media.currentTime).toBe(5);
        expect(rangeEnds(events)).toEqual([]);
    });

    it('forgets a range the listener seeks out of, past its end or before its start', () => {
        for (const seconds of [12, 2]) {
            const { controller, media, fire, events } = setup();
            loaded(media, 30);
            controller.bind(media);

            controller.playRange(5, 10);
            controller.seekTo(seconds / 30);
            fire('timeupdate');

            expect(media.currentTime).toBe(seconds);
            expect(media.paused).toBe(false);
            expect(rangeEnds(events)).toEqual([]);
        }
    });
});
