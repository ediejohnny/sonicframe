/**
 * A chapter's name in the player, in a room that may be too short for it. It ends as the look says
 * (an ellipsis, a fade or a cut), can walk across its room (an endless strip, back to its start, or
 * back and forth) and can show in full in the page's tooltip under the mouse. It is hidden from
 * screen readers: the slider's value says the chapter.
 */

import type { PlayerLook } from '../core/look';
import { marqueeTiming, type MarqueeTiming } from '../core/marquee';
import { css } from '../dom/css';
import { prefersReducedMotion } from '../dom/motion';
import { sharedTooltip, type TooltipColors } from '../dom/tooltip';
import { remPixels } from '../dom/units';

/** The look options a long name follows. */
export type LongNameLook = Pick<
    PlayerLook,
    | 'nameOverflow'
    | 'nameFade'
    | 'nameFadeStart'
    | 'nameTooltip'
    | 'marquee'
    | 'marqueeType'
    | 'marqueeGap'
    | 'marqueeHoverPause'
    | 'marqueeSpeed'
    | 'marqueePause'
>;

const AT_REST = 'translateX(0px)';

/** The mask properties a fade sets, unprefixed and for WebKit. */
const MASK = [
    'mask-image',
    'mask-size',
    'mask-position',
    'mask-repeat',
    'mask-composite',
    '-webkit-mask-image',
    '-webkit-mask-size',
    '-webkit-mask-position',
    '-webkit-mask-repeat',
    '-webkit-mask-composite',
];

export class LongName {
    /** The part placed in the player's row. */
    readonly element: HTMLElement;
    /** What walks: the name, then its copy when the walk is a loop. */
    private readonly strip: HTMLElement;
    private readonly label: HTMLElement;
    private readonly copy: HTMLElement;
    /** Whether the name was too long for its room when last measured. */
    private long = false;
    /** The running walk, with what it was measured for. */
    private walk: { key: string; animations: Animation[] } | null = null;
    private tipShown = false;

    /** `colors` gives the tooltip's colors when it opens, so a palette changed later shows. */
    constructor(
        private readonly look: LongNameLook,
        private readonly colors: () => TooltipColors,
    ) {
        this.element = document.createElement('span');
        this.strip = document.createElement('span');
        this.label = document.createElement('span');
        this.copy = document.createElement('span');
        this.element.className = 'sonicframe-chapter-now';
        this.element.setAttribute('aria-hidden', 'true');
        this.element.setAttribute('dir', 'auto');
        this.strip.append(this.label, this.copy);
        this.element.append(this.strip);
        css(this.element, [
            ['min-width', '0'],
            ['flex', '1 1 6rem'],
            ['overflow', 'hidden'],
            ['white-space', 'nowrap'],
            ['text-overflow', 'ellipsis'],
        ]);
        css(this.copy, [['display', 'none']]);

        if (look.nameTooltip) {
            this.listenTooltip();
        }

        if (look.marquee && look.marqueeHoverPause) {
            this.listenHover();
        }
    }

    /** The name shown; set it, then `fit()`. */
    get text(): string {
        return this.label.textContent ?? '';
    }

    set text(value: string) {
        this.label.textContent = value;
    }

    /**
     * Measures the name against its room, ends it as the look says, and walks it when the look asks
     * and motion is welcome. A walk keeps going while the name and its room stay the same.
     */
    fit(): void {
        const look = this.look;
        // The copy holds text only while a loop walks, so the part reads as the name alone.
        this.copy.textContent = '';
        css(this.copy, [['display', 'none']]);
        // Measured as a block of its own, the strip keeps the name's full width past the room.
        css(this.strip, [['display', 'inline-block']]);
        const width = this.label.getBoundingClientRect().width;
        const overflow = width - this.element.getBoundingClientRect().width;
        this.long = overflow > 0;
        const rtl = getComputedStyle(this.element).direction === 'rtl';
        const faded = this.long && look.nameOverflow === 'fade';
        const fade = faded ? remPixels(look.nameFade) : 0;
        const plan = this.plan(width, overflow, fade);

        this.end(faded, plan !== null, rtl, fade);

        if (plan === null) {
            this.stop();

            return;
        }

        const loop = look.marqueeType === 'loop';

        if (loop) {
            this.copy.textContent = this.text;
            css(this.copy, [
                ['display', 'inline'],
                ['margin-inline-start', `${look.marqueeGap}rem`],
            ]);
        }

        const key = `${plan.distance}|${this.text}|${look.marqueeType}|${plan.timing.duration}|${fade}`;

        if (this.walk?.key === key) {
            return;
        }

        this.stop();

        const { timing, distance } = plan;
        const far = `translateX(${rtl ? distance : -distance}px)`;
        const options: KeyframeAnimationOptions = {
            duration: timing.duration,
            iterations: Number.POSITIVE_INFINITY,
            direction: look.marqueeType === 'bounce' ? 'alternate' : 'normal',
            easing: 'linear',
        };
        const animations = [
            this.strip.animate(
                [
                    { transform: AT_REST, offset: 0 },
                    { transform: AT_REST, offset: timing.start },
                    { transform: far, offset: timing.end },
                    { transform: far, offset: 1 },
                ],
                options,
            ),
        ];

        if (faded && look.nameFadeStart) {
            animations.push(
                this.element.animate(
                    startFade(timing, loop, fade, rtl),
                    options,
                ),
            );
        }

        for (const animation of animations) {
            // Cancelling a walk rejects `finished`; that is how it ends, never an error.
            animation.finished.catch(() => undefined);
        }

        this.walk = { key, animations };
    }

    /** Stops the walk and closes the tooltip it opened; the element goes with its row. */
    destroy(): void {
        this.stop();
        this.hideTooltip();
    }

    /**
     * How far and how long the name walks, or `null` when it stays still. A loop walks the name and
     * the gap, so its copy comes to rest where it started, and waits only there; the others walk
     * the overflow and the fade, so the end clears the fade, and wait at both ends (half a wait
     * each time when the walk goes back and forth, as it passes each end twice a round).
     */
    private plan(
        width: number,
        overflow: number,
        fade: number,
    ): { distance: number; timing: MarqueeTiming } | null {
        const look = this.look;

        if (
            !look.marquee ||
            !this.long ||
            typeof this.strip.animate !== 'function' ||
            prefersReducedMotion()
        ) {
            return null;
        }

        const speed = remPixels(look.marqueeSpeed);
        const pause = look.marqueePause;
        let distance = overflow + fade;
        let timing: MarqueeTiming | null;

        if (look.marqueeType === 'loop') {
            distance = width + remPixels(look.marqueeGap);
            timing = marqueeTiming(distance, speed, pause, 0, fade);
        } else if (look.marqueeType === 'bounce') {
            timing = marqueeTiming(distance, speed, pause / 2, pause / 2, fade);
        } else {
            timing = marqueeTiming(distance, speed, pause, pause, fade);
        }

        return timing === null ? null : { distance, timing };
    }

    /**
     * How the name ends in its room. An ellipsis needs the strip inline and still; a walking strip
     * is cut, under a fade when the look asks for one, and a walking faded name may fade at its
     * start too, a second layer kept out of sight until the walk moves it in. A name that fits has
     * no fade, so its last letters never dim.
     */
    private end(
        faded: boolean,
        walking: boolean,
        rtl: boolean,
        fade: number,
    ): void {
        const look = this.look;
        const ellipsis = look.nameOverflow === 'ellipsis' && !walking;

        if (ellipsis) {
            this.strip.style.removeProperty('display');
        }

        css(this.element, [['text-overflow', ellipsis ? 'ellipsis' : 'clip']]);

        for (const property of MASK) {
            this.element.style.removeProperty(property);
        }

        if (!faded) {
            return;
        }

        const toward = rtl ? 'left' : 'right';
        const width = `${look.nameFade}rem`;
        const layers = [
            `linear-gradient(to ${toward}, #000 calc(100% - ${width}), transparent)`,
        ];
        const sizes = ['100% 100%'];
        const places = ['0px 0px'];

        if (walking && look.nameFadeStart) {
            layers.push(
                `linear-gradient(to ${toward}, transparent, #000 ${width})`,
            );
            sizes.push(`calc(100% + ${width}) 100%`);
            places.push(`${startFadeAt(false, fade, rtl)} 0px`);
        }

        const pairs: [string, string][] = [['mask-image', layers.join(', ')]];

        if (layers.length > 1) {
            pairs.push(
                ['mask-size', sizes.join(', ')],
                ['mask-position', places.join(', ')],
                ['mask-repeat', 'no-repeat'],
                ['mask-composite', 'intersect'],
                ['-webkit-mask-composite', 'source-in'],
            );
        }

        for (const [name, value] of pairs) {
            this.element.style.setProperty(name, value);

            if (!name.startsWith('-webkit-') && name !== 'mask-composite') {
                this.element.style.setProperty(`-webkit-${name}`, value);
            }
        }
    }

    private stop(): void {
        for (const animation of this.walk?.animations ?? []) {
            animation.cancel();
        }

        this.walk = null;
    }

    /** The walk stops while the mouse is on the name, where it is, and goes on from there. */
    private listenHover(): void {
        this.element.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'mouse') {
                for (const animation of this.walk?.animations ?? []) {
                    animation.pause();
                }
            }
        });
        this.element.addEventListener('pointerleave', () => {
            for (const animation of this.walk?.animations ?? []) {
                animation.play();
            }
        });
    }

    /** The whole name in the page's tooltip while the mouse is on it, when it is cut. */
    private listenTooltip(): void {
        this.element.addEventListener('pointerenter', (event) => {
            if (event.pointerType !== 'mouse' || !this.long) {
                return;
            }

            sharedTooltip().show(this.element, [this.text], this.colors());
            this.tipShown = true;
        });
        this.element.addEventListener('pointerleave', () => this.hideTooltip());
    }

    private hideTooltip(): void {
        if (this.tipShown) {
            sharedTooltip().hide();
            this.tipShown = false;
        }
    }
}

/**
 * Where the start fade's layer sits: out past the start (`shown` false), so the start is sharp,
 * or over it. The layer is one fade wider than the room, so either way it covers the whole room.
 */
function startFadeAt(shown: boolean, fade: number, rtl: boolean): string {
    return shown === rtl ? `-${fade}px` : '0px';
}

/**
 * The start fade's moves over a round: out of sight while the name rests, in as the name's first
 * letters walk the fade's width, and, in a loop, out again as its copy comes to rest.
 */
function startFade(
    timing: MarqueeTiming,
    loop: boolean,
    fade: number,
    rtl: boolean,
): Keyframe[] {
    const at = (shown: boolean, offset: number): Keyframe => {
        const place = `0px 0px, ${startFadeAt(shown, fade, rtl)} 0px`;

        return { maskPosition: place, webkitMaskPosition: place, offset };
    };
    const frames = [
        at(false, 0),
        at(false, timing.start),
        at(true, timing.start + timing.ramp),
    ];

    if (loop) {
        frames.push(at(true, timing.end - timing.ramp), at(false, timing.end));
    } else {
        frames.push(at(true, 1));
    }

    return frames;
}
