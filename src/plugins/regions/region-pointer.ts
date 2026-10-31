/**
 * The pointer on the regions: a press on a region's body moves it and one on an edge resizes it, each
 * edge with a touch-sized grab zone (`hitRegion`, WCAG 2.5.8); a drag (or a Shift-drag) off every
 * region draws a new one, while there is room for one. Zoomed in, the grab zones follow the view. The
 * mouse hovering shows what a press would do.
 */

import {
    hitRegion,
    type LaidRegion,
    type RegionPart,
} from '../../core/marks/regions';
import { clamp01 } from '../../core/shared/math';
import { FULL_VIEW, viewX } from '../../core/view/view';
import type { WavePoint } from '../../types';
import type { RegionsHost } from './region-store';

/** An edge's grab zone, in CSS pixels on each side of it. */
const EDGE_PX = 12;

/** How the pointer makes and changes regions. */
export type RegionPointerSettings = {
    /** How a region is drawn: by a Shift-drag, by any drag, or not at all. */
    create: 'shift-drag' | 'drag' | false;
    /** The mouse cursor over a region's body, while moving one, and over an edge. */
    cursors: { body: string; moving: string; edge: string };
};

export class RegionPointer {
    private drag: {
        mode: 'create' | 'move' | 'resize';
        id: string;
        part?: RegionPart;
        grab: number;
    } | null = null;

    constructor(
        private readonly host: RegionsHost,
        private readonly settings: RegionPointerSettings,
    ) {}

    hover(point: WavePoint | null): string | void {
        if (point === null) {
            return;
        }

        const { cursors } = this.settings;

        if (this.drag !== null) {
            return this.drag.mode === 'move' ? cursors.moving : cursors.edge;
        }

        const hit = this.hitAt(point);

        if (hit === null) {
            return;
        }

        return hit.part === 'body' ? cursors.body : cursors.edge;
    }

    down(point: WavePoint): 'take' | 'drag' | void {
        if (this.host.duration() === null) {
            return;
        }

        const hit = this.hitAt(point);

        if (hit !== null) {
            this.host.select(hit.id);
            this.drag = {
                mode: hit.part === 'body' ? 'move' : 'resize',
                id: hit.id,
                part: hit.part,
                grab: point.time ?? 0,
            };

            return 'take';
        }

        const create = this.settings.create;
        const mayCreate =
            create === 'drag' || (create === 'shift-drag' && point.shiftKey);

        if (mayCreate && !this.host.store.full) {
            this.drag = { mode: 'create', id: '', grab: point.time ?? 0 };

            return 'drag';
        }
    }

    move(point: WavePoint): void {
        const drag = this.drag;
        const span = this.host.duration();

        if (drag === null || span === null) {
            return;
        }

        const store = this.host.store;
        const at = point.time ?? 0;

        if (drag.mode === 'create') {
            if (drag.id === '') {
                const created = store.add({ start: drag.grab, end: at }, span);

                if (created === null) {
                    this.drag = null;

                    return;
                }

                drag.id = created.id;
                this.host.select(drag.id);
            } else {
                const region = store.byId(drag.id);

                if (region !== undefined) {
                    const bounds = store.normalized(drag.grab, at, span);
                    region.start = bounds.start;
                    region.end = bounds.end;
                }
            }

            this.host.changed();

            return;
        }

        const region = store.byId(drag.id);

        if (region === undefined) {
            return;
        }

        if (drag.mode === 'resize') {
            const bounds =
                drag.part === 'start'
                    ? store.normalized(at, region.end, span)
                    : store.normalized(region.start, at, span);
            region.start = bounds.start;
            region.end = bounds.end;
        } else {
            const shift = at - drag.grab;
            const length = region.end - region.start;
            let from = region.start + shift;
            from = Math.max(0, Math.min(from, span - length));
            region.start = from;
            region.end = from + length;
            drag.grab = at;
        }

        this.host.changed();
    }

    up(): void {
        if (this.drag !== null) {
            this.host.told();
            this.drag = null;
        }
    }

    /** The press ended without a release: a region being drawn goes. */
    cancel(): void {
        const drag = this.drag;

        if (drag !== null && drag.mode === 'create' && drag.id !== '') {
            this.host.store.remove(drag.id);
            this.host.changed();
        }

        this.drag = null;
    }

    /** The regions across `width` CSS pixels through the view, topmost first, and their ids. */
    private laid(
        width: number,
        span: number,
    ): {
        laid: LaidRegion[];
        ids: string[];
    } {
        const { items, selectedId } = this.host.store;
        // Topmost first: the selected region, then the newest, so a click lands on what is on top.
        const order = [...items].reverse();
        const ranked =
            selectedId === null
                ? order
                : [
                      ...order.filter((region) => region.id === selectedId),
                      ...order.filter((region) => region.id !== selectedId),
                  ];
        const view = this.host.frame()?.view ?? FULL_VIEW;

        return {
            laid: ranked.map((region) => ({
                start: viewX(clamp01(region.start / span), view, width),
                end: viewX(clamp01(region.end / span), view, width),
            })),
            ids: ranked.map((region) => region.id),
        };
    }

    private hitAt(point: WavePoint): {
        id: string;
        part: RegionPart;
    } | null {
        const span = this.host.duration();

        if (span === null) {
            return null;
        }

        const { laid, ids } = this.laid(point.width, span);
        const hit = hitRegion(point.x, laid, EDGE_PX);

        return hit === null ? null : { id: ids[hit.index], part: hit.part };
    }
}
