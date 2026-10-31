/**
 * Skips the quiet stretches while playing: when the playhead runs forward into a silence, it jumps
 * to the end (a little before, so a word is not clipped). It only skips during normal playback, not
 * right after a seek, and can dim the silences it knows about.
 */

import { nextSkip, type Silence } from '../core/analysis';
import { clamp01 } from '../core/math';
import { placeX } from '../core/scene';
import type { Plugin, PluginHost } from '../types';

export type SkipSilencesOptions = {
    /** The silences to skip (from `findSilences` or `silencesFromPeaks`). */
    silences?: readonly Silence[];
    /** How far before a silence's end to land, in seconds. */
    lead?: number;
    /** Dim the silences on the bars. */
    dim?: boolean;
    /** The dim color. */
    dimColor?: string;
    /**
     * Draws the shade's edges on whole device pixels (crisper, moved by less than half a pixel). Off
     * by default: at fractions of a pixel, as always.
     */
    snap?: boolean;
};

export type SkipSilencesPlugin = Plugin & {
    /** Replaces the silences. */
    set(silences: readonly Silence[]): void;
};

export function skipSilences(
    options: SkipSilencesOptions = {},
): SkipSilencesPlugin {
    const lead = Math.max(0, options.lead ?? 0.1);
    const snap = options.snap === true;
    const dimColor =
        options.dimColor ?? 'var(--sonicframe-dim, rgba(0, 0, 0, 0.12))';

    let host: PluginHost | null = null;
    let silences: Silence[] = [...(options.silences ?? [])];
    let unsubscribe: (() => void) | null = null;
    let lastTime = 0;

    function onTime(time: number | null): void {
        const frame = host;
        const duration = frame?.duration ?? null;
        const advance = time === null ? 0 : time - lastTime;
        const previous = lastTime;
        lastTime = time ?? 0;

        // Only during ordinary forward playback, never right after a seek (a big or backward jump).
        if (
            frame === null ||
            duration === null ||
            time === null ||
            advance <= 0 ||
            advance > 1 ||
            previous === 0
        ) {
            return;
        }

        const end = nextSkip(time, silences, lead);

        if (end !== null) {
            frame.seekTo(clamp01(end / duration));
        }
    }

    return {
        name: 'skip-silences',
        layer: 'under',

        set(next): void {
            silences = [...next];
            host?.invalidate();
        },

        setup(frame): void {
            host = frame;
            unsubscribe = frame.on('timeupdate', (time) => onTime(time));
        },

        draw(paint): void {
            if (
                !options.dim ||
                paint.duration === null ||
                paint.duration <= 0
            ) {
                return;
            }

            paint.ctx.fillStyle = paint.color(dimColor);

            for (const silence of silences) {
                const from = placeX(
                    paint,
                    silence.start / paint.duration,
                    snap,
                );
                const to = placeX(paint, silence.end / paint.duration, snap);

                // Zoomed in, a silence wholly outside the view is not drawn.
                if (to < 0 || from > paint.width) {
                    continue;
                }

                paint.ctx.fillRect(
                    from,
                    0,
                    Math.max(1, to - from),
                    paint.height,
                );
            }
        },

        destroy(): void {
            unsubscribe?.();
            host = null;
        },
    };
}
