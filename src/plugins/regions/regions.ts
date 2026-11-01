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
import type { RegionInput } from '../../core/marks/regions';
import { finiteOr, within } from '../../core/shared/checked';
import { positive } from '../../core/shared/math';
import { PROGRESS, REGION } from '../../core/shared/variables';
import { placeX } from '../../core/wave/scene';
import type { Plugin, PluginHost, SeekEvent } from '../../types';
import { RegionKeys } from './region-keys';
import { RegionLabels } from './region-labels';
import { RegionPointer } from './region-pointer';
import {
    regionLabel,
    RegionStore,
    type Region,
    type RegionsHost,
} from './region-store';

/** How far before a region's start a seek still counts as inside it, in seconds (as the frame's range). */
const SLACK = 0.05;

/**
 * The regions' keys while the frame has focus: a letter can be your own or `false`; each other key
 * is on unless `false`.
 */
export type RegionsKeys = {
    /** R steps through the regions (with Shift, back); `'r'` by default. */
    select?: string | false;
    /** L switches the selected region's loop; `'l'` by default. */
    loop?: string | false;
    /** Enter plays the selected region. */
    play?: boolean;
    /** `[` `]` and `{` `}` nudge its edges. */
    nudge?: boolean;
    /** Delete and Backspace remove it. */
    remove?: boolean;
    /** Escape stops it and lets it go. */
    release?: boolean;
};

export type RegionsOptions = {
    /** Regions to start with; an id is kept when no other region has it. */
    items?: readonly RegionInput[];
    /**
     * Whether the pointer creates regions: on by default, by `createGesture`. The old forms
     * `'shift-drag'` and `'drag'` still work until 2.0, as `createGesture`.
     */
    create?: boolean | 'shift-drag' | 'drag';
    /** How the pointer creates a region: Shift-drag (the default, so a plain drag still scrubs) or a plain drag. */
    createGesture?: 'shift-drag' | 'drag';
    /** Shortest region, in seconds. */
    minLength?: number;
    /** The band color (translucent). */
    color?: string;
    /** Single-key shortcuts while the frame has focus: all on by default, or each one your own. */
    keys?: boolean | RegionsKeys;
    /** The most regions kept. */
    max?: number;
    /**
     * Called after a region is created, changed or removed: once when a drag is let go, and after each
     * change by the API or the keys. Never when nothing changed.
     */
    onChange?: (regions: readonly Region[]) => void;
    /** Called at every move of a drag that changes a region (drawing, moving or resizing it). */
    onInput?: (regions: readonly Region[]) => void;
    /** Called when the selected region changes (null when none), with a copy of it. */
    onSelect?: (region: Region | null) => void;
    /** Zoomed in, a region chosen by the keys (R) is brought into view, centered. Off by default. */
    scrollIntoView?: boolean;
    /**
     * Draws the bands' edges on whole device pixels (crisper, moved by less than half a pixel). Off by
     * default: at fractions of a pixel, as always.
     */
    pixelSnap?: boolean;
    /** @deprecated Use `pixelSnap`; `snap` goes in 2.0. */
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
    /**
     * Adds a region and returns a copy of it, or null when `max` regions already exist or its start or
     * end is not a finite number. Its id is kept when no other region has it.
     */
    add(region: RegionInput): Region | null;
    /**
     * Changes a region; a time that is not a finite number is left as it was. Before the sound's
     * length is known, the times are ordered now and fitted to the sound later.
     */
    update(id: string, patch: Partial<Omit<Region, 'id'>>): void;
    remove(id: string): void;
    clear(): void;
    /** The regions, copies in the order they were added. */
    readonly items: readonly Region[];
    /**
     * Replaces every region at once (the selection is let go); tells `onChange` once. The first region
     * to ask for an id keeps it.
     */
    set(items: readonly RegionInput[]): void;
    /** @deprecated Use `items`; `list()` goes in 2.0. */
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
    const snap = (options.pixelSnap ?? options.snap) === true;
    const create = options.create ?? true;
    const gesture =
        create === false
            ? false
            : (options.createGesture ??
              (typeof create === 'string' ? create : 'shift-drag'));

    const store = new RegionStore(minLength, max);
    const labels = new RegionLabels();
    let host: PluginHost | null = null;
    let stops: (() => void)[] = [];
    /** The region `play` started, while its stretch still plays. */
    let playingId: string | null = null;

    function duration(): number | null {
        return positive(host?.duration ?? null);
    }

    function placeLabels(): void {
        const span = duration();

        if (host !== null && span !== null) {
            labels.layout(host, store.items, span);
        }
    }

    function redraw(): void {
        host?.invalidate();
        placeLabels();
    }

    function changed(): void {
        redraw();
        options.onChange?.(store.list());
    }

    /** Stops the stretch playing when its region is gone. */
    function stopGone(): void {
        if (playingId !== null && store.byId(playingId) === undefined) {
            host?.stopRange();
            playingId = null;
        }
    }

    /** A seek out of the region playing ends its stretch, as the frame's own range does. */
    function seeked(event: SeekEvent): void {
        const region = playingId === null ? undefined : store.byId(playingId);

        if (
            region === undefined ||
            event.time === null ||
            event.time < region.start - SLACK ||
            event.time > region.end
        ) {
            playingId = null;
        }
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

    /** Selects a region (an id no region has selects none); the app hears only of a new choice. */
    function select(id: string | null): void {
        const region = id === null ? undefined : store.byId(id);
        const next = region === undefined ? null : region.id;

        if (next === store.selectedId) {
            return;
        }

        store.selectedId = next;
        host?.invalidate();
        options.onSelect?.(region === undefined ? null : { ...region });
    }

    function play(id: string, playOptions?: { loop?: boolean }): void {
        const region = store.byId(id);

        if (region !== undefined && host !== null) {
            host.playRange(region.start, region.end, {
                loop: playOptions?.loop ?? store.loop,
            });
            playingId = id;
        }
    }

    function stop(): void {
        host?.stopRange();
        playingId = null;
    }

    function remove(id: string): void {
        if (!store.remove(id)) {
            return;
        }

        stopGone();

        if (store.selectedId === id) {
            select(null);
        }

        changed();
    }

    const parts: RegionsHost = {
        store,
        frame: () => host,
        duration,
        select,
        changed,
        moved: () => {
            redraw();
            options.onInput?.(store.list());
        },
        told: () => options.onChange?.(store.list()),
        play: (id) => play(id),
        release: () => {
            stop();
            select(null);
        },
        remove,
    };
    const pointer = new RegionPointer(parts, {
        create: gesture,
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
        keys === false ? null : keys === true ? {} : keys,
    );

    store.replace(options.items ?? [], null);

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

            if (region === undefined) {
                return;
            }

            const before = { ...region };
            const bounds = store.normalized(
                finiteOr(patch.start, region.start),
                finiteOr(patch.end, region.end),
                duration(),
            );
            region.start = bounds.start;
            region.end = bounds.end;

            if ('label' in patch) {
                region.label = regionLabel(patch.label);
            }

            if ('color' in patch) {
                region.color = patch.color;
            }

            if (
                region.start !== before.start ||
                region.end !== before.end ||
                region.label !== before.label ||
                region.color !== before.color
            ) {
                changed();
            }
        },

        remove,

        clear(): void {
            if (store.items.length === 0) {
                return;
            }

            store.items = [];
            stopGone();
            select(null);
            changed();
        },

        get items(): readonly Region[] {
            return store.list();
        },

        set(items): void {
            store.replace(items, duration());
            stopGone();
            select(null);
            changed();
        },

        list: () => store.list(),
        play,
        stop,
        select,

        setup(frame): void {
            host = frame;
            stops = [
                frame.on('durationchange', fitToSound),
                frame.on('viewchange', placeLabels),
                frame.on('seek', seeked),
                frame.on('rangeend', () => {
                    playingId = null;
                }),
            ];
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
            return keyboard.down(key, modifiers);
        },

        destroy(): void {
            for (const stopListening of stops.splice(0)) {
                stopListening();
            }

            labels.destroy();
            playingId = null;
            host = null;
        },
    };
}
