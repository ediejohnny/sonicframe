/**
 * A play / pause button for an audio or video element: a real `<button>` (keyboard and screen readers
 * work as usual) drawn with inline styles and an SVG icon, in three shapes and three fills, with
 * colors from your CSS. Several buttons can follow the same media.
 */

import {
    buttonStyles,
    iconSize,
    pausePath,
    playPath,
    type ButtonColors,
    type ButtonFill,
    type ButtonLook,
    type ButtonShape,
} from '../core/button';
import { Emitter } from '../core/emitter';
import { applyStyles } from '../core/styles';

export type PlayButtonOptions = {
    /** The element the button is added to. */
    container: HTMLElement;
    media?: HTMLMediaElement | null;
    /** `'circle'` (default), `'rounded'` or `'square'`. */
    shape?: ButtonShape;
    /** `'solid'` (default), `'outline'` or `'ghost'`. */
    fill?: ButtonFill;
    /** Width and height in CSS pixels; 32 by default. */
    size?: number;
    /** Corner radius in CSS pixels, instead of the shape's own. */
    radius?: number | null;
    colors?: Partial<ButtonColors>;
    /** Accessible names for both states. */
    labels?: { play: string; pause: string };
    /** Starting this media pauses every other media that has an exclusive play button (default true). */
    exclusive?: boolean;
};

export type PlayButtonEvents = {
    /** The media refused to play (no source, or the browser blocked it). */
    error: [error: unknown];
    destroy: [];
};

export const DEFAULT_BUTTON_COLORS: Readonly<ButtonColors> = Object.freeze({
    background: 'var(--sonicframe-button, var(--sonicframe-progress, #2f6fdb))',
    icon: 'var(--sonicframe-button-icon, #fff)',
});

const SVG = 'http://www.w3.org/2000/svg';
const MEDIA_EVENTS = ['play', 'pause', 'ended', 'emptied'] as const;

/** Media with an exclusive button: when one starts, the others pause. */
const exclusiveMedia = new Map<HTMLMediaElement, number>();

function pauseOthers(event: Event): void {
    for (const media of exclusiveMedia.keys()) {
        if (media !== event.target && !media.paused) {
            media.pause();
        }
    }
}

export class PlayButton {
    /** The `<button>` element, to place or label it further. */
    readonly element: HTMLButtonElement;
    private readonly icon: SVGSVGElement;
    private readonly path: SVGPathElement;
    private readonly events = new Emitter<PlayButtonEvents>();
    private readonly labels: { play: string; pause: string };
    private readonly exclusive: boolean;
    private look: ButtonLook;
    private media: HTMLMediaElement | null = null;
    private restoreStyles: () => void = () => undefined;
    private destroyed = false;

    static create(options: PlayButtonOptions): PlayButton {
        return new PlayButton(options);
    }

    constructor(options: PlayButtonOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.labels = options.labels ?? { play: 'Play', pause: 'Pause' };
        this.exclusive = options.exclusive ?? true;
        this.look = {
            shape: options.shape ?? 'circle',
            fill: options.fill ?? 'solid',
            size: options.size ?? 32,
            radius: options.radius ?? null,
            colors: { ...DEFAULT_BUTTON_COLORS, ...options.colors },
        };

        this.element = document.createElement('button');
        this.element.type = 'button';
        this.element.className = 'sonicframe-play';

        this.icon = document.createElementNS(SVG, 'svg');
        this.icon.setAttribute('viewBox', '0 0 24 24');
        this.icon.setAttribute('aria-hidden', 'true');
        this.icon.setAttribute('focusable', 'false');
        this.path = document.createElementNS(SVG, 'path');

        for (const [name, value] of [
            ['fill', 'currentColor'],
            ['stroke', 'currentColor'],
            ['stroke-width', '1.5'],
            ['stroke-linejoin', 'round'],
        ]) {
            this.path.setAttribute(name, value);
        }

        this.icon.append(this.path);
        this.element.append(this.icon);
        this.element.addEventListener('click', this.onClick);
        this.element.addEventListener('pointerenter', this.onEnter);
        this.element.addEventListener('pointerleave', this.onLeave);
        this.element.addEventListener('pointerdown', this.onPress);
        this.element.addEventListener('pointerup', this.onRelease);
        this.element.addEventListener('focus', this.onFocus);
        this.element.addEventListener('blur', this.onBlur);

        this.draw();
        options.container.append(this.element);
        this.bind(options.media ?? null);
    }

    on<Name extends keyof PlayButtonEvents>(
        event: Name,
        listener: (...args: PlayButtonEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /** Controls another media element, or none (`null`: the button is disabled). */
    bind(media: HTMLMediaElement | null): void {
        if (this.destroyed) {
            return;
        }

        this.unbindMedia();
        this.media = media;

        if (media !== null) {
            for (const type of MEDIA_EVENTS) {
                media.addEventListener(type, this.update);
            }

            if (this.exclusive) {
                const count = exclusiveMedia.get(media) ?? 0;
                exclusiveMedia.set(media, count + 1);

                if (count === 0) {
                    media.addEventListener('play', pauseOthers);
                }
            }
        }

        this.update();
    }

    /** Changes the shape, fill, size, radius or colors. */
    setLook(
        look: Partial<Omit<ButtonLook, 'colors'>> & {
            colors?: Partial<ButtonColors>;
        },
    ): void {
        this.look = {
            ...this.look,
            ...look,
            colors: { ...this.look.colors, ...look.colors },
        };
        this.draw();
    }

    /** Removes the button. Safe to call twice. */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.unbindMedia();
        this.destroyed = true;
        this.element.remove();
        this.events.emit('destroy');
        this.events.clear();
    }

    private draw(): void {
        this.restoreStyles();
        this.restoreStyles = applyStyles(
            this.element.style,
            buttonStyles(this.look),
        );

        const icon = `${iconSize(this.look.size)}px`;
        this.icon.style.setProperty('width', icon);
        this.icon.style.setProperty('height', icon);
        this.icon.style.setProperty('display', 'block');
    }

    private unbindMedia(): void {
        const media = this.media;

        if (media === null) {
            return;
        }

        for (const type of MEDIA_EVENTS) {
            media.removeEventListener(type, this.update);
        }

        if (this.exclusive) {
            const count = (exclusiveMedia.get(media) ?? 1) - 1;

            if (count > 0) {
                exclusiveMedia.set(media, count);
            } else {
                exclusiveMedia.delete(media);
                media.removeEventListener('play', pauseOthers);
            }
        }

        this.media = null;
    }

    private readonly update = (): void => {
        const playing = this.media !== null && !this.media.paused;

        this.path.setAttribute('d', playing ? pausePath() : playPath());
        this.element.setAttribute(
            'aria-label',
            playing ? this.labels.pause : this.labels.play,
        );
        this.element.title = playing ? this.labels.pause : this.labels.play;
        this.element.disabled = this.media === null;
        this.element.style.setProperty(
            'opacity',
            this.media === null ? '0.5' : '1',
        );
    };

    private readonly onClick = (): void => {
        const media = this.media;

        if (media === null) {
            return;
        }

        if (media.paused) {
            media
                .play()
                .catch((error: unknown) => this.events.emit('error', error));
        } else {
            media.pause();
        }
    };

    private readonly onEnter = (event: PointerEvent): void => {
        if (event.pointerType === 'mouse' && this.media !== null) {
            this.element.style.setProperty('opacity', '0.85');
        }
    };

    private readonly onLeave = (): void => {
        this.element.style.setProperty(
            'opacity',
            this.media === null ? '0.5' : '1',
        );
        this.element.style.setProperty('transform', 'none');
    };

    private readonly onPress = (): void => {
        this.element.style.setProperty('transform', 'scale(0.94)');
    };

    private readonly onRelease = (): void => {
        this.element.style.setProperty('transform', 'none');
    };

    /** A ring for keyboard focus only (`:focus-visible` cannot be set from inline styles). */
    private readonly onFocus = (): void => {
        if (this.element.matches(':focus-visible')) {
            this.element.style.setProperty(
                'outline',
                `2px solid ${this.look.colors.background}`,
            );
            this.element.style.setProperty('outline-offset', '2px');
        }
    };

    private readonly onBlur = (): void => {
        this.element.style.removeProperty('outline');
        this.element.style.removeProperty('outline-offset');
    };
}
