/**
 * The volume control's bar: a keyboard slider of the level (arrows, Page Up / Page Down, Home, End)
 * that follows the pointer, drawn as a track with the level filled and a handle on it. Styles are
 * inline through the CSSOM and colors only reach color properties.
 */

import { levelAt, volumeAfterKey } from '../../core/controls/volume';
import { css } from '../../dom/shared/css';
import { prefersReducedMotion } from '../../dom/shared/motion';

/** What the bar changes: the level of a media, when there is one. */
export type VolumeBarHost = {
    /** Whether there is a media to change. */
    enabled(): boolean;
    /** The level shown, 0..1 (0 while muted). */
    level(): number;
    setLevel(level: number): void;
};

/** How the bar shows: open or folded, in the page or not at all, its sizes and its colors. */
export type VolumeBarLook = {
    open: boolean;
    visible: boolean;
    /** Its height, a CSS length. */
    height: string;
    /** Its width while open, in CSS pixels. */
    width: number;
    track: string;
    fill: string;
};

export class VolumeBar {
    readonly element: HTMLDivElement = document.createElement('div');
    private readonly rail: HTMLDivElement = document.createElement('div');
    private readonly track: HTMLDivElement = document.createElement('div');
    private readonly fill: HTMLDivElement = document.createElement('div');
    private readonly handle: HTMLDivElement = document.createElement('div');
    /** The pointer dragging the level, or null. */
    private dragging: number | null = null;

    /** A slider named `label`, whose arrow keys move the level by `step`. */
    constructor(
        private readonly host: VolumeBarHost,
        label: string,
        private readonly step: number,
    ) {
        const bar = this.element;
        bar.className = 'sonicframe-volume-bar';
        bar.setAttribute('role', 'slider');
        bar.setAttribute('aria-label', label);
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        this.rail.append(this.track, this.fill, this.handle);
        bar.append(this.rail);

        bar.addEventListener('keydown', this.onKey);
        bar.addEventListener('pointerdown', this.onPress);
        bar.addEventListener('pointermove', this.onMove);
        bar.addEventListener('pointerup', this.onRelease);
        bar.addEventListener('pointercancel', this.onRelease);
    }

    /** Whether a pointer is dragging the level. */
    get held(): boolean {
        return this.dragging !== null;
    }

    draw(look: VolumeBarLook): void {
        css(this.element, [
            ['display', look.visible ? 'block' : 'none'],
            ['position', 'relative'],
            ['box-sizing', 'border-box'],
            ['flex-shrink', '0'],
            ['width', look.open ? `${Math.max(0, look.width)}px` : '0px'],
            ['height', look.height],
            ['padding', look.open ? '0 0.375rem' : '0'],
            ['overflow', 'hidden'],
            ['cursor', 'pointer'],
            ['touch-action', 'none'],
            [
                'transition',
                prefersReducedMotion() ? 'none' : 'width 120ms ease-out',
            ],
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
            ['background-color', look.track],
        ]);
        css(this.fill, [...line, ['background-color', look.fill]]);
        css(this.handle, [
            ['position', 'absolute'],
            ['top', '50%'],
            ['width', '0.75rem'],
            ['height', '0.75rem'],
            ['margin', '-0.375rem 0 0 -0.375rem'],
            ['border-radius', '50%'],
            ['background-color', look.fill],
        ]);
    }

    /** Shows the level as `percent` with its words; a bar without media is disabled and out of the tab order. */
    show(percent: string, text: string, enabled: boolean): void {
        const bar = this.element;
        bar.setAttribute('aria-valuenow', percent);
        bar.setAttribute('aria-valuetext', text);
        bar.setAttribute('aria-disabled', String(!enabled));
        bar.tabIndex = enabled ? 0 : -1;
        this.fill.style.setProperty('width', `${percent}%`);
        this.handle.style.setProperty('left', `${percent}%`);
    }

    private readonly onKey = (event: KeyboardEvent): void => {
        if (
            !this.host.enabled() ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
        ) {
            return;
        }

        const next = volumeAfterKey(event.key, this.host.level(), this.step);

        if (next !== null) {
            event.preventDefault();
            this.host.setLevel(next);
        }
    };

    private readonly onPress = (event: PointerEvent): void => {
        if (!this.host.enabled() || event.button !== 0) {
            return;
        }

        event.preventDefault();
        this.dragging = event.pointerId;

        try {
            this.element.setPointerCapture(event.pointerId);
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
        this.host.setLevel(levelAt(event.clientX - box.left, box.width));
    }
}
