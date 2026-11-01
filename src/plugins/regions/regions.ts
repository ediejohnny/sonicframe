/**
 * Regions: stretches of the sound a listener can mark, play or loop. A band is drawn over the bars
 * with its edges and an optional label; the pointer creates one by Shift-dragging (so a plain drag
 * still scrubs), moves it by its body and resizes it by an edge, and the keyboard selects, plays,
 * loops, nudges and deletes while the frame has focus. Regions never invert or fall below a minimum
 * length (pure `normalizeRegion`), and every edge has a touch-sized grab zone (`hitRegion`). Zoomed
 * in, everything goes through the view: the bands, the grab zones and the labels. The regions are
 * kept by `RegionStore`; the labels, the pointer and the keys are `RegionLabels`, `RegionPointer`
 * and `RegionKeys`.
 */

import type { RegionWords } from '../../core/languages/words';
import { within } from '../../core/shared/checked';
import { positive } from '../../core/shared/math';
import { PROGRESS, REGION } from '../../core/shared/variables';
import { placeX } from '../../core/wave/scene';
import type { Plugin, PluginHost } from '../../types';
import { RegionKeys } from './region-keys';
import { RegionLabels } from './region-labels';
import { RegionPointer } from './region-pointer';
import {
    regionLabel,
    RegionStore,
    type Region,
    type RegionsHost,
} from './region-store';

export type RegionsOptions = {
    /** Regions to start with. */
    items?: readonly Omit<Region, 'id'>[];
    /** How the pointer creates a region: Shift-drag (the default), plain drag, or not at all. */
    create?: 'shift-drag' | 'drag' | false;
    /** Shortest region, in seconds. */
    minLength?: number;
    /** The band color (translucent). */
    color?: string;
    /** Single-key shortcuts while the frame has focus. */
    keys?: boolean;
    /** The most regions kept. */
    max?: number;
    /** Called after a region is created, changed or removed. */
    onChange?: (regions: readonly Region[]) => void;
    /** Called when the selected region changes (null when none). */
    onSelect?: (region: Region | null) => void;
    /** Zoomed in, a region chosen by the keys (R) is brought into view, centered. Off by default. */
    scrollIntoView?: boolean;
    /**
     * Draws the bands' edges on whole device pixels (crisper, moved by less than half a pixel). Off by
     * default: at fractions of a pixel, as always.
     */
    snap?: boolean;
    /**
     * The mouse cursor (any CSS cursor): `'grab'` over a region's body, `'grabbing'` while moving
     * it, `'ew-resize'` over its edges and while resizing or drawing one.
     */
    cursors?: { body?: string; moving?: string; edge?: string };
    /** Accessibility options. */
    a11y?: {
        /** Your own words said by the keys, over those of the frame's language. */
        words?: Partial<RegionWords>;
    };
};

export type RegionsPlugin = Plugin & {
    /** Adds a region and returns a copy of it, or null when `max` regions already exist. */
    add(region: Omit<Region, 'id'> & { id?: string }): Region | null;
    update(id: string, patch: Partial<Omit<Region, 'id'>>): void;
    remove(id: string): void;
    clear(): void;
    list(): readonly Region[];
    play(id: string, options?: { loop?: boolean }): void;
    stop(): void;
    select(id: string | null): void;
};

export function regions(options: RegionsOptions = {}): RegionsPlugin {
    const minLength = within(
        options.minLength,
        0.25,
        0.01,
        Number.POSITIVE_INFINITY,
    );
    const bandColor = options.color ?? REGION;
    const keys = options.keys ?? true;
    const max = within(options.max, 200, 0, 200);
    const snap = options.snap === true;

    const store = new RegionStore(minLength, max);
    const labels = new RegionLabels();
    let host: PluginHost | null = null;
    let stopFitting: (() => void) | null = null;
    let stopViewing: (() => void) | null = null;

    function duration(): number | null {
        return positive(host?.duration ?? null);
    }

    function placeLabels(): void {
        const span = duration();

        if (host !== null && span !== null) {
            labels.layout(host, store.items, span);
        }
    }

    function changed(): void {
        host?.invalidate();
        placeLabels();
        options.onChange?.(store.list());
    }

    /**
     * Fits every region inside the sound once its length is known, and again whenever it changes. The
     * app hears about it (`onChange`) only when a region actually moved.
     */
    function fitToSound(): void {
        const span = duration();

        if (span === null) {
            return;
        }

        if (store.fit(span)) {
            changed();
        } else {
            placeLabels();
        }
    }

    function select(id: string | null): void {
        store.selectedId = id;
        host?.invalidate();
        options.onSelect?.(id === null ? null : (store.byId(id) ?? null));
    }

    function play(id: string, playOptions?: { loop?: boolean }): void {
        const region = store.byId(id);

        if (region !== undefined) {
            host?.playRange(region.start, region.end, {
                loop: playOptions?.loop ?? store.loop,
            });
        }
    }

    const parts: RegionsHost = {
        store,
        frame: () => host,
        duration,
        select,
        changed,
        told: () => options.onChange?.(store.list()),
        play: (id) => play(id),
    };
    const pointer = new RegionPointer(parts, {
        create: options.create ?? 'shift-drag',
        cursors: {
            body: options.cursors?.body ?? 'grab',
            moving: options.cursors?.moving ?? 'grabbing',
            edge: options.cursors?.edge ?? 'ew-resize',
        },
    });
    const keyboard = new RegionKeys(
        parts,
        options.scrollIntoView === true,
        options.a11y?.words,
    );

    for (const item of options.items ?? []) {
        store.add(item, duration());
    }

    return {
        name: 'regions',
        layer: 'over',

        add(region): Region | null {
            const added = store.add(region, duration());

            if (added === null) {
                return null;
            }

            changed();

            return { ...added };
        },

        update(id, patch): void {
            const region = store.byId(id);
            const span = duration();

            if (region === undefined || span === null) {
                return;
            }

            const bounds = store.normalized(
                patch.start ?? region.start,
                patch.end ?? region.end,
                span,
            );
            region.start = bounds.start;
            region.end = bounds.end;

            if ('label' in patch) {
                region.label = regionLabel(patch.label);
            }

            if ('color' in patch) {
                region.color = patch.color;
            }

            changed();
        },

        remove(id): void {
            store.remove(id);

            if (store.selectedId === id) {
                select(null);
            }

            changed();
        },

        clear(): void {
            store.items = [];
            select(null);
            changed();
        },

        list: () => store.list(),
        play,
        stop: () => host?.stopRange(),
        select,

        setup(frame): void {
            host = frame;
            stopFitting = frame.on('durationchange', fitToSound);
            stopViewing = frame.on('viewchange', placeLabels);
            fitToSound();
        },

        resize(): void {
            placeLabels();
        },

        draw(paint): void {
            const span = positive(paint.duration);

            if (span === null || paint.width <= 0) {
                return;
            }

            const edge = paint.color(PROGRESS);

            for (const region of store.items) {
                const from = placeX(paint, region.start / span, snap);
                const to = placeX(paint, region.end / span, snap);

                // Zoomed in, a region wholly outside the view is not drawn.
                if (to < 0 || from > paint.width) {
                    continue;
                }

                paint.ctx.fillStyle = paint.color(region.color || bandColor);
                paint.ctx.fillRect(
                    from,
                    0,
                    Math.max(1, to - from),
                    paint.height,
                );

                const edgeWidth =
                    region.id === store.selectedId
                        ? Math.max(2, Math.round(2 * paint.pixelRatio))
                        : Math.max(1, Math.round(paint.pixelRatio));
                paint.ctx.fillStyle = edge;
                paint.ctx.fillRect(from, 0, edgeWidth, paint.height);
                paint.ctx.fillRect(to - edgeWidth, 0, edgeWidth, paint.height);
            }
        },

        pointerHover(point): string | void {
            return pointer.hover(point);
        },

        pointerDown(point): 'take' | 'drag' | void {
            return pointer.down(point);
        },

        pointerMove(point): void {
            pointer.move(point);
        },

        pointerUp(): void {
            pointer.up();
        },

        pointerCancel(): void {
            pointer.cancel();
        },

        keyDown(key, modifiers): boolean {
            return keys && keyboard.down(key, modifiers);
        },

        destroy(): void {
            stopFitting?.();
            stopFitting = null;
            stopViewing?.();
            stopViewing = null;
            labels.destroy();
            host = null;
        },
    };
}
