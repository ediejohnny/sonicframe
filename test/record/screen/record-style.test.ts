/**
 * The record button's style (`recordStyle`): a red button by default, the dot in the player's
 * colors, a microphone, or a retro REC badge; its red read as numbers, and the app's own icon over any style.
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
    it('draws a microphone with the mic style: its outline by default, filled when asked', () => {
        const outline =
            'M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1 -7 0V5.5a3.5 3.5 0 0 1 3.5 -3.5zM12 3.75a1.75 1.75 0 0 0 -1.75 1.75v6a1.75 1.75 0 0 0 3.5 0V5.5a1.75 1.75 0 0 0 -1.75 -1.75zM5 11.5a7 7 0 0 0 14 0h-1.75a5.25 5.25 0 0 1 -10.5 0zM11.125 18.3h1.75V22h-1.75z';
        const filled =
            'M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1 -7 0V5.5a3.5 3.5 0 0 1 3.5 -3.5zM5 11.5a7 7 0 0 0 14 0h-1.75a5.25 5.25 0 0 1 -10.5 0zM11.125 18.3h1.75V22h-1.75z';

        const plain = screen({ recordStyle: 'mic' });
        expect(drawn(plain.made)).toBe(outline);
        expect(button(plain.made, 'record')?.getAttribute('aria-label')).toBe(
            'Record',
        );
        expect(
            drawn(screen({ recordStyle: 'mic', micStyle: 'filled' }).made),
        ).toBe(filled);
        expect(
            drawn(
                screen({
                    recordStyle: 'mic',
                    micStyle: 'striped' as unknown as 'filled',
                }).made,
            ),
        ).toBe(outline);
    });

    it("paints the microphone in the record red by default, in the player's colors when asked", () => {
        const red = screen({ recordStyle: 'mic', recordColor: '#0000ff' });
        expect(style(red.made, 'background-color')).toBe('rgba(0, 0, 255, 1)');

        for (const micColor of ['theme', 'plain'] as 'theme'[]) {
            const { made } = screen({
                recordStyle: 'mic',
                recordColor: '#0000ff',
                micColor,
            });

            // The player's button color is the documented --sonicframe-button.
            expect(style(made, 'background-color'), micColor).toMatch(
                micColor === 'theme'
                    ? /^var\(--sonicframe-button,/
                    : /^rgba\(0, 0, 255, 1\)$/,
            );
        }
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

    it('is a red button by default and for an unknown style; the dot style wears the player colors', () => {
        // #f44336, the default red.
        const red = 'rgba(244, 67, 54, 1)';

        for (const recordStyle of [undefined, 'neon' as unknown as 'mic']) {
            const { made } = screen({ recordStyle });

            expect(drawn(made), String(recordStyle)).toBe(DOT);
            expect(style(made, 'background-color')).toBe(red);
            expect(
                made.element.querySelector('.sonicframe-rec-letters'),
            ).toBeNull();
        }

        const dot = screen({ recordStyle: 'dot' });
        expect(drawn(dot.made)).toBe(DOT);
        expect(style(dot.made, 'background-color')).not.toBe(red);
    });
});
