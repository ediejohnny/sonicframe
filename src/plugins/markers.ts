/**
 * Markers: lines at chosen moments of the sound (reported moments, chapters, "reply at 0:42"). Times
 * are in seconds, so they stay right when the frame resizes; nothing is drawn while the duration is
 * unknown. A marker can carry a label and a color; markers that crowd together become one pill with
 * a count. Hovering a marker shows a tooltip, a click seeks to it, and M / Shift+M step through them.
 * The 0.1.0 API (plain times, `set(times)`, `markerSpans`) still works unchanged.
 */

import { groupMarks } from '../core/clusters';
import { clamp01, positive } from '../core/math';
import { formatTime } from '../core/timing';
import type { PaintContext, Plugin, PluginHost, WavePoint } from '../types';
import { sharedTooltip } from '../dom/tooltip';

/** One marker: a moment in seconds, with an optional label, color and id. */
export type Mark = {
    time: number;
    label?: string;
    color?: string;
    id?: string;
};

export type MarkersOptions = {
    /** Moments to mark, in seconds (the simple form). */
    times?: readonly number[];
    /** Moments to mark, with labels and colors (the richer form). */
    marks?: readonly Mark[];
    /** Any CSS color or `var(--name)` for a plain marker. */
    color?: string;
    /** Line width in CSS pixels. */
    width?: number;
    /** Markers closer than this many CSS pixels become one pill with a count. */
    group?: number;
    /** A click on a marker seeks to its exact moment. */
    snap?: boolean;
    /** Show a tooltip on hover. */
    tooltip?: boolean;
    /** The most markers kept. */
    max?: number;
    /** Called when a marker or a group is chosen (click or keyboard). */
    onSelect?: (marks: Mark[]) => void;
};

export type MarkersPlugin = Plugin & {
    readonly times: readonly number[];
    readonly marks: readonly Mark[];
    /** Replaces the markers (plain moments or rich marks). */
    set(next: readonly number[] | readonly Mark[]): void;
};

const MAX_MARKS = 2000;
const TOOLTIP_LINES = 5;

/**
 * Where each marker line goes, in device pixels: centered on its moment and never outside the frame.
 * Moments that are not finite numbers are skipped.
 */
export function markerSpans(
    times: readonly number[],
    duration: number | null,
    width: number,
    size: number,
): { x: number; width: number }[] {
    const known = positive(duration);

    if (known === null || width <= 0) {
        return [];
    }

    const lineWidth = Math.max(1, Math.min(size, width));

    return times
        .filter((time) => Number.isFinite(time))
        .map((time) => ({
            x: Math.min(
                width - lineWidth,
                Math.max(
                    0,
                    Math.round(clamp01(time / known) * width - lineWidth / 2),
                ),
            ),
            width: lineWidth,
        }));
}

function toMarks(next: readonly number[] | readonly Mark[]): Mark[] {
    return next.map((item) =>
        typeof item === 'number' ? { time: item } : { ...item },
    );
}

export function markers(options: MarkersOptions = {}): MarkersPlugin {
    const groupPx = Math.max(0, options.group ?? 12);
    const snap = options.snap ?? true;
    const withTooltip = options.tooltip ?? true;
    const max = Math.max(0, options.max ?? MAX_MARKS);
    const defaultColor = options.color ?? 'var(--sonicframe-marker, #e5484d)';

    let marks: Mark[] = toMarks(options.marks ?? options.times ?? []).slice(
        0,
        max,
    );
    let host: PluginHost | null = null;
    let openedTooltip = false;

    /** The marks sorted by time, with finite times only. */
    function sorted(): Mark[] {
        return marks
            .filter((mark) => Number.isFinite(mark.time))
            .sort((a, b) => a.time - b.time);
    }

    /** Clusters of marks in CSS pixels, for hover and click; each cluster keeps its marks. */
    function clustersCss(
        width: number,
        duration: number,
    ): { from: number; to: number; marks: Mark[] }[] {
        const order = sorted();
        const centers = order.map(
            (mark) => clamp01(mark.time / duration) * width,
        );

        return groupMarks(centers, groupPx).map((cluster) => ({
            from: cluster.from,
            to: cluster.to,
            marks: cluster.indices.map((index) => order[index]),
        }));
    }

    function clusterAt(point: WavePoint): { marks: Mark[] } | null {
        const duration = host?.duration ?? null;

        if (duration === null || duration <= 0) {
            return null;
        }

        const slop = Math.max(groupPx / 2, 6);

        for (const cluster of clustersCss(point.width, duration)) {
            if (
                point.x >= cluster.from - slop &&
                point.x <= cluster.to + slop
            ) {
                return cluster;
            }
        }

        return null;
    }

    function label(mark: Mark): string {
        return mark.label === undefined
            ? formatTime(mark.time)
            : `${formatTime(mark.time)} · ${mark.label}`;
    }

    function choose(chosen: Mark[], toward: number): void {
        const frame = host;

        if (frame === null || chosen.length === 0) {
            return;
        }

        const duration = frame.duration;

        if (snap && duration !== null && duration > 0) {
            const nearest = chosen.reduce((best, mark) =>
                Math.abs(mark.time - toward) < Math.abs(best.time - toward)
                    ? mark
                    : best,
            );
            frame.seekTo(nearest.time / duration);
        }

        frame.announce(chosen.map(label).join('; '));
        options.onSelect?.(chosen);
    }

    function closeTooltip(): void {
        if (openedTooltip) {
            sharedTooltip().hide();
            openedTooltip = false;
        }
    }

    return {
        name: 'markers',
        layer: 'over',

        get times(): readonly number[] {
            return marks.map((mark) => mark.time);
        },

        get marks(): readonly Mark[] {
            return marks.map((mark) => ({ ...mark }));
        },

        set(next): void {
            marks = toMarks(next).slice(0, max);
            host?.invalidate();
        },

        setup(frame): void {
            host = frame;
        },

        draw(paint: PaintContext): void {
            const duration = positive(paint.duration);

            if (duration === null || paint.width <= 0) {
                return;
            }

            const order = sorted();
            const centers = order.map(
                (mark) => clamp01(mark.time / duration) * paint.width,
            );
            const clusters = groupMarks(centers, groupPx * paint.pixelRatio);
            const lineWidth = Math.max(
                1,
                Math.round((options.width ?? 2) * paint.pixelRatio),
            );
            const fallback = paint.color(defaultColor);

            for (const cluster of clusters) {
                if (cluster.indices.length === 1) {
                    const mark = order[cluster.indices[0]];
                    paint.ctx.fillStyle = mark.color
                        ? paint.color(mark.color)
                        : fallback;
                    const x = Math.min(
                        paint.width - lineWidth,
                        Math.max(0, Math.round(cluster.center - lineWidth / 2)),
                    );
                    paint.ctx.fillRect(x, 0, lineWidth, paint.height);
                } else {
                    paintPill(
                        paint,
                        cluster.center,
                        cluster.indices.length,
                        fallback,
                    );
                }
            }
        },

        pointerHover(point): string | void {
            if (!withTooltip || point === null) {
                closeTooltip();

                return;
            }

            const cluster = clusterAt(point);

            if (cluster === null) {
                closeTooltip();

                return;
            }

            const lines = cluster.marks.slice(0, TOOLTIP_LINES).map(label);

            if (cluster.marks.length > TOOLTIP_LINES) {
                lines.push(`and ${cluster.marks.length - TOOLTIP_LINES} more`);
            }

            const frame = host;

            if (frame !== null) {
                const background =
                    frame.color('var(--sonicframe-progress, #2f6fdb)') ||
                    '#2f6fdb';
                sharedTooltip().show(frame.container, lines, {
                    background,
                    text: '#ffffff',
                });
                openedTooltip = true;
            }

            return 'pointer';
        },

        pointerDown(point): 'take' | void {
            return clusterAt(point) === null ? undefined : 'take';
        },

        pointerUp(point): void {
            const cluster = clusterAt(point);

            if (cluster !== null) {
                choose(cluster.marks, point.time ?? cluster.marks[0].time);
            }
        },

        pointerCancel(): void {
            closeTooltip();
        },

        keyDown(key): boolean {
            if (key !== 'm' && key !== 'M') {
                return false;
            }

            const frame = host;
            const duration = frame?.duration ?? null;

            if (frame === null || duration === null || duration <= 0) {
                return false;
            }

            const order = sorted();
            const now = frame.progress * duration;
            const back = key === 'M';
            const next = back
                ? [...order].reverse().find((mark) => mark.time < now - 0.01)
                : order.find((mark) => mark.time > now + 0.01);

            if (next === undefined) {
                return false;
            }

            choose([next], next.time);

            return true;
        },

        destroy(): void {
            closeTooltip();
            host = null;
        },
    };
}

/** A little pill with a count, centered at `center` (device px), near the top of the frame. */
function paintPill(
    paint: PaintContext,
    center: number,
    count: number,
    color: string,
): void {
    const ctx = paint.ctx;
    const height = Math.min(paint.height, Math.round(14 * paint.pixelRatio));
    const text = String(count);
    ctx.font = `${Math.round(10 * paint.pixelRatio)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.max(height, ctx.measureText(text).width + height);
    const x = Math.min(
        paint.width - width,
        Math.max(0, Math.round(center - width / 2)),
    );
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + width / 2, height / 2);
}
