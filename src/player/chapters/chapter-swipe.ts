/**
 * The swipe that opens the player's list of chapters (`swipe` on): a finger swiping off the wave
 * opens the list one way and closes it the other. The parts off the wave let the page pan only
 * across the swipe (see `zones`), so the swipe reaches the player, and the wave keeps its own way of
 * moving.
 */

import { remPixels } from '../../dom/shared/units';
import type { PlayerLayout } from '../player/player-layout';

/** The swipes that open the list: along which axis, and which way (-1 up or left, 1 down or right). */
const SWIPES = {
    up: { axis: 'y', sign: -1 },
    down: { axis: 'y', sign: 1 },
    left: { axis: 'x', sign: -1 },
    right: { axis: 'x', sign: 1 },
} as const;

/** The shortest swipe that counts, in rem. */
const SWIPE_REM = 3;

/** What the swipe needs from its player. */
export type SwipeHost = {
    /** The player's root element, where a finger comes down. */
    readonly element: HTMLElement;
    /** Fires when the player is destroyed. */
    readonly signal: AbortSignal;
    /** The player's main line, as built now. */
    layout(): PlayerLayout | null;
    /** Opens or closes the list. */
    setOpen(open: boolean): void;
};

export class ChapterSwipe {
    /** Where a finger came down off the wave. */
    private start: { id: number; x: number; y: number } | null = null;

    constructor(
        private readonly direction: keyof typeof SWIPES,
        private readonly host: SwipeHost,
    ) {
        const { element, signal } = host;
        const onWave = (target: EventTarget | null): boolean =>
            target instanceof Node &&
            (host.layout()?.box.contains(target) ?? false);

        element.addEventListener(
            'pointerdown',
            (event) => {
                this.start =
                    event.pointerType === 'touch' && !onWave(event.target)
                        ? {
                              id: event.pointerId,
                              x: event.clientX,
                              y: event.clientY,
                          }
                        : null;
            },
            { signal },
        );
        element.addEventListener(
            'pointercancel',
            () => {
                this.start = null;
            },
            { signal },
        );
        element.addEventListener(
            'pointerup',
            (event) => {
                const start = this.start;
                this.start = null;

                if (start === null || start.id !== event.pointerId) {
                    return;
                }

                const along = SWIPES[this.direction];
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                const main = along.axis === 'x' ? dx : dy;
                const across = along.axis === 'x' ? dy : dx;

                if (
                    Math.abs(main) < remPixels(SWIPE_REM) ||
                    Math.abs(main) <= Math.abs(across)
                ) {
                    return;
                }

                this.host.setOpen(Math.sign(main) === along.sign);
            },
            { signal },
        );
    }

    /**
     * The parts off the wave, where a swipe starts: the line's other parts and the rows under the
     * wave. Each lets the page pan only across the swipe.
     */
    zones(layout: PlayerLayout): void {
        const column = layout.column;
        const zones = [
            ...[...layout.line.children].filter((part) => part !== column),
            ...[...column.children].filter((row) => row !== layout.box),
        ] as HTMLElement[];
        const pan = SWIPES[this.direction].axis === 'x' ? 'pan-y' : 'pan-x';

        for (const zone of zones) {
            zone.style.setProperty('touch-action', pan);
        }
    }
}
