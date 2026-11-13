/**
 * Regions: stretches of the sound a listener can mark, play or loop. A band is drawn over the bars
 * with its edges and an optional label; the pointer creates one by Shift-dragging (so a plain drag
 * still scrubs), moves it by its body and resizes it by an edge, and the keyboard selects, plays,
 * loops, nudges and deletes while the frame has focus. Regions never invert or fall below a minimum
 * length (pure `normalizeRegion`), and every edge has a touch-sized grab zone (`hitRegion`). Zoomed
 * in, everything goes through the view: the bands, the grab zones and the labels. The regions are
 * kept by `RegionStore`; the labels, the pointer, the keys and the region playing are `RegionLabels`,
 * `RegionPointer`, `RegionKeys` and `RegionPlayback`; the options are in `regions-options.ts`.
 */

import { finiteOr, within } from '../../core/shared/checked';
import { limitOf, TEXT_LENGTH } from '../../core/shared/limits';
import { positive } from '../../core/shared/math';
import { PROGRESS, REGION } from '../../core/shared/variables';
import { placeX } from '../../core/wave/scene';
import type { PluginHost } from '../../types';
import { RegionKeys } from './region-keys';
import { RegionLabels } from './region-labels';
import { RegionPlayback } from './region-playback';
import { RegionPointer } from './region-pointer';
import {
    regionLabel,
    RegionStore,
    type Region,
    type RegionsHost,
} from './region-store';
import type { RegionsOptions, RegionsPlugin } from './regions-options';

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

    const store = new RegionStore(
        minLength,
        max,
        limitOf('maxText', options.maxText, TEXT_LENGTH),
    );
    const labels = new RegionLabels();
    const playback = new RegionPlayback();
    const find = (id: string): Region | undefined => store.byId(id);
    let host: PluginHost | null = null;
    let stops: (() => void)[] = [];

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
            playback.play(host, region, playOptions?.loop ?? store.loop);
        }
    }

    function stop(): void {
        playback.stop(host);
    }

    function remove(id: string): void {
        if (!store.remove(id)) {
            return;
        }

        playback.stopGone(host, find);

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
                region.label = regionLabel(patch.label, store.longest);
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
            playback.stopGone(host, find);
            select(null);
            changed();
        },

        get items(): readonly Region[] {
            return store.list();
        },

        set(items): void {
            store.replace(items, duration());
            playback.stopGone(host, find);
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
                frame.on('seek', (event) => playback.seeked(event, find)),
                frame.on('rangeend', () => playback.ended()),
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
            playback.ended();
            host = null;
        },
    };
}
