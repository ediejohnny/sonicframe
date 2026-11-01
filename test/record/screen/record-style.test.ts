/**
 * The record button's style (`recordStyle`): the screen's dot by default, a red button, a
 * microphone, or a retro REC badge; its red read as numbers, and the app's own icon over any style.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { RecorderScreen } from '../../../src/record';
import { button, screen, useRecordingPage } from './screen-harness';

useRecordingPage();

const DOT = 'M12 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12z';

/** The path the record button draws. */
function drawn(made: RecorderScreen): string | null | undefined {
    return button(made, 'record')?.querySelector('path')?.getAttribute('d');
}

/** One of the record button's own styles. */
function style(made: RecorderScreen, name: string): string {
    return button(made, 'record')?.style.getPropertyValue(name) ?? '';
}

describe('the record button', () => {
    it('draws a microphone with the mic style', () => {
        const { made } = screen({ recordStyle: 'mic' });

        expect(drawn(made)).toBe(
            'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zM6 10h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V19h3v2H8v-2h3v-3.1A6 6 0 0 1 6 10z',
        );
        expect(button(made, 'record')?.getAttribute('aria-label')).toBe(
            'Record',
        );
    });

    it("paints the red style in the app's red, read as numbers", () => {
        const blue = screen({ recordStyle: 'red', recordColor: '#0000ff' });
        expect(style(blue.made, 'background-color')).toBe('rgba(0, 0, 255, 1)');
        expect(drawn(blue.made)).toBe(DOT);

        const hostile = screen({
            recordStyle: 'red',
            recordColor: 'url(https://evil.example/x)',
        });
        expect(style(hostile.made, 'background-color')).toMatch(/^rgba\(/);
    });

    it('shows a REC badge with its dot, named Record for screen readers', () => {
        const { made } = screen({ recordStyle: 'rec', recordColor: '#ff0000' });
        const record = button(made, 'record');
        const letters = record?.querySelector('.sonicframe-rec-letters');

        expect(letters?.textContent).toBe('REC');
        expect(letters?.getAttribute('aria-hidden')).toBe('true');
        expect(record?.getAttribute('aria-label')).toBe('Record');
        expect(drawn(made)).toBe(DOT);
        expect(style(made, 'color')).toBe('rgba(255, 0, 0, 1)');
        expect(style(made, 'border-color')).toBe('rgba(255, 0, 0, 1)');
    });

    it("takes the app's own record icon over any style", () => {
        for (const recordStyle of ['mic', 'rec'] as const) {
            const { made } = screen({
                recordStyle,
                icons: { record: 'M4 4h16v16H4z' },
            });

            expect(drawn(made), recordStyle).toBe('M4 4h16v16H4z');
        }
    });

    it('keeps the dot for an unknown style', () => {
        const { made } = screen({ recordStyle: 'neon' as unknown as 'mic' });

        expect(drawn(made)).toBe(DOT);
        expect(
            made.element.querySelector('.sonicframe-rec-letters'),
        ).toBeNull();
    });
});
