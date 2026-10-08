/**
 * Markers: thin lines at chosen moments of the sound (reported moments, chapters, comments). Times are
 * in seconds, so they stay right when the frame changes size; nothing is drawn while the duration is
 * unknown.
 */

import { clamp01, positive } from '../core/math';
import type { PaintContext, Plugin, PluginHost } from '../types';

export type MarkersOptions = {
    /** Moments to mark, in seconds. */
    times?: readonly number[];
    /** Any CSS color or `var(--name)`. */
    color?: string;
    /** Line width in CSS pixels. */
    width?: number;
};

export type MarkersPlugin = Plugin & {
    readonly times: readonly number[];
    /** Replaces the marked moments. */
    set(times: readonly number[]): void;
};

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

export function markers(options: MarkersOptions = {}): MarkersPlugin {
    let times: readonly number[] = [...(options.times ?? [])];
    let host: PluginHost | null = null;

    return {
        name: 'markers',
        layer: 'over',
        get times(): readonly number[] {
            return times;
        },
        set(next: readonly number[]): void {
            times = [...next];
            host?.invalidate();
        },
        setup(frame: PluginHost): void {
            host = frame;
        },
        draw(paint: PaintContext): void {
            const size = Math.max(
                1,
                Math.round((options.width ?? 2) * paint.pixelRatio),
            );
            const spans = markerSpans(times, paint.duration, paint.width, size);

            if (spans.length === 0) {
                return;
            }

            paint.ctx.fillStyle = paint.color(
                options.color ?? 'var(--sonicframe-marker, #e5484d)',
            );

            for (const span of spans) {
                paint.ctx.fillRect(span.x, 0, span.width, paint.height);
            }
        },
        destroy(): void {
            host = null;
        },
    };
}
