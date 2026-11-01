/**
 * The retro REC mark: a red dot and red REC letters inside a red border, on a dark ground of its own
 * so the red reads on any page. It dresses the record button of the `'rec'` style and, with
 * `recPlace: 'stop'`, the stop button; as the `rec` part it is a badge that is only seen (the live
 * region says when recording starts), holding the time with `recPlace: 'time'`. While recording,
 * its dot blinks once a second when asked (`Blinker`).
 */

import type { PlayerLook } from '../../core/player/look';
import { css } from '../../dom/shared/css';
import { iconElement, iconPath } from '../../dom/shared/icon';
import { prefersReducedMotion } from '../../dom/shared/motion';
import { remPixels, sizePixels } from '../../dom/shared/units';

/** The ground of the REC mark. */
export const REC_GROUND = '#141414';

/** The narrowest the live wave may be, in rem, before the REC letters give it their room. */
const WAVE_ROOM = 3;

/** One blink a second: lit for the first half, dark for the second. */
const BLINK: Keyframe[] = [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: 0.5 },
    { opacity: 0, offset: 0.5 },
    { opacity: 0, offset: 1 },
];

/** The dot (drawing `path`) and the letters of the mark; the letters are only seen. */
function mark(path: string): [HTMLSpanElement, HTMLSpanElement] {
    const dot = document.createElement('span');
    dot.className = 'sonicframe-rec-dot';
    dot.setAttribute('aria-hidden', 'true');
    const icon = iconElement();
    icon.append(iconPath({ d: path, fill: 'currentColor' }));
    css(icon, [
        ['width', '100%'],
        ['height', '100%'],
    ]);
    dot.append(icon);
    css(dot, [
        ['display', 'inline-block'],
        ['width', '0.875rem'],
        ['height', '0.875rem'],
        ['flex-shrink', '0'],
    ]);
    const letters = document.createElement('span');
    letters.className = 'sonicframe-rec-letters';
    letters.textContent = 'REC';
    letters.setAttribute('aria-hidden', 'true');

    return [dot, letters];
}

/** The look of the mark on `element`: a red border and red letters on the dark ground. */
function paint(element: HTMLElement, red: string): void {
    css(element, [
        ['display', 'inline-flex'],
        ['align-items', 'center'],
        ['gap', '0.25rem'],
        ['box-sizing', 'border-box'],
        ['border-style', 'solid'],
        ['border-width', '0.125rem'],
        ['border-color', red],
        ['border-radius', '0.375rem'],
        ['background-color', REC_GROUND],
        ['color', red],
        ['font-weight', '700'],
        ['letter-spacing', '0.08em'],
        ['line-height', '1'],
        ['white-space', 'nowrap'],
    ]);
}

/**
 * Turns `button` (the record or the stop button) into the REC mark, its icon's path the dot's, as
 * tall as the look's buttons; gives back the dot, to blink.
 */
export function dressRec(
    button: HTMLButtonElement,
    look: PlayerLook,
    red: string,
    path: string,
): HTMLSpanElement {
    const [dot, letters] = mark(path);
    button.replaceChildren(dot, letters);
    paint(button, red);
    css(button, [
        ['width', 'auto'],
        ['height', `${sizePixels(look.button.size)}px`],
        ['padding', '0 0.625rem'],
        ['font-size', '0.875rem'],
    ]);

    return dot;
}

/**
 * The `rec` part: a badge that is only seen, or, given `time` (the screen's time part), one that
 * holds the time, which screen readers still hear.
 */
export function recBadge(
    red: string,
    path: string,
    time: HTMLElement | null,
): { badge: HTMLSpanElement; dot: HTMLSpanElement } {
    const badge = document.createElement('span');
    badge.className = 'sonicframe-rec';
    const [dot, letters] = mark(path);
    badge.append(dot, letters);

    if (time === null) {
        badge.setAttribute('aria-hidden', 'true');
    } else {
        badge.append(time);
    }

    paint(badge, red);
    css(badge, [
        ['flex-shrink', '0'],
        ['font-size', '0.75rem'],
    ]);
    frame(badge, true);

    return { badge, dot };
}

/** The badge's frame (its border and its dark ground), or none, leaving its dot alone. */
function frame(badge: HTMLElement, framed: boolean): void {
    css(badge, [
        ['border-style', framed ? 'solid' : 'none'],
        ['background-color', framed ? REC_GROUND : 'transparent'],
        ['padding', framed ? '0.25rem 0.375rem' : '0'],
    ]);
}

/**
 * Gives the live wave in `row` its room: the REC letters show while the wave keeps 3 rem, and
 * narrower, only the REC dots stay, a badge without its frame too, so a framed dot is never taken
 * for the stop button (the letters are only seen, so nothing is lost to a screen reader).
 */
export function fitRec(row: HTMLElement): void {
    const wave = row.querySelector('.sonicframe-recorder-wave');

    if (wave === null) {
        return;
    }

    const letters = [
        ...row.querySelectorAll<HTMLElement>('.sonicframe-rec-letters'),
    ];
    const badges = [...row.querySelectorAll<HTMLElement>('.sonicframe-rec')];

    for (const each of letters) {
        each.style.removeProperty('display');
    }

    badges.forEach((badge) => frame(badge, true));

    if (wave.getBoundingClientRect().width < remPixels(WAVE_ROOM)) {
        for (const each of letters) {
            css(each, [['display', 'none']]);
        }

        badges.forEach((badge) => frame(badge, false));
    }
}

/**
 * Blinks the REC dots of a screen once a second, only when asked and never with reduced motion. A
 * dot holds still, lit, while the pointer is over the screen or the focus is in it, so a blink that
 * would last minutes can always be stopped. It is made with its screen, before anything in it can
 * take the focus, so the focus coming in and going out tells it all.
 */
export class Blinker {
    private readonly blinks = new Set<Animation>();
    private pointer = false;
    private focus = false;

    constructor(
        screen: HTMLElement,
        private readonly enabled: boolean,
    ) {
        screen.addEventListener('pointerenter', () =>
            this.hold('pointer', true),
        );
        screen.addEventListener('pointerleave', () =>
            this.hold('pointer', false),
        );
        screen.addEventListener('focusin', () => this.hold('focus', true));
        screen.addEventListener('focusout', (event) =>
            this.hold(
                'focus',
                event.relatedTarget instanceof Node &&
                    screen.contains(event.relatedTarget),
            ),
        );
    }

    /** Blinks `dot` from now on, held when the screen is. */
    add(dot: HTMLElement): void {
        if (
            !this.enabled ||
            prefersReducedMotion() ||
            typeof dot.animate !== 'function'
        ) {
            return;
        }

        const blink = dot.animate(BLINK, {
            duration: 1000,
            iterations: Number.POSITIVE_INFINITY,
        });
        this.blinks.add(blink);

        if (this.pointer || this.focus) {
            still(blink);
        }
    }

    /** Stops every blink: the dots are drawn again on the screen's next stage. */
    clear(): void {
        for (const blink of this.blinks) {
            blink.cancel();
        }

        this.blinks.clear();
    }

    /** Holds the dots still (or lets them blink) for the pointer or the focus. */
    private hold(by: 'pointer' | 'focus', held: boolean): void {
        this[by] = held;
        const stopped = this.pointer || this.focus;

        for (const blink of this.blinks) {
            if (stopped) {
                still(blink);
            } else {
                blink.play();
            }
        }
    }
}

/** Holds `blink` at its start: the dot lit. */
function still(blink: Animation): void {
    blink.currentTime = 0;
    blink.pause();
}
