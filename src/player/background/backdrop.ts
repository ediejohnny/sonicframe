/**
 * A player's own background: a layer behind its parts, built from the look, and its animation, which
 * moves only while it should (while the sound plays, or always, as the look says), stops while the
 * mouse or the focus is on the player when asked, and never starts with reduced motion.
 */

import { resolveBackground } from '../../core/player/background';
import {
    resolveBackgroundAnimation,
    type ResolvedBackgroundAnimation,
} from '../../core/player/background-animation';
import { backdropMotion } from '../../core/player/background-motion';
import type { PlayerLook } from '../../core/player/look';
import type { Palette } from '../../core/player/palettes';
import { resolveColor } from '../../core/shared/color';
import { css } from '../../dom/shared/css';
import { prefersReducedMotion } from '../../dom/shared/motion';
import { readColor } from '../../dom/shared/paint';
import { buildBackdrop, type BackdropPieces } from './backdrop-picture';
import { paintGrain } from './grain';

const MEDIA_EVENTS = ['play', 'pause', 'ended', 'emptied'] as const;

export class PlayerBackdrop {
    private readonly layer = document.createElement('div');
    private pieces: BackdropPieces | null = null;
    private motion: Animation | null = null;
    private settings: ResolvedBackgroundAnimation | null = null;
    private pointer = false;
    private focus = false;

    constructor(
        private readonly element: HTMLElement,
        private readonly media: HTMLMediaElement | null,
        signal: AbortSignal,
    ) {
        this.layer.className = 'sonicframe-background';
        this.layer.setAttribute('aria-hidden', 'true');

        for (const type of MEDIA_EVENTS) {
            media?.addEventListener(type, () => this.sync(), { signal });
        }

        const on = { signal };
        element.addEventListener(
            'pointerenter',
            () => this.hold('pointer', true),
            on,
        );
        element.addEventListener(
            'pointerleave',
            () => this.hold('pointer', false),
            on,
        );
        element.addEventListener('focusin', () => this.hold('focus', true), on);
        element.addEventListener(
            'focusout',
            (event) =>
                this.hold(
                    'focus',
                    element.contains(event.relatedTarget as Node | null),
                ),
            on,
        );
    }

    /** Shows the look's background in the colors of `palette`, or takes it away when the look has none. */
    show(look: PlayerLook, palette: Palette): void {
        this.stop();
        const background = resolveBackground(look.background);

        if (background === null) {
            this.clear();

            return;
        }

        // The layer sits behind the parts (z-index -1) but inside the player, never behind the page.
        css(this.element, [
            ['position', 'relative'],
            ['isolation', 'isolate'],
        ]);

        const animation = prefersReducedMotion()
            ? null
            : resolveBackgroundAnimation(look.backgroundAnimation);
        const lookup = getComputedStyle(this.element);
        const pieces = buildBackdrop(
            this.layer,
            background,
            animation,
            {
                surface: `var(--sonicframe-surface, ${palette.surface})`,
                progress: `var(--sonicframe-progress, ${palette.progress})`,
            },
            (color) =>
                readColor(
                    resolveColor(color, (name) =>
                        lookup.getPropertyValue(name),
                    ),
                ),
        );
        this.pieces = pieces;
        this.element.prepend(this.layer);
        this.resize();

        if (animation !== null) {
            const motion = backdropMotion(animation, background, pieces.filter);
            const target =
                motion.target === 'layer' ? this.layer : pieces.picture;

            if (typeof target.animate === 'function') {
                this.motion = target.animate(motion.keyframes, {
                    duration: motion.duration,
                    direction: motion.direction,
                    easing: motion.easing,
                    iterations: Number.POSITIVE_INFINITY,
                });
                this.settings = animation;
                this.sync();
            }
        }
    }

    /** Draws the grain again at the player's size. */
    resize(): void {
        const grain = this.pieces?.grain;

        if (grain) {
            paintGrain(
                grain,
                this.element.clientWidth,
                this.element.clientHeight,
            );
        }
    }

    destroy(): void {
        this.stop();
        this.clear();
    }

    /** Notes the mouse or the focus coming onto the player or leaving it. */
    private hold(by: 'pointer' | 'focus', on: boolean): void {
        this[by] = on;
        this.sync();
    }

    /** Moves the background while it should, and holds it still otherwise. */
    private sync(): void {
        const { motion, settings, media } = this;

        if (motion === null || settings === null) {
            return;
        }

        const playing =
            settings.while === 'always' ||
            (media !== null && !media.paused && !media.ended);
        const held = settings.pauseOnHover && (this.pointer || this.focus);

        if (playing && !held) {
            motion.play();
        } else {
            motion.pause();
        }
    }

    private stop(): void {
        this.motion?.cancel();
        this.motion = null;
        this.settings = null;
    }

    /** Lets the player go back to its surface; the layer went with the parts it was built among. */
    private clear(): void {
        this.pieces = null;
        this.element.style.removeProperty('position');
        this.element.style.removeProperty('isolation');
    }
}
