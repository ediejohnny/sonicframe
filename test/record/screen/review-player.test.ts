/**
 * The player of a recording in review sits on one line with the screen's buttons: the buttons beside
 * it center on its bars, as its own play button does, and the rows under its wave start under the
 * play button unless the app's look says otherwise.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { RecorderScreen } from '../../../src/record';
import { triggerResize } from '../../support/fakes';
import {
    layOut,
    press,
    screen,
    shiftOf,
    useRecordingPage,
} from './screen-harness';

useRecordingPage();

/** How far the screen's button of `name` is moved up or down. */
function shift(made: RecorderScreen, name: string): string {
    return shiftOf(made.element, name);
}

/** The row under the review player's wave that holds its time. */
function timeRow(made: RecorderScreen): HTMLElement | null {
    return (
        made.player?.element.querySelector('.sonicframe-time')?.parentElement ??
        null
    );
}

describe('the player of a recording in review', () => {
    it("brings the buttons beside it to its bars' middle when it is shown", async () => {
        const { made } = screen();
        await press(made, 'record');
        layOut();
        await press(made, 'stop');

        expect(shift(made, 'discard')).toBe('0px -10px');
        expect(shift(made, 'send')).toBe('0px -10px');
        // The player itself stays where the row puts it.
        expect(shift(made, 'recorder-player')).toBe('');
    });

    it('brings them there again when its size changes', async () => {
        const { made } = screen();
        await press(made, 'record');
        await press(made, 'stop');
        layOut();
        const review = made.element.querySelector(
            '.sonicframe-recorder-player',
        ) as HTMLElement;
        triggerResize(review, { width: 300, height: 60 });

        expect(shift(made, 'discard')).toBe('0px -10px');
        expect(shift(made, 'send')).toBe('0px -10px');
    });

    it('leaves the buttons where the row puts them when the app aligns them otherwise', async () => {
        for (const align of ['center', 'start', 'end'] as const) {
            const { made } = screen({ align });
            await press(made, 'record');
            layOut();
            await press(made, 'stop');
            triggerResize(
                made.element.querySelector(
                    '.sonicframe-recorder-player',
                ) as Element,
                { width: 300, height: 60 },
            );

            expect(shift(made, 'send'), align).toBe('');
            vi.restoreAllMocks();
        }
    });

    it('takes an unknown alignment for the bars', async () => {
        const { made } = screen({ align: 'middle' as unknown as 'center' });
        await press(made, 'record');
        layOut();
        await press(made, 'stop');

        expect(shift(made, 'send')).toBe('0px -10px');
    });

    it('starts the rows under its wave under the play button', async () => {
        const { made } = screen({
            look: { line: ['play', 'wave'], meta: ['time'] },
        });
        await press(made, 'record');
        await press(made, 'stop');

        expect(timeRow(made)?.style.getPropertyValue('grid-column')).toBe(
            '1 / -1',
        );
    });

    it("keeps them at the wave's edge when the app's look asks for it", async () => {
        const { made } = screen({
            look: {
                line: ['play', 'wave'],
                meta: ['time'],
                underStart: 'wave',
            },
        });
        await press(made, 'record');
        await press(made, 'stop');

        expect(timeRow(made)?.style.getPropertyValue('grid-column')).toBe('');
    });
});
