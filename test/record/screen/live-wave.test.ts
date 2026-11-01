/**
 * The live wave while recording keeps moving however narrow it is: a bar never holds more than two
 * slices of the levels (a tenth of a second), so a narrow wave scrolls through fewer seconds rather
 * than squeezing the whole window into a few bars that barely change.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { RecorderScreen } from '../../../src/record';
import { triggerResize } from '../../support/fakes';
import {
    liveWaveFeed,
    press,
    screen,
    useRecordingPage,
} from './screen-harness';

useRecordingPage();

/** Lays the live wave out `width` CSS pixels wide (bars 3 wide with gaps of 2: one bar every 5). */
function waveWidth(made: RecorderScreen, width: number): void {
    const canvas = made.element.querySelector(
        '.sonicframe-recorder-wave canvas',
    ) as Element;
    triggerResize(canvas, { width, height: 40 });
}

describe('the live wave', () => {
    it('gives a narrow wave the last two slices a bar, so its bars keep moving', async () => {
        const fed = liveWaveFeed();
        const { made } = screen();
        await press(made, 'record');
        // 25 pixels: 5 bars.
        waveWidth(made, 25);
        await vi.advanceTimersByTimeAsync(3000);

        expect(fed.at(-1)).toHaveLength(10);
    });

    it('keeps the whole window when the bars hold it', async () => {
        const fed = liveWaveFeed();
        const { made } = screen();
        await press(made, 'record');
        // 500 pixels: 100 bars, two slices each for 10 seconds at 20 a second.
        waveWidth(made, 500);
        await vi.advanceTimersByTimeAsync(1000);

        expect(fed.at(-1)).toHaveLength(200);
    });

    it('leaves the whole recording to fit, as asked', async () => {
        const fed = liveWaveFeed();
        const { made } = screen({ live: 'fit' });
        await press(made, 'record');
        waveWidth(made, 25);
        await vi.advanceTimersByTimeAsync(2000);

        // Every slice from 0 to 40, at 20 a second: no cap to the 5 bars.
        expect(fed.at(-1)).toHaveLength(41);
    });
});
