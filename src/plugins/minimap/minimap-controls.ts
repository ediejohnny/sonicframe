/**
 * The ways a person moves the minimap's box: dragging it, a click beside it (the view comes there),
 * the wheel (zoom around the pointer) and, as a slider, the arrows, Page Up/Down, Home and End. A
 * press on the strip never seeks.
 */

import { clamp01 } from '../../core/shared/math';
import { zoomView } from '../../core/view/view';
import { wheelFactor } from '../../core/view/zoom';
import type { PluginHost } from '../../types';

/** Part of the view an arrow key moves. */
const ARROW_STEP = 0.25;

/** The controls that are on, and the mouse cursor over the box, while dragging it and beside it. */
export type MinimapControlSettings = {
    drag: boolean;
    click: boolean;
    wheel: boolean;
    keys: boolean;
    cursors: { box: string; moving: string; beside: string };
};

export class MinimapControls {
    /** A drag of the box: the ratio of the sound under the pointer, from the view's start. */
    private grab: number | null = null;
    private readonly cleanups: (() => void)[] = [];

    /** Listens on the strip `element` of `frame`; with every control off, the strip lets the pointer through. */
    constructor(
        private readonly frame: PluginHost,
        private readonly element: HTMLElement,
        private readonly settings: MinimapControlSettings,
    ) {
        const { drag, click, wheel, keys } = settings;
        const pointer = drag || click || wheel || keys;
        element.style.setProperty('pointer-events', pointer ? 'auto' : 'none');

        // The wave's cursor says a press seeks; here it never does.
        if (pointer) {
            this.showCursor('default');
        }

        if (drag || click) {
            const end = (event: PointerEvent): void => this.pointerEnd(event);
            element.style.setProperty('touch-action', 'none');
            this.listen(
                'pointerdown',
                (event) => this.pointerDown(event),
                false,
            );
            this.listen('pointermove', (event) => this.pointerMove(event));
            this.listen('pointerup', end);
            this.listen('pointercancel', end);
            this.listen('lostpointercapture', end);
        }

        if (wheel) {
            this.listen('wheel', (event) => this.wheel(event), false);
        }

        if (keys) {
            this.listen('keydown', (event) => this.key(event), false);
        }
    }

    destroy(): void {
        for (const cleanup of this.cleanups.splice(0)) {
            cleanup();
        }
    }

    private listen<Name extends keyof HTMLElementEventMap>(
        type: Name,
        listener: (event: HTMLElementEventMap[Name]) => void,
        passive: boolean = true,
    ): void {
        const element = this.element;
        element.addEventListener(type, listener, { passive });
        this.cleanups.push(() => element.removeEventListener(type, listener));
    }

    /** The ratio of the sound at a pointer over the strip. */
    private ratioOf(event: { clientX: number }): number {
        const box = this.element.getBoundingClientRect();

        return box.width > 0
            ? clamp01((event.clientX - box.left) / box.width)
            : 0;
    }

    private moveTo(start: number): void {
        const { start: from, end } = this.frame.view;
        this.frame.setView(start, start + (end - from), 'minimap');
    }

    private showCursor(cursor: string): void {
        this.element.style.setProperty('cursor', cursor);
    }

    private pointerDown(event: PointerEvent): void {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        const { drag, click, keys, cursors } = this.settings;
        const at = this.ratioOf(event);
        const { start, end } = this.frame.view;

        if (at < start || at > end) {
            if (!click) {
                return;
            }

            this.moveTo(at - (end - start) / 2);
        }

        if (drag) {
            this.grab = at - this.frame.view.start;
            this.showCursor(cursors.moving);

            try {
                this.element.setPointerCapture(event.pointerId);
            } catch {
                // The pointer is already gone; the drag ends with the next event.
            }
        }

        // Holding back the browser's default also holds back its focus, so a slider takes it here.
        if (keys) {
            this.element.focus({ preventScroll: true });
        }

        event.preventDefault();
    }

    /** The cursor for a mouse at rest over the strip: over the box or beside it. */
    private hover(event: PointerEvent): void {
        if (event.pointerType !== 'mouse') {
            return;
        }

        const { cursors } = this.settings;
        const at = this.ratioOf(event);
        const { start, end } = this.frame.view;
        this.showCursor(
            at >= start && at <= end ? cursors.box : cursors.beside,
        );
    }

    private pointerMove(event: PointerEvent): void {
        if (this.grab !== null) {
            this.moveTo(this.ratioOf(event) - this.grab);
        } else {
            this.hover(event);
        }
    }

    private pointerEnd(event: PointerEvent): void {
        this.grab = null;
        this.hover(event);
    }

    private wheel(event: WheelEvent): void {
        if (event.deltaY === 0) {
            return;
        }

        event.preventDefault();
        const view = this.frame.view;
        const next = zoomView(
            view,
            view.level * wheelFactor(event.deltaY, event.deltaMode, 1),
            this.ratioOf(event),
            view.maxLevel,
        );
        this.frame.setView(next.start, next.end, 'minimap');
    }

    private key(event: KeyboardEvent): void {
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        const { start, end } = this.frame.view;
        const size = end - start;
        const moves: Record<string, number> = {
            ArrowRight: start + size * ARROW_STEP,
            ArrowUp: start + size * ARROW_STEP,
            ArrowLeft: start - size * ARROW_STEP,
            ArrowDown: start - size * ARROW_STEP,
            PageDown: start + size,
            PageUp: start - size,
            Home: 0,
            End: 1 - size,
        };
        const target = moves[event.key];

        // The strip is its own control: a key it used never reaches the wave's slider too.
        if (target !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            this.moveTo(target);
        }
    }
}
