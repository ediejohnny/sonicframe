/**
 * The times a player shows (the time, elapsed, remaining, duration). Each keeps the room of the
 * longest time the sound can show: the text and a hidden mold of that longest time share one grid
 * cell. Digits are not all as wide in every font (even with tabular figures), so without the mold
 * the time would change width as it counts and move the wave beside it.
 */

import { timeMold, timeText, type PlayerLook } from '../core/look';
import { MUTED } from '../core/variables';
import { css } from '../dom/css';
import type { SonicFrame } from '../dom/frame';

/** The side of its room a time's text keeps to; `auto` in the look picks one by the time's place. */
export type Side = 'start' | 'end';

/** The sides `auto` keeps to: on one line (`side`), and in a voice note (`narrowSide`, null when it stays put). */
export type TimeSides = { side: Side; narrowSide: Side | null };

/** A built time: the text shown, the hidden mold that holds its room, and how it reads. */
type TimePart = TimeSides & {
    text: HTMLElement;
    mold: HTMLElement;
    format: PlayerLook['time'];
};

export class TimeParts {
    private parts: TimePart[] = [];

    /** A new time, read as `format`; hidden from screen readers, as the wave already speaks the position. */
    add(format: PlayerLook['time'], sides: TimeSides): HTMLElement {
        const time = document.createElement('span');
        const text = document.createElement('span');
        const mold = document.createElement('span');
        time.className = 'sonicframe-time';
        text.className = 'sonicframe-time-text';
        mold.className = 'sonicframe-time-mold';
        time.setAttribute('aria-hidden', 'true');
        css(time, [
            ['display', 'inline-grid'],
            ['white-space', 'nowrap'],
            ['flex-shrink', '0'],
            ['color', MUTED],
        ]);
        css(text, [['grid-area', '1 / 1']]);
        css(mold, [
            ['grid-area', '1 / 1'],
            ['visibility', 'hidden'],
        ]);
        time.append(text, mold);
        this.parts.push({ text, mold, format, ...sides });

        return time;
    }

    /** Puts each time's text on the side of its room `align` names, or the one its place gives (`auto`). */
    align(narrow: boolean, align: PlayerLook['timeAlign']): void {
        for (const { text, side, narrowSide } of this.parts) {
            const auto = narrow && narrowSide !== null ? narrowSide : side;
            text.style.setProperty(
                'justify-self',
                align === 'auto' ? auto : align,
            );
        }
    }

    /**
     * Writes where the sound is. The frame's time, never the media's own: before the media loads
     * (`preload="none"`) a seek waits in the frame, and the media still says 0.
     */
    show(frame: SonicFrame): void {
        const duration = frame.duration;
        const time = frame.time;

        for (const { text, mold, format } of this.parts) {
            const longest = timeMold(format, time, duration);
            text.textContent = timeText(format, time, duration);

            // The mold changes only with the duration's form, not on every tick.
            if (mold.textContent !== longest) {
                mold.textContent = longest;
            }
        }
    }

    /** Forgets the times built, when the player builds again. */
    clear(): void {
        this.parts = [];
    }
}
