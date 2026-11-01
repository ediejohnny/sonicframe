/**
 * The pointer on a frame. A press seeks (a click, or a drag let go), unless a plugin claims it first,
 * the newest plugin first: a plugin's `'take'` owns the press at once, a `'drag'` only once it moves,
 * and a drag that never moved is a tap that seeks. A press on a lane is the lane's, never a seek.
 * With zoom on, two fingers zoom and drag the view (`pinch`) and a drag held at an edge scrolls it
 * (`edgeScroll`). The mouse hovering shows the cursor a plugin asks for.
 */

import type { Controller } from '../../core/frame/controller';
import { isDrag } from '../../core/frame/gesture';
import { applyStyles } from '../../core/shared/styles';
import { viewRatio } from '../../core/view/view';
import type { Claim, Plugin, WavePoint } from '../../types';
import { FramePinch, type PinchHost } from './frame-pinch';
import type { LaneManager } from './lanes';
import type { PluginSet } from './plugin-set';

/** A press being tracked: a plugin may own it (once its claim is active) or it is a plain seek. */
type Press = {
    box: DOMRect;
    plugin: Plugin | null;
    claim: Claim | null;
    active: boolean;
    fromX: number;
    /** The pointer's last place, moved again when the view scrolls under it at an edge. */
    last: PointerEvent;
};

/** The longest time one edge-scroll step covers, in seconds (a frame after a pause never jumps). */
const MAX_EDGE_STEP = 0.1;

/** What the pointer needs from its frame. */
export type PointerHost = PinchHost & {
    readonly container: HTMLElement;
    readonly controller: Controller;
    readonly plugins: PluginSet;
    readonly lanes: LaneManager;
    /** Asks for another animation frame. */
    schedule(): void;
};

export class FramePointer {
    private press: Press | null = null;
    private readonly pinch: FramePinch;
    /** When the last edge-scroll step ran, or null while no drag sits at an edge. */
    private edgeAt: number | null = null;
    private restoreCursor: () => void = () => undefined;

    constructor(private readonly host: PointerHost) {
        // A second finger ends whatever the first one started.
        this.pinch = new FramePinch(host, () => this.cancel());
    }

    /** Whether a press is held now. */
    get pressing(): boolean {
        return this.press !== null;
    }

    down(event: PointerEvent): void {
        if (
            this.pinch.track(event, 'down') ||
            !event.isPrimary ||
            event.button !== 0
        ) {
            return;
        }

        // A press on a lane (a caption, a timeline) is the lane's business, never a seek.
        if (this.host.lanes.contains(event.target as Node | null)) {
            return;
        }

        const box = this.host.box();
        const point = this.wavePoint(event, box);
        const claimed = this.host.plugins.claim(point);

        if (claimed !== null) {
            this.press = {
                box,
                plugin: claimed.plugin,
                claim: claimed.claim,
                active: claimed.claim === 'take',
                fromX: point.x,
                last: event,
            };

            if (this.press.active) {
                this.host.plugins.run(claimed.plugin, () =>
                    claimed.plugin.pointerMove?.(point),
                );
                this.hoverPress(event, point, claimed.plugin);
            }
        } else {
            if (!this.host.controller.pointerDown(point.ratio)) {
                return;
            }

            this.press = {
                box,
                plugin: null,
                claim: null,
                active: false,
                fromX: point.x,
                last: event,
            };
        }

        try {
            this.host.container.setPointerCapture(event.pointerId);
        } catch {
            // The pointer is already gone; the press ends with the next event.
        }
    }

    move(event: PointerEvent): void {
        if (this.pinch.track(event, 'move')) {
            return;
        }

        const press = this.press;

        if (press === null) {
            if (event.pointerType === 'mouse') {
                const point = this.wavePoint(event, this.host.box());
                this.hover(point);
                this.host.controller.hoverAt(point.ratio);
            }

            return;
        }

        press.last = event;
        this.movePress(press);

        // Held at an edge, the view keeps scrolling on the animation frames.
        if (this.edgeDepth(press) !== 0) {
            this.host.schedule();
        }
    }

    up(event: PointerEvent): void {
        if (this.pinch.track(event, 'up')) {
            return;
        }

        const press = this.press;

        if (press === null) {
            return;
        }

        this.press = null;
        const point = this.wavePoint(event, press.box);
        const plugin = press.plugin;

        if (plugin === null) {
            this.host.controller.pointerUp(point.ratio);

            return;
        }

        if (press.active) {
            this.host.plugins.run(plugin, () => plugin.pointerUp?.(point));

            // The drag is over: the cursor is again whatever lies under the mouse.
            if (event.pointerType === 'mouse') {
                this.hover(point);
            }

            return;
        }

        // A 'drag' claim that never moved is a tap: the plugin stands down and the press seeks.
        this.host.plugins.run(plugin, () => plugin.pointerCancel?.());
        this.host.controller.pointerDown(point.ratio);
        this.host.controller.pointerUp(point.ratio);
    }

    /** The browser took the pointer away (`pointercancel`): a finger leaves, and the press ends. */
    cancelled(event: PointerEvent): void {
        this.pinch.track(event, 'up');
        this.cancel();
    }

    /** Ends the press without a seek. */
    cancel(): void {
        const press = this.press;
        this.press = null;

        if (press === null) {
            return;
        }

        if (press.plugin === null) {
            this.host.controller.pointerCancel();
        } else if (press.active) {
            const plugin = press.plugin;
            this.host.plugins.run(plugin, () => plugin.pointerCancel?.());
        }
    }

    /** The mouse left the frame without a press: no hover, no plugin's cursor. */
    leave(event: PointerEvent): void {
        if (event.pointerType === 'mouse' && this.press === null) {
            this.hover(null);
            this.host.controller.hoverAt(null);
        }
    }

    /** One animation frame of a drag held at an edge: the view scrolls and the drag moves with it. */
    scrollAtEdge(now: number): void {
        const press = this.press;
        const depth = press === null ? 0 : this.edgeDepth(press);
        const zoom = this.host.view.zoom;

        if (press === null || depth === 0 || zoom === null) {
            this.edgeAt = null;

            return;
        }

        const seconds =
            this.edgeAt === null
                ? 0
                : Math.min(
                      MAX_EDGE_STEP,
                      Math.max(0, (now - this.edgeAt) / 1000),
                  );
        this.edgeAt = now;

        if (seconds > 0) {
            const { start, end } = this.host.view.current;
            this.host.view.scrollTo(
                start + depth * zoom.edgeSpeed * (end - start) * seconds,
                'edge',
            );
            this.movePress(press);
        }

        this.host.schedule();
    }

    /** Puts back the cursor a plugin had set, when the frame goes. */
    restore(): void {
        this.restoreCursor();
    }

    private wavePoint(event: PointerEvent, box: DOMRect): WavePoint {
        const x = event.clientX - box.left;
        const ratio = viewRatio(x, this.host.view.current, box.width);
        const duration = this.host.controller.duration;

        return {
            ratio,
            time: duration !== null ? ratio * duration : null,
            x,
            y: event.clientY - box.top,
            width: box.width,
            height: box.height,
            pointerType: event.pointerType,
            shiftKey: event.shiftKey,
        };
    }

    /**
     * How deep a drag sits in an edge zone (edge scrolling on): -1 to 0 at the left, 0 to 1 at the
     * right, 0 elsewhere, at the whole sound, or for a plugin's press that is not a drag yet.
     */
    private edgeDepth(press: Press): number {
        const zoom = this.host.view.zoom;
        const { start, end } = this.host.view.current;

        if (
            zoom === null ||
            !zoom.edgeScroll ||
            end - start >= 1 ||
            (press.plugin !== null && !press.active)
        ) {
            return 0;
        }

        const width = press.box.width;
        const size = Math.min(zoom.edgeSize, width / 2);
        const x = press.last.clientX - press.box.left;

        if (size <= 0) {
            return 0;
        }

        if (x < size) {
            return -Math.min(1, (size - x) / size);
        }

        return x > width - size ? Math.min(1, (x - (width - size)) / size) : 0;
    }

    /** Moves the press to where its pointer last was, through the view as it is now. */
    private movePress(press: Press): void {
        const point = this.wavePoint(press.last, press.box);

        if (press.plugin === null) {
            this.host.controller.pointerMove(point.ratio);

            return;
        }

        if (
            !press.active &&
            press.claim === 'drag' &&
            isDrag(press.fromX, point.x)
        ) {
            press.active = true;
        }

        if (press.active) {
            const plugin = press.plugin;
            this.host.plugins.run(plugin, () => plugin.pointerMove?.(point));
            this.hoverPress(press.last, point, plugin);
        }
    }

    /** A mouse drag a plugin owns shows that plugin's cursor (a closed hand, say). */
    private hoverPress(
        event: PointerEvent,
        point: WavePoint,
        plugin: Plugin,
    ): void {
        if (event.pointerType === 'mouse') {
            this.hover(point, plugin);
        }
    }

    /**
     * Shows the cursor a plugin asks for while the mouse hovers (restoring the previous one). During
     * a plugin's drag only that plugin is asked, so its cursor holds while it drags.
     */
    private hover(point: WavePoint | null, only: Plugin | null = null): void {
        const cursor = this.host.plugins.cursor(point, only);

        this.restoreCursor();
        this.restoreCursor =
            cursor === undefined
                ? () => undefined
                : applyStyles(this.host.container.style, [['cursor', cursor]]);
    }
}
