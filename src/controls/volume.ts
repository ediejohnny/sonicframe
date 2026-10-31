/**
 * A volume control for an audio or video element: a speaker button that mutes and unmutes (its icon
 * follows the level) and a bar that is a keyboard slider (arrows, Page Up / Page Down, Home, End) and
 * follows the pointer. It follows the media's own `volume` and `muted` both ways, so several controls
 * (or the browser's own) stay in step. Styles are inline through the CSSOM and colors only reach
 * color properties. Where the browser does not let a page set the volume (iOS), only the mute button
 * shows.
 */

import { iconButtonBox } from '../core/controls/button';
import {
    clampLevel,
    SPEAKER_PATH,
    unmutedLevel,
    VOLUME_MARKS,
    volumeIcon,
    volumeText,
} from '../core/controls/volume';
import { EN } from '../core/languages/en';
import { Emitter } from '../core/shared/emitter';
import { BUTTON, PROGRESS, WAVE } from '../core/shared/variables';
import { css } from '../dom/css';
import { iconElement, iconPath } from '../dom/icon';
import { hideFocusRing, showFocusRing } from './focus';
import { VolumeBar } from './volume-bar';

export type VolumeColors = {
    /** The speaker icon. */
    icon: string;
    /** The bar behind the level. */
    track: string;
    /** The level and its handle. */
    fill: string;
};

export type VolumeControlOptions = {
    /** The element the control is added to. */
    container: HTMLElement;
    media?: HTMLMediaElement | null;
    /** `'always'` (default) shows the bar beside the speaker; `'hover'` opens it on hover or focus. */
    slider?: 'always' | 'hover';
    /** Width and height of the speaker button, and height of the bar, in CSS pixels; 32 by default. */
    size?: number;
    /** Width of the bar in CSS pixels; 80 by default. */
    width?: number;
    /** How far an arrow key moves the level (0..1); 0.05 by default. */
    step?: number;
    colors?: Partial<VolumeColors>;
    /** Accessible names. */
    labels?: { mute: string; unmute: string; volume: string };
};

export type VolumeControlEvents = {
    destroy: [];
};

export const DEFAULT_VOLUME_COLORS: Readonly<VolumeColors> = Object.freeze({
    icon: BUTTON,
    track: WAVE,
    fill: PROGRESS,
});

let settable: boolean | undefined;

/** Whether this browser lets a page set the volume (iOS keeps it at 1 and ignores the change). */
function volumeIsSettable(): boolean {
    if (settable === undefined) {
        try {
            const probe = document.createElement('audio');
            probe.volume = 0.5;
            settable = probe.volume === 0.5;
        } catch {
            settable = false;
        }
    }

    return settable;
}

export class VolumeControl {
    /** The control's root element, to place it further. */
    readonly element: HTMLDivElement;
    private readonly button: HTMLButtonElement;
    private readonly icon: SVGSVGElement;
    private readonly marks: SVGPathElement;
    private readonly bar: VolumeBar;
    private readonly events = new Emitter<VolumeControlEvents>();
    private readonly labels: { mute: string; unmute: string; volume: string };
    private slider: 'always' | 'hover';
    private size: number;
    private width: number;
    private colors: VolumeColors;
    private media: HTMLMediaElement | null = null;
    private open = false;
    private destroyed = false;

    static create(options: VolumeControlOptions): VolumeControl {
        return new VolumeControl(options);
    }

    constructor(options: VolumeControlOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.labels = options.labels ?? EN.volume;
        this.slider = options.slider ?? 'always';
        this.size = options.size ?? 32;
        this.width = options.width ?? 80;
        this.colors = { ...DEFAULT_VOLUME_COLORS, ...options.colors };

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-volume';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'sonicframe-volume-button';
        this.icon = iconElement();
        this.marks = iconPath({
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
        });
        this.icon.append(
            iconPath({ d: SPEAKER_PATH, fill: 'currentColor' }),
            this.marks,
        );
        this.button.append(this.icon);

        this.bar = new VolumeBar(
            {
                enabled: () => this.media !== null,
                level: () => this.shown(),
                setLevel: (level) => this.setLevel(level),
            },
            this.labels.volume,
            options.step ?? 0.05,
        );
        this.element.append(this.button, this.bar.element);

        this.button.addEventListener('click', this.onToggle);
        this.button.addEventListener('focus', this.onFocus);
        this.button.addEventListener('blur', this.onBlur);
        this.bar.element.addEventListener('focus', this.onFocus);
        this.bar.element.addEventListener('blur', this.onBlur);
        this.element.addEventListener('pointerenter', this.onOpen);
        this.element.addEventListener('pointerleave', this.onClose);
        this.element.addEventListener('focusin', this.onOpen);
        this.element.addEventListener('focusout', this.onClose);

        this.draw();
        options.container.append(this.element);
        this.bind(options.media ?? null);
    }

    // jscpd:ignore-start: the same `on` as every control with events, the shape of the API, not a copy.
    on<Name extends keyof VolumeControlEvents>(
        event: Name,
        listener: (...args: VolumeControlEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }
    // jscpd:ignore-end

    /** Controls another media element, or none (`null`: the control is disabled). */
    bind(media: HTMLMediaElement | null): void {
        if (this.destroyed) {
            return;
        }

        this.media?.removeEventListener('volumechange', this.update);
        this.media = media;
        media?.addEventListener('volumechange', this.update);
        this.update();
    }

    /** Changes how the bar shows, the sizes or the colors. */
    setLook(
        look: Partial<{
            slider: 'always' | 'hover';
            size: number;
            width: number;
            colors: Partial<VolumeColors>;
        }>,
    ): void {
        this.slider = look.slider ?? this.slider;
        this.size = look.size ?? this.size;
        this.width = look.width ?? this.width;
        this.colors = { ...this.colors, ...look.colors };
        this.draw();
        this.update();
    }

    /** Removes the control. Safe to call twice. */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.media?.removeEventListener('volumechange', this.update);
        this.media = null;
        this.destroyed = true;
        this.element.remove();
        this.events.emit('destroy');
        this.events.clear();
    }

    private draw(): void {
        const size = `${Math.max(1, this.size)}px`;
        const icon = `${Math.max(8, Math.round(this.size * 0.66))}px`;

        css(this.element, [
            ['display', 'inline-flex'],
            ['align-items', 'center'],
            ['gap', '0.25rem'],
            ['flex-shrink', '0'],
        ]);
        css(this.button, [
            ...iconButtonBox(size),
            ['box-sizing', 'border-box'],
            ['border-width', '0'],
            ['border-radius', '50%'],
            // Not the `background` shorthand: it would take url(...) from a color and fetch it.
            ['background-color', 'transparent'],
            ['color', this.colors.icon],
            ['-webkit-tap-highlight-color', 'transparent'],
        ]);
        css(this.icon, [
            ['width', icon],
            ['height', icon],
            ['display', 'block'],
        ]);
        this.bar.draw({
            open: this.slider === 'always' || this.open,
            visible: volumeIsSettable(),
            height: size,
            width: this.width,
            track: this.colors.track,
            fill: this.colors.fill,
        });
    }

    /** The level shown: 0 while muted. */
    private shown(): number {
        const media = this.media;

        return media === null || media.muted ? 0 : clampLevel(media.volume);
    }

    private setLevel(level: number): void {
        const media = this.media;

        if (media === null) {
            return;
        }

        const value = clampLevel(level);
        media.volume = value;

        if (value > 0 && media.muted) {
            media.muted = false;
        }

        this.update();
    }

    private readonly update = (): void => {
        const media = this.media;
        const volume = media?.volume ?? 1;
        const muted = media?.muted ?? false;
        const silent = muted || !(volume > 0);
        const percent = `${Math.round(this.shown() * 100)}`;
        const label = silent ? this.labels.unmute : this.labels.mute;

        this.marks.setAttribute('d', VOLUME_MARKS[volumeIcon(volume, muted)]);
        this.button.setAttribute('aria-label', label);
        this.button.title = label;
        this.button.disabled = media === null;
        this.button.style.setProperty('opacity', media === null ? '0.5' : '1');
        this.bar.show(
            percent,
            volumeText(volume, media === null || muted),
            media !== null,
        );
    };

    private readonly onToggle = (): void => {
        const media = this.media;

        if (media === null) {
            return;
        }

        if (media.muted || !(media.volume > 0)) {
            media.volume = unmutedLevel(media.volume);
            media.muted = false;
        } else {
            media.muted = true;
        }

        this.update();
    };

    private readonly onOpen = (): void => {
        if (this.slider === 'hover' && !this.open) {
            this.open = true;
            this.draw();
        }
    };

    private readonly onClose = (event: Event): void => {
        const focusStays =
            event.type === 'pointerleave' &&
            this.element.contains(document.activeElement);
        const pointerStays =
            event.type === 'focusout' && this.element.matches(':hover');

        if (
            this.slider === 'hover' &&
            this.open &&
            !focusStays &&
            !pointerStays &&
            !this.bar.held
        ) {
            this.open = false;
            this.draw();
        }
    };

    private readonly onFocus = (event: FocusEvent): void => {
        const target = event.currentTarget as HTMLElement;

        if (target.matches(':focus-visible')) {
            showFocusRing(target, this.colors.fill);
        }
    };

    private readonly onBlur = (event: FocusEvent): void => {
        hideFocusRing(event.currentTarget as HTMLElement);
    };
}
