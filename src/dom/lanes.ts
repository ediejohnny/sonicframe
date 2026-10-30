/**
 * The strips a plugin stacks above and below the bars (a caption, a timeline). Each lane is an
 * absolutely-positioned element inside the frame's container; the canvas is inset from the top and
 * bottom to leave room, so the wave simply shrinks. `stackLanes` (pure core) decides the split and
 * drops lanes that would starve the wave; this manager only places elements and sizes the canvas.
 */

import { stackLanes } from '../core/lanes';
import type { Lane } from '../types';

type Side = 'above' | 'below';
type Record = { side: Side; size: number; element: HTMLElement };

export class LaneManager {
    private readonly records: Record[] = [];
    /** CSS pixels the lanes took above and below the bars at the last layout. */
    private taken = { top: 0, bottom: 0 };

    constructor(
        private readonly container: HTMLElement,
        private readonly canvas: HTMLCanvasElement,
        private readonly onChange: () => void,
    ) {}

    /** Adds a lane and asks the frame to lay out again. */
    add(side: Side, size: number): Lane {
        const element = document.createElement('div');

        for (const [property, value] of [
            ['position', 'absolute'],
            ['left', '0'],
            ['right', '0'],
            ['overflow', 'hidden'],
            // Display-only by default; a plugin opts its own lane into pointer events.
            ['pointer-events', 'none'],
            ['display', 'none'],
        ]) {
            element.style.setProperty(property, value);
        }

        this.container.append(element);
        const record: Record = { side, size: Math.max(0, size), element };
        this.records.push(record);
        this.onChange();

        return {
            element,
            setSize: (cssPixels: number): void => {
                record.size = Math.max(0, cssPixels);
                this.onChange();
            },
            remove: (): void => {
                const at = this.records.indexOf(record);

                if (at >= 0) {
                    this.records.splice(at, 1);
                    record.element.remove();
                    this.onChange();
                }
            },
        };
    }

    /** Whether a node is inside one of the lanes (so a press there is not a seek). */
    contains(node: Node | null): boolean {
        return (
            node !== null &&
            this.records.some(
                (record) =>
                    record.element === node || record.element.contains(node),
            )
        );
    }

    /**
     * Positions the lanes and insets the canvas for a container `heightCss` CSS pixels tall. Returns
     * the height, in CSS pixels, left for the wave.
     */
    layout(heightCss: number): number {
        const above = this.records.filter(
            (record) => record.side === 'above' && record.size > 0,
        );
        const below = this.records.filter(
            (record) => record.side === 'below' && record.size > 0,
        );
        const inset = stackLanes(
            above.map((record) => record.size),
            below.map((record) => record.size),
            heightCss,
        );

        for (const record of this.records) {
            record.element.style.setProperty('display', 'none');
        }

        let top = inset.top;
        for (let i = 0; i < inset.above.length; i++) {
            top -= above[i].size;
            place(above[i].element, top, above[i].size);
        }

        let bottom = inset.top + inset.waveHeight;
        for (let i = 0; i < inset.below.length; i++) {
            place(below[i].element, bottom, below[i].size);
            bottom += below[i].size;
        }

        this.taken = { top: inset.top, bottom: inset.bottom };
        const taken = inset.top + inset.bottom;
        this.canvas.style.setProperty('top', `${inset.top}px`);
        this.canvas.style.setProperty(
            'height',
            taken === 0 ? '100%' : `calc(100% - ${taken}px)`,
        );

        return inset.waveHeight;
    }

    /** Places an element over the bars only, clear of the lanes (as at the last layout). */
    fitToBars(element: HTMLElement): void {
        element.style.setProperty('top', `${this.taken.top}px`);
        element.style.setProperty('bottom', `${this.taken.bottom}px`);
    }

    /** Removes every lane element (on destroy). */
    dispose(): void {
        for (const record of this.records.splice(0)) {
            record.element.remove();
        }
    }
}

function place(element: HTMLElement, top: number, height: number): void {
    element.style.setProperty('display', 'block');
    element.style.setProperty('top', `${top}px`);
    element.style.setProperty('height', `${height}px`);
}
