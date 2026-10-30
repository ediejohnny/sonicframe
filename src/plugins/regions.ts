/**
 * Regions: stretches of the sound a listener can mark, play or loop. A band is drawn over the bars
 * with its edges and an optional label; the pointer creates one by Shift-dragging (so a plain drag
 * still scrubs), moves it by its body and resizes it by an edge, and the keyboard selects, plays,
 * loops, nudges and deletes while the frame has focus. Regions never invert or fall below a minimum
 * length (pure `normalizeRegion`), and every edge has a touch-sized grab zone (`hitRegion`). Zoomed
 * in, everything goes through the view: the bands, the grab zones and the labels.
 */

import { clamp01, positive } from '../core/math';
import {
    hitRegion,
    normalizeRegion,
    type LaidRegion,
    type RegionPart,
} from '../core/regions';
import { cleanText } from '../core/text';
import { formatTime } from '../core/timing';
import { FULL_VIEW, viewX } from '../core/view';
import type { Plugin, PluginHost, WavePoint } from '../types';

/** A region, in seconds. */
export type Region = {
    id: string;
    start: number;
    end: number;
    label?: string;
    color?: string;
};

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

const EDGE_PX = 12;
const NUDGE = 0.5;
let counter = 0;

export function regions(options: RegionsOptions = {}): RegionsPlugin {
    const create = options.create ?? 'shift-drag';
    const minLength = Math.max(0.01, options.minLength ?? 0.25);
    const bandColor =
        options.color ?? 'var(--sonicframe-region, rgba(47, 111, 219, 0.18))';
    const keys = options.keys ?? true;
    const max = Math.min(200, Math.max(0, options.max ?? 200));

    const scrollIntoView = options.scrollIntoView === true;

    let host: PluginHost | null = null;
    let stopFitting: (() => void) | null = null;
    let stopViewing: (() => void) | null = null;
    let items: Region[] = [];
    let selectedId: string | null = null;
    let loop = false;
    let drag: {
        mode: 'create' | 'move' | 'resize';
        id: string;
        part?: RegionPart;
        grab: number;
    } | null = null;
    let labelLayer: HTMLElement | null = null;
    const labelSpans = new Map<string, HTMLElement>();

    for (const item of options.items ?? []) {
        addRegion(item);
    }

    function duration(): number | null {
        return positive(host?.duration ?? null);
    }

    function normalized(
        start: number,
        end: number,
        span: number,
    ): {
        start: number;
        end: number;
    } {
        return normalizeRegion(start, end, span, minLength);
    }

    /**
     * Stores a region, or nothing (null) once `max` regions exist. Until the sound's length is known
     * it is only ordered and kept to the minimum length; `fitToSound` fits it in later.
     */
    function addRegion(
        item: Omit<Region, 'id'> & { id?: string },
    ): Region | null {
        if (items.length >= max) {
            return null;
        }

        const span = duration() ?? Math.max(item.start, item.end, minLength);
        const bounds = normalized(item.start, item.end, span);
        const region: Region = {
            id: item.id ?? `region-${++counter}`,
            start: bounds.start,
            end: bounds.end,
            label:
                item.label === undefined
                    ? undefined
                    : cleanText(item.label, 120),
            color: item.color,
        };
        items = [...items, region];

        return region;
    }

    function byId(id: string): Region | undefined {
        return items.find((region) => region.id === id);
    }

    function changed(): void {
        host?.invalidate();
        layoutLabels();
        options.onChange?.(list());
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

        let moved = false;

        for (const region of items) {
            const bounds = normalized(region.start, region.end, span);

            if (bounds.start !== region.start || bounds.end !== region.end) {
                region.start = bounds.start;
                region.end = bounds.end;
                moved = true;
            }
        }

        if (moved) {
            changed();
        } else {
            layoutLabels();
        }
    }

    function list(): readonly Region[] {
        return items.map((region) => ({ ...region }));
    }

    function select(id: string | null): void {
        selectedId = id;
        host?.invalidate();
        options.onSelect?.(id === null ? null : (byId(id) ?? null));
    }

    function laidCss(
        width: number,
        span: number,
    ): {
        laid: LaidRegion[];
        ids: string[];
    } {
        // Topmost first: the selected region, then the newest, so a click lands on what is on top.
        const order = [...items].reverse();
        const ranked =
            selectedId === null
                ? order
                : [
                      ...order.filter((region) => region.id === selectedId),
                      ...order.filter((region) => region.id !== selectedId),
                  ];

        const view = host?.view ?? FULL_VIEW;

        return {
            laid: ranked.map((region) => ({
                start: viewX(clamp01(region.start / span), view, width),
                end: viewX(clamp01(region.end / span), view, width),
            })),
            ids: ranked.map((region) => region.id),
        };
    }

    function hitAt(point: WavePoint): {
        id: string;
        part: RegionPart;
    } | null {
        const span = duration();

        if (span === null) {
            return null;
        }

        const { laid, ids } = laidCss(point.width, span);
        const hit = hitRegion(point.x, laid, EDGE_PX);

        return hit === null ? null : { id: ids[hit.index], part: hit.part };
    }

    function layoutLabels(): void {
        const frame = host;
        const span = duration();

        if (frame === null || span === null) {
            return;
        }

        labelLayer ??= frame.overlay();

        for (const [id, node] of labelSpans) {
            if (byId(id)?.label === undefined) {
                node.remove();
                labelSpans.delete(id);
            }
        }

        for (const region of items) {
            if (region.label === undefined) {
                continue;
            }

            let node = labelSpans.get(region.id);

            if (node === undefined) {
                node = document.createElement('span');

                for (const [property, value] of [
                    ['position', 'absolute'],
                    ['top', '0'],
                    ['font-size', '10px'],
                    ['padding', '0 2px'],
                    ['pointer-events', 'none'],
                    ['white-space', 'nowrap'],
                    ['overflow', 'hidden'],
                    ['max-width', '40%'],
                    ['text-overflow', 'ellipsis'],
                ]) {
                    node.style.setProperty(property, value);
                }

                labelLayer.append(node);
                labelSpans.set(region.id, node);
            }

            // Anchored at the region's start: shown while the start is in view.
            const view = frame.view;
            const at = clamp01(region.start / span);
            const left = Math.round(viewX(at, view, 100) * 1000) / 1000;
            node.textContent = region.label;
            node.style.setProperty('left', `${left}%`);
            node.style.setProperty(
                'display',
                at >= view.start && at <= view.end ? '' : 'none',
            );
        }
    }

    /** Zoomed in, centers the view on a region (or on its start when it is longer than the view). */
    function reveal(region: Region): void {
        const frame = host;
        const span = duration();

        if (frame === null || span === null) {
            return;
        }

        const { start, end } = frame.view;
        const size = end - start;
        const from = clamp01(region.start / span);
        const to = clamp01(region.end / span);

        if (from >= start && to <= end) {
            return;
        }

        const begin = to - from <= size ? (from + to) / 2 - size / 2 : from;
        frame.setView(begin, begin + size, 'keys');
    }

    function selectStep(back: boolean): void {
        if (items.length === 0) {
            return;
        }

        const order = [...items].sort((a, b) => a.start - b.start);
        const at = order.findIndex((region) => region.id === selectedId);
        const next =
            at < 0 ? 0 : (at + (back ? -1 : 1) + order.length) % order.length;
        const region = order[next];
        select(region.id);
        announce(region);

        if (scrollIntoView) {
            reveal(region);
        }
    }

    function announce(region: Region): void {
        const place = `${formatTime(region.start)} to ${formatTime(region.end)}`;
        host?.announce(
            region.label === undefined ? place : `${region.label}, ${place}`,
        );
    }

    function play(id: string, playOptions?: { loop?: boolean }): void {
        const region = byId(id);

        if (region !== undefined) {
            host?.playRange(region.start, region.end, {
                loop: playOptions?.loop ?? loop,
            });
        }
    }

    function nudge(part: 'start' | 'end', by: number): void {
        const span = duration();

        if (selectedId === null || span === null) {
            return;
        }

        const region = byId(selectedId);

        if (region === undefined) {
            return;
        }

        const bounds =
            part === 'start'
                ? normalized(region.start + by, region.end, span)
                : normalized(region.start, region.end + by, span);
        region.start = bounds.start;
        region.end = bounds.end;
        changed();
    }

    return {
        name: 'regions',
        layer: 'over',

        add(region): Region | null {
            const added = addRegion(region);

            if (added === null) {
                return null;
            }

            changed();

            return { ...added };
        },

        update(id, patch): void {
            const region = byId(id);
            const span = duration();

            if (region === undefined || span === null) {
                return;
            }

            const bounds = normalized(
                patch.start ?? region.start,
                patch.end ?? region.end,
                span,
            );
            region.start = bounds.start;
            region.end = bounds.end;

            if ('label' in patch) {
                region.label =
                    patch.label === undefined
                        ? undefined
                        : cleanText(patch.label, 120);
            }

            if ('color' in patch) {
                region.color = patch.color;
            }

            changed();
        },

        remove(id): void {
            items = items.filter((region) => region.id !== id);

            if (selectedId === id) {
                select(null);
            }

            changed();
        },

        clear(): void {
            items = [];
            select(null);
            changed();
        },

        list,
        play,
        stop: () => host?.stopRange(),
        select,

        setup(frame): void {
            host = frame;
            stopFitting = frame.on('durationchange', fitToSound);
            stopViewing = frame.on('viewchange', layoutLabels);
            fitToSound();
        },

        resize(): void {
            layoutLabels();
        },

        draw(paint): void {
            const span = positive(paint.duration);

            if (span === null || paint.width <= 0) {
                return;
            }

            const edge = paint.color('var(--sonicframe-progress, #2f6fdb)');

            for (const region of items) {
                const from = paint.xAt(region.start / span);
                const to = paint.xAt(region.end / span);

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
                    region.id === selectedId
                        ? Math.max(2, Math.round(2 * paint.pixelRatio))
                        : Math.max(1, Math.round(paint.pixelRatio));
                paint.ctx.fillStyle = edge;
                paint.ctx.fillRect(from, 0, edgeWidth, paint.height);
                paint.ctx.fillRect(to - edgeWidth, 0, edgeWidth, paint.height);
            }
        },

        pointerHover(point): string | void {
            if (point === null) {
                return;
            }

            const hit = hitAt(point);

            if (hit === null) {
                return;
            }

            return hit.part === 'body' ? 'grab' : 'ew-resize';
        },

        pointerDown(point): 'take' | 'drag' | void {
            const span = duration();

            if (span === null) {
                return;
            }

            const hit = hitAt(point);

            if (hit !== null) {
                select(hit.id);
                drag = {
                    mode: hit.part === 'body' ? 'move' : 'resize',
                    id: hit.id,
                    part: hit.part,
                    grab: point.time ?? 0,
                };

                return 'take';
            }

            const mayCreate =
                create === 'drag' ||
                (create === 'shift-drag' && point.shiftKey);

            if (mayCreate && items.length < max) {
                drag = { mode: 'create', id: '', grab: point.time ?? 0 };

                return 'drag';
            }
        },

        pointerMove(point): void {
            if (drag === null) {
                return;
            }

            const span = duration();

            if (span === null) {
                return;
            }

            const at = point.time ?? 0;

            if (drag.mode === 'create') {
                if (drag.id === '') {
                    const created = addRegion({ start: drag.grab, end: at });

                    if (created === null) {
                        drag = null;

                        return;
                    }

                    drag.id = created.id;
                    select(drag.id);
                } else {
                    const region = byId(drag.id);

                    if (region !== undefined) {
                        const bounds = normalized(drag.grab, at, span);
                        region.start = bounds.start;
                        region.end = bounds.end;
                    }
                }

                changed();

                return;
            }

            const region = byId(drag.id);

            if (region === undefined) {
                return;
            }

            if (drag.mode === 'resize') {
                const bounds =
                    drag.part === 'start'
                        ? normalized(at, region.end, span)
                        : normalized(region.start, at, span);
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

            changed();
        },

        pointerUp(): void {
            if (drag !== null) {
                options.onChange?.(list());
                drag = null;
            }
        },

        pointerCancel(): void {
            if (drag !== null && drag.mode === 'create' && drag.id !== '') {
                items = items.filter((region) => region.id !== drag?.id);
                changed();
            }

            drag = null;
        },

        keyDown(key, modifiers): boolean {
            if (
                !keys ||
                modifiers.ctrlKey ||
                modifiers.altKey ||
                modifiers.metaKey
            ) {
                return false;
            }

            // Shift, not the letter's case, picks the direction: Caps Lock flips the case.
            if (key.toLowerCase() === 'r') {
                selectStep(modifiers.shiftKey === true);

                return true;
            }

            if (key === 'Enter' && selectedId !== null) {
                play(selectedId);

                return true;
            }

            if ((key === 'l' || key === 'L') && selectedId !== null) {
                loop = !loop;
                host?.announce(loop ? 'loop on' : 'loop off');

                return true;
            }

            if (key === '[' || key === '{') {
                nudge('start', key === '[' ? -NUDGE : NUDGE);

                return selectedId !== null;
            }

            if (key === ']' || key === '}') {
                nudge('end', key === ']' ? NUDGE : -NUDGE);

                return selectedId !== null;
            }

            if (
                (key === 'Delete' || key === 'Backspace') &&
                selectedId !== null
            ) {
                items = items.filter((region) => region.id !== selectedId);
                select(null);
                changed();

                return true;
            }

            if (key === 'Escape' && selectedId !== null) {
                host?.stopRange();
                select(null);

                return true;
            }

            return false;
        },

        destroy(): void {
            stopFitting?.();
            stopFitting = null;
            stopViewing?.();
            stopViewing = null;

            for (const node of labelSpans.values()) {
                node.remove();
            }

            labelSpans.clear();
            host = null;
        },
    };
}
