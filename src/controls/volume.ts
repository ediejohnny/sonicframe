/**
 * A volume control for an audio or video element: a speaker button that mutes and unmutes (its icon
 * follows the level) and a bar that is a keyboard slider (arrows, Page Up / Page Down, Home, End) and
 * follows the pointer. It follows the media's own `volume` and `muted` both ways, so several controls
 * (or the browser's own) stay in step. Styles are inline through the CSSOM and colors only reach
 * color properties. Where the browser does not let a page set the volume (iOS), only the mute button
 * shows.
 */

import { Emitter } from '../core/emitter';
import {
    clampLevel,
    levelAt,
    SPEAKER_PATH,
    unmutedLevel,
    VOLUME_MARKS,
    volumeAfterKey,
    volumeIcon,
    volumeText,
} from '../core/volume';
import { hideFocusRing, showFocusRing } from './focus';

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
    icon: 'var(--sonicframe-button, var(--sonicframe-progress, #2f6fdb))',
    track: 'var(--sonicframe-wave, #c4cad4)',
    fill: 'var(--sonicframe-progress, #2f6fdb)',
});

const SVG = 'http://www.w3.org/2000/svg';

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

function css(
    element: HTMLElement | SVGElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}

export class VolumeControl {
    /** The control's root element, to place it further. */
    readonly element: HTMLDivElement;
    private readonly button: HTMLButtonElement;
    private readonly icon: SVGSVGElement;
    private readonly marks: SVGPathElement;
    private readonly bar: HTMLDivElement;
    private readonly rail: HTMLDivElement;
    private readonly track: HTMLDivElement;
    private readonly fill: HTMLDivElement;
    private readonly handle: HTMLDivElement;
    private readonly events = new Emitter<VolumeControlEvents>();
    private readonly labels: { mute: string; unmute: string; volume: string };
    private readonly step: number;
    private slider: 'always' | 'hover';
    private size: number;
    private width: number;
    private colors: VolumeColors;
    private media: HTMLMediaElement | null = null;
    private dragging: number | null = null;
    private open = false;
    private destroyed = false;

    static create(options: VolumeControlOptions): VolumeControl {
        return new VolumeControl(options);
    }

    constructor(options: VolumeControlOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.labels = options.labels ?? {
            mute: 'Mute',
            unmute: 'Unmute',
            volume: 'Volume',
        };
        this.step = options.step ?? 0.05;
        this.slider = options.slider ?? 'always';
        this.size = options.size ?? 32;
        this.width = options.width ?? 80;
        this.colors = { ...DEFAULT_VOLUME_COLORS, ...options.colors };

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-volume';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'sonicframe-volume-button';
        this.icon = document.createElementNS(SVG, 'svg');
        this.icon.setAttribute('viewBox', '0 0 24 24');
        this.icon.setAttribute('aria-hidden', 'true');
        this.icon.setAttribute('focusable', 'false');
        const speaker = document.createElementNS(SVG, 'path');
        speaker.setAttribute('d', SPEAKER_PATH);
        speaker.setAttribute('fill', 'currentColor');
        this.marks = document.createElementNS(SVG, 'path');

        for (const [name, value] of [
            ['fill', 'none'],
            ['stroke', 'currentColor'],
            ['stroke-width', '1.8'],
            ['stroke-linecap', 'round'],
        ]) {
            this.marks.setAttribute(name, value);
        }

        this.icon.append(speaker, this.marks);
        this.button.append(this.icon);

        this.bar = document.createElement('div');
        this.bar.className = 'sonicframe-volume-bar';
        this.bar.setAttribute('role', 'slider');
        this.bar.setAttribute('aria-label', this.labels.volume);
        this.bar.setAttribute('aria-valuemin', '0');
        this.bar.setAttribute('aria-valuemax', '100');
        this.rail = document.createElement('div');
        this.track = document.createElement('div');
        this.fill = document.createElement('div');
        this.handle = document.createElement('div');
        this.rail.append(this.track, this.fill, this.handle);
        this.bar.append(this.rail);
        this.element.append(this.button, this.bar);

        this.button.addEventListener('click', this.onToggle);
        this.button.addEventListener('focus', this.onFocus);
        this.button.addEventListener('blur', this.onBlur);
        this.bar.addEventListener('keydown', this.onKey);
        this.bar.addEventListener('pointerdown', this.onPress);
        this.bar.addEventListener('pointermove', this.onMove);
        this.bar.addEventListener('pointerup', this.onRelease);
        this.bar.addEventListener('pointercancel', this.onRelease);
        this.bar.addEventListener('focus', this.onFocus);
        this.bar.addEventListener('blur', this.onBlur);
        this.element.addEventListener('pointerenter', this.onOpen);
        this.element.addEventListener('pointerleave', this.onClose);
        this.element.addEventListener('focusin', this.onOpen);
        this.element.addEventListener('focusout', this.onClose);

        this.draw();
        options.container.append(this.element);
        this.bind(options.media ?? null);
    }

    on<Name extends keyof VolumeControlEvents>(
        event: Name,
        listener: (...args: VolumeControlEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

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
        const shown = this.slider === 'always' || this.open;

        css(this.element, [
            ['display', 'inline-flex'],
            ['align-items', 'center'],
            ['gap', '0.25rem'],
            ['flex-shrink', '0'],
        ]);
        css(this.button, [
            ['display', 'inline-grid'],
            ['place-items', 'center'],
            ['box-sizing', 'border-box'],
            ['flex-shrink', '0'],
            ['width', size],
            ['height', size],
            ['margin', '0'],
            ['padding', '0'],
            ['border-width', '0'],
            ['border-radius', '50%'],
            // Not the `background` shorthand: it would take url(...) from a color and fetch it.
            ['background-color', 'transparent'],
            ['color', this.colors.icon],
            ['line-height', '0'],
            ['cursor', 'pointer'],
            ['appearance', 'none'],
            ['-webkit-tap-highlight-color', 'transparent'],
        ]);
        css(this.icon, [
            ['width', icon],
            ['height', icon],
            ['display', 'block'],
        ]);
        css(this.bar, [
            ['display', volumeIsSettable() ? 'block' : 'none'],
            ['position', 'relative'],
            ['box-sizing', 'border-box'],
            ['flex-shrink', '0'],
            ['width', shown ? `${Math.max(0, this.width)}px` : '0px'],
            ['height', size],
            ['padding', shown ? '0 0.375rem' : '0'],
            ['overflow', 'hidden'],
            ['cursor', 'pointer'],
            ['touch-action', 'none'],
            ['transition', reducedMotion() ? 'none' : 'width 120ms ease-out'],
        ]);
        css(this.rail, [
            ['position', 'relative'],
            ['width', '100%'],
            ['height', '100%'],
        ]);

        const line: [string, string][] = [
            ['position', 'absolute'],
            ['left', '0'],
            ['top', '50%'],
            ['height', '0.25rem'],
            ['margin-top', '-0.125rem'],
            ['border-radius', '0.125rem'],
        ];

        css(this.track, [
            ...line,
            ['right', '0'],
            ['background-color', this.colors.track],
        ]);
        css(this.fill, [...line, ['background-color', this.colors.fill]]);
        css(this.handle, [
            ['position', 'absolute'],
            ['top', '50%'],
            ['width', '0.75rem'],
            ['height', '0.75rem'],
            ['margin', '-0.375rem 0 0 -0.375rem'],
            ['border-radius', '50%'],
            ['background-color', this.colors.fill],
        ]);
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
        this.bar.setAttribute('aria-valuenow', percent);
        this.bar.setAttribute(
            'aria-valuetext',
            volumeText(volume, media === null || muted),
        );
        this.bar.setAttribute('aria-disabled', String(media === null));
        this.bar.tabIndex = media === null ? -1 : 0;
        this.fill.style.setProperty('width', `${percent}%`);
        this.handle.style.setProperty('left', `${percent}%`);
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

    private readonly onKey = (event: KeyboardEvent): void => {
        if (
            this.media === null ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
        ) {
            return;
        }

        const next = volumeAfterKey(event.key, this.shown(), this.step);

        if (next !== null) {
            event.preventDefault();
            this.setLevel(next);
        }
    };

    private readonly onPress = (event: PointerEvent): void => {
        if (this.media === null || event.button !== 0) {
            return;
        }

        event.preventDefault();
        this.dragging = event.pointerId;

        try {
            this.bar.setPointerCapture(event.pointerId);
        } catch {
            // A synthetic or already-released pointer cannot be captured; the press still counts.
        }

        this.levelFrom(event);
    };

    private readonly onMove = (event: PointerEvent): void => {
        if (this.dragging === event.pointerId) {
            this.levelFrom(event);
        }
    };

    private readonly onRelease = (event: PointerEvent): void => {
        if (this.dragging === event.pointerId) {
            this.dragging = null;
        }
    };

    private levelFrom(event: PointerEvent): void {
        const box = this.rail.getBoundingClientRect();
        this.setLevel(levelAt(event.clientX - box.left, box.width));
    }

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
            this.dragging === null
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

function reducedMotion(): boolean {
    return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}
