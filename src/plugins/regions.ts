/**
 * Regions: stretches of the sound a listener can mark, play or loop. A band is drawn over the bars
 * with its edges and an optional label; the pointer creates one by Shift-dragging (so a plain drag
 * still scrubs), moves it by its body and resizes it by an edge, and the keyboard selects, plays,
 * loops, nudges and deletes while the frame has focus. Regions never invert or fall below a minimum
 * length (pure `normalizeRegion`), and every edge has a touch-sized grab zone (`hitRegion`).
 */

import { clamp01, positive } from '../core/math';
import {
    hitRegion,
    normalizeRegion,
    type LaidRegion,
    type RegionPart,
} from '../core/regions';
import { formatTime } from '../core/timing';
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
};

export type RegionsPlugin = Plugin & {
    add(region: Omit<Region, 'id'> & { id?: string }): Region;
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
    const bandColor = options.color ?? 'rgba(47, 111, 219, 0.18)';
    const keys = options.keys ?? true;
    const max = Math.max(0, options.max ?? 200);

    let host: PluginHost | null = null;
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

    function addRegion(item: Omit<Region, 'id'> & { id?: string }): Region {
        const span = duration() ?? Math.max(item.end, minLength);
        const bounds = normalized(item.start, item.end, span);
        const region: Region = {
            id: item.id ?? `region-${++counter}`,
            start: bounds.start,
            end: bounds.end,
            label: item.label,
            color: item.color,
        };
        items = [...items, region].slice(0, max);

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

        return {
            laid: ranked.map((region) => ({
                start: clamp01(region.start / span) * width,
                end: clamp01(region.end / span) * width,
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

            node.textContent = region.label;
            node.style.setProperty(
                'left',
                `${clamp01(region.start / span) * 100}%`,
            );
        }
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

        add: addRegion,

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
                region.label = patch.label;
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
            layoutLabels();
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
                const from = clamp01(region.start / span) * paint.width;
                const to = clamp01(region.end / span) * paint.width;
                paint.ctx.fillStyle = region.color
                    ? paint.color(region.color)
                    : bandColor;
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
                    drag.id = addRegion({ start: drag.grab, end: at }).id;
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

        keyDown(key): boolean {
            if (!keys) {
                return false;
            }

            if (key === 'r' || key === 'R') {
                selectStep(key === 'R');

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
            for (const node of labelSpans.values()) {
                node.remove();
            }

            labelSpans.clear();
            host = null;
        },
    };
}
