/**
 * Two fingers on a frame (zoom's `pinch` on): spreading them zooms around their middle and moving
 * them drags the view. While two fingers are down, the pinch owns every touch pointer.
 */

import { fitView, viewLevel, viewRatio } from '../../core/view/view';
import type { FrameView } from './frame-view';

/** Where the fingers started, and the sound that was between them. */
type Pinch = { distance: number; level: number; anchor: number };

/** What the pinch needs from its frame. */
export type PinchHost = {
    readonly view: FrameView;
    /** The wave's box on the page. */
    box(): DOMRect;
    /** The largest zoom now. */
    maxLevel(): number;
};

export class FramePinch {
    /** The touch pointers down on the frame. */
    private readonly touches = new Map<number, { x: number; y: number }>();
    private pinch: Pinch | null = null;

    /** `cancel` ends whatever the first finger started, as the second one lands. */
    constructor(
        private readonly host: PinchHost,
        private readonly cancel: () => void,
    ) {}

    /**
     * Tracks a touch pointer. Returns true while two fingers are down, when the pointer belongs to
     * the pinch and nothing else should see it.
     */
    track(event: PointerEvent, phase: 'down' | 'move' | 'up'): boolean {
        const view = this.host.view;

        if (!view.zoom?.pinch || event.pointerType !== 'touch') {
            return false;
        }

        if (phase === 'up') {
            this.touches.delete(event.pointerId);

            if (this.pinch !== null && this.touches.size < 2) {
                this.pinch = null;
                view.announce();

                return true;
            }

            return this.pinch !== null;
        }

        this.touches.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });

        if (this.touches.size !== 2) {
            return this.pinch !== null;
        }

        const [a, b] = [...this.touches.values()];
        const box = this.host.box();
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const middle = (a.x + b.x) / 2 - box.left;

        if (this.pinch === null) {
            this.cancel();
            this.pinch = {
                distance,
                level: viewLevel(view.current),
                anchor: viewRatio(middle, view.current, box.width),
            };

            return true;
        }

        const maxLevel = this.host.maxLevel();
        const span =
            1 /
            Math.min(
                maxLevel,
                Math.max(
                    1,
                    (this.pinch.level * distance) / this.pinch.distance,
                ),
            );
        const start =
            this.pinch.anchor - (box.width > 0 ? middle / box.width : 0) * span;
        view.move(fitView(start, start + span, maxLevel), 'pinch');

        return true;
    }
}
