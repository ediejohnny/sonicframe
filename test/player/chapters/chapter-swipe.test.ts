/**
 * Off the wave, a finger's swipe opens and closes the player's chapters list, when asked.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cleanUp, host } from './chapters-harness';
import { list, make, sizes, swipe } from './panels-harness';

afterEach(cleanUp);

describe('the swipe', () => {
    function meta(): HTMLElement {
        return (host as HTMLElement).querySelector('.sonicframe-chapter-now')
            ?.parentElement as HTMLElement;
    }

    it('opens the list with a finger swiping up off the wave, and closes it the other way', () => {
        make({ type: 'popover', swipe: true });
        sizes({ left: 100, top: 100 });

        swipe(meta(), 0, -80);
        expect(list().hidden).toBe(false);

        swipe(meta(), 0, 80);
        expect(list().hidden).toBe(true);
    });

    it('leaves the wave, the mouse, short moves and the other axis alone', () => {
        make({ type: 'popover', swipe: true });
        sizes({ left: 100, top: 100 });
        const wave = (host as HTMLElement).querySelector(
            '[role="slider"]',
        ) as HTMLElement;

        // One at a time: a press outside an open list would close it and hide a wrong opening.
        swipe(wave, 0, -80);
        expect(list().hidden).toBe(true);
        swipe(meta(), 0, -80, 'mouse');
        expect(list().hidden).toBe(true);
        swipe(meta(), 0, -20);
        expect(list().hidden).toBe(true);
        // Long enough up, but more sideways than up.
        swipe(meta(), -90, -60);
        expect(list().hidden).toBe(true);
    });

    it('takes its own direction, and keeps the page scrolling the other way', () => {
        make({ type: 'popover', swipe: true, swipeDirection: 'left' });
        sizes({ left: 100, top: 100 });

        expect(meta().style.getPropertyValue('touch-action')).toBe('pan-y');
        swipe(meta(), 0, -80);
        expect(list().hidden).toBe(true);
        swipe(meta(), -80, 0);
        expect(list().hidden).toBe(false);
    });

    it('is off by default, and touches nothing', () => {
        make({ type: 'popover' });
        sizes({ left: 100, top: 100 });

        swipe(meta(), 0, -80);
        expect(list().hidden).toBe(true);
        expect(meta().style.getPropertyValue('touch-action')).toBe('');
    });
});
