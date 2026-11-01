/**
 * The REC badge while recording, in the place the app chooses (`recPlace`): a badge before the time
 * (the default with the REC style), the stop button drawn as the badge, or the badge holding the
 * time. Its dot blinks once a second only when asked (`recordBlink`), never with reduced motion,
 * stays lit while paused, and holds still while the pointer is over or the focus is in the screen.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { RecorderScreen } from '../../../src/record';
import { recordAnimations } from '../../support/animations';
import { triggerResize } from '../../support/fakes';
import { stubMedia } from '../../support/helpers';
import {
    button,
    parts,
    press,
    screen,
    useRecordingPage,
} from './screen-harness';

useRecordingPage();

/** The REC badge part shown now, or null. */
function badge(made: RecorderScreen): HTMLElement | null {
    return made.element.querySelector<HTMLElement>('.sonicframe-rec');
}

describe('the REC badge while recording', () => {
    it('comes before the time with the REC style, seen but not heard', async () => {
        const { made } = screen({ recordStyle: 'rec' });
        expect(parts(made)).toEqual(['record']);
        await press(made, 'record');

        expect(parts(made)).toEqual([
            'discard',
            'rec',
            'time',
            'wave',
            'pause',
            'stop',
        ]);
        expect(badge(made)?.textContent).toBe('REC');
        expect(badge(made)?.getAttribute('aria-hidden')).toBe('true');
        expect(badge(made)?.tagName).not.toBe('BUTTON');
    });

    it('holds the time when placed there, the time still heard', async () => {
        const { made } = screen({ recordStyle: 'rec', recPlace: 'time' });
        await press(made, 'record');

        expect(parts(made)).toEqual([
            'discard',
            'rec',
            'wave',
            'pause',
            'stop',
        ]);
        await vi.advanceTimersByTimeAsync(2000);
        const time = badge(made)?.querySelector('.sonicframe-recorder-time');
        expect(time?.textContent).toBe('0:02');
        expect(badge(made)?.hasAttribute('aria-hidden')).toBe(false);
        expect(
            badge(made)
                ?.querySelector('.sonicframe-rec-letters')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('is the stop button when placed there, named Stop recording, its dot blinking', async () => {
        const started = recordAnimations();
        const { made } = screen({
            recordStyle: 'rec',
            recPlace: 'stop',
            recordBlink: true,
        });
        await press(made, 'record');

        expect(parts(made)).toEqual([
            'discard',
            'time',
            'wave',
            'pause',
            'stop',
        ]);
        const stop = button(made, 'stop');
        expect(
            stop?.querySelector('.sonicframe-rec-letters')?.textContent,
        ).toBe('REC');
        expect(stop?.getAttribute('aria-label')).toBe('Stop recording');
        expect(started.map((blink) => blink.target)).toEqual([
            stop?.querySelector('.sonicframe-rec-dot'),
        ]);
        await press(made, 'stop');
        expect(made.state).toBe('review');

        // Without the REC style, the stop button keeps its square.
        const plain = screen({ recPlace: 'stop' });
        await press(plain.made, 'record');
        expect(
            button(plain.made, 'stop')?.querySelector(
                '.sonicframe-rec-letters',
            ),
        ).toBeNull();
    });

    it("leaves the app's own list alone, and goes in any list that names it", async () => {
        const own = screen({
            recordStyle: 'rec',
            parts: { recording: ['time', 'stop'] },
        });
        await press(own.made, 'record');
        expect(parts(own.made)).toEqual(['time', 'stop']);

        const named = screen({ parts: { recording: ['rec', 'stop'] } });
        await press(named.made, 'record');
        expect(parts(named.made)).toEqual(['rec', 'stop']);
    });

    it('takes an unknown place for the badge before the time', async () => {
        const { made } = screen({
            recordStyle: 'rec',
            recPlace: 'corner' as unknown as 'time',
        });
        await press(made, 'record');

        expect(parts(made)).toEqual([
            'discard',
            'rec',
            'time',
            'wave',
            'pause',
            'stop',
        ]);
    });
});

describe('a REC mark in a narrow screen', () => {
    /** Lays the live wave out `width` wide; every other box is empty. */
    function waveOf(width: number): void {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
            function (this: Element): DOMRect {
                const box = {
                    left: 0,
                    top: 0,
                    width: this.matches('.sonicframe-recorder-wave')
                        ? width
                        : 0,
                    height: 0,
                };

                return {
                    ...box,
                    right: box.width,
                    bottom: 0,
                    x: 0,
                    y: 0,
                    toJSON: () => box,
                };
            },
        );
    }

    /** Whether the REC letters in the screen are shown. */
    function lettersShown(made: RecorderScreen): boolean[] {
        return [
            ...made.element.querySelectorAll<HTMLElement>(
                '.sonicframe-rec-letters',
            ),
        ].map(
            (letters) => letters.style.getPropertyValue('display') !== 'none',
        );
    }

    it('keeps only its dot while the live wave would be narrower than 3 rem, and shows REC again with room', async () => {
        const { made } = screen({ recordStyle: 'rec' });
        const framed = (): string =>
            badge(made)?.style.getPropertyValue('border-style') ?? '';
        waveOf(47);
        await press(made, 'record');
        expect(lettersShown(made)).toEqual([false]);
        // A lone dot keeps no frame: a framed dot would look like the stop button.
        expect(framed()).toBe('none');

        vi.restoreAllMocks();
        waveOf(48);
        triggerResize(
            made.element.querySelector('.sonicframe-recorder-row') as Element,
            { width: 300, height: 40 },
        );
        expect(lettersShown(made)).toEqual([true]);
        expect(framed()).toBe('solid');
    });

    it('keeps its letters with no live wave in the row', () => {
        waveOf(0);
        const { made } = screen({ recordStyle: 'rec' });

        expect(lettersShown(made)).toEqual([true]);
    });
});

describe('the blinking dot', () => {
    it('blinks once a second while recording, only when asked', async () => {
        const quiet = recordAnimations();
        const still = screen({ recordStyle: 'rec' });
        await press(still.made, 'record');
        expect(quiet).toHaveLength(0);
        vi.restoreAllMocks();

        const started = recordAnimations();
        const { made } = screen({ recordStyle: 'rec', recordBlink: true });
        await press(made, 'record');

        const blink = started.at(-1);
        expect(blink?.target).toBe(
            badge(made)?.querySelector('.sonicframe-rec-dot'),
        );
        expect(blink?.options.duration).toBe(1000);
        expect(blink?.options.iterations).toBe(Number.POSITIVE_INFINITY);
        expect(blink?.keyframes.map((frame) => frame.opacity)).toEqual([
            1, 1, 0, 0,
        ]);
    });

    it('stays lit while paused', async () => {
        const started = recordAnimations();
        const { made } = screen({ recordStyle: 'rec', recordBlink: true });
        await press(made, 'record');
        expect(started).toHaveLength(1);
        await press(made, 'pause');

        expect(started).toHaveLength(1);
        expect(started[0].cancelled).toBe(true);
        // A blink let go answers the pointer no more.
        made.element.dispatchEvent(new Event('pointerenter'));
        expect(started[0].paused).toBe(false);
    });

    it('holds still under the pointer or the focus, and goes on after', async () => {
        const started = recordAnimations();
        const { made } = screen({ recordStyle: 'rec', recordBlink: true });
        await press(made, 'record');
        const blink = started.at(-1);

        made.element.dispatchEvent(new Event('pointerenter'));
        expect(blink?.paused).toBe(true);
        // Held at its start, where the dot is lit.
        expect((blink as { currentTime?: number }).currentTime).toBe(0);
        made.element.dispatchEvent(new Event('pointerleave'));
        expect(blink?.paused).toBe(false);

        made.element.dispatchEvent(new FocusEvent('focusin'));
        expect(blink?.paused).toBe(true);
        // The focus moving to another button of the screen keeps it held.
        made.element.dispatchEvent(
            new FocusEvent('focusout', { relatedTarget: button(made, 'stop') }),
        );
        expect(blink?.paused).toBe(true);
        made.element.dispatchEvent(new FocusEvent('focusout'));
        expect(blink?.paused).toBe(false);
    });

    it('starts held when the focus is already in the screen', async () => {
        const started = recordAnimations();
        const { made } = screen({ recordStyle: 'rec', recordBlink: true });
        button(made, 'record')?.focus();
        await press(made, 'record');

        expect(started.at(-1)?.paused).toBe(true);
    });

    it('blinks no more once the screen is taken off the page', async () => {
        const started = recordAnimations();
        const { made } = screen({ recordStyle: 'rec', recordBlink: true });
        await press(made, 'record');
        made.destroy();

        expect(started).toHaveLength(1);
        expect(started[0].cancelled).toBe(true);
    });

    it('never blinks with reduced motion', async () => {
        stubMedia((query) => query.includes('reduce'));
        const started = recordAnimations();
        const { made } = screen({ recordStyle: 'rec', recordBlink: true });
        await press(made, 'record');

        expect(started).toHaveLength(0);
    });
});
