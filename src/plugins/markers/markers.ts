/**
 * Markers: lines at chosen moments of the sound (reported moments, chapters, "reply at 0:42"). Times
 * are in seconds, so they stay right when the frame resizes; nothing is drawn while the duration is
 * unknown. A marker can carry a label and a color; markers that crowd together become one pill with
 * a count. Hovering a marker shows a tooltip, a click seeks to it, and M / Shift+M step through them
 * (a keyboard seek, so a zoomed view follows it). Zoomed in, markers are placed through the view and
 * those outside it are left out. The 0.1.0 API (plain times, `set(times)`, `markerSpans`) still works
 * unchanged.
 */

import { localeFor, wordsFor } from '../../core/languages/language';
import { mergeWords } from '../../core/languages/merge-words';
import type { MarkerWords } from '../../core/languages/words';
import { groupMarks } from '../../core/marks/clusters';
import {
    placeMarks,
    sortedMarks,
    toMarks,
    type Mark,
} from '../../core/marks/markers';
import { finiteOr, within } from '../../core/shared/checked';
import { letterKeys, letterStep } from '../../core/shared/keys';
import { positive } from '../../core/shared/math';
import { fillTemplate } from '../../core/shared/text';
import { formatTime } from '../../core/shared/timing';
import { ON_PROGRESS } from '../../core/shared/variables';
import { FULL_VIEW } from '../../core/view/view';
import {
    sharedTooltip,
    tooltipColors,
    type TooltipA11y,
} from '../../dom/shared/tooltip';
import type {
    PaintContext,
    Plugin,
    PluginHost,
    SeekSource,
    WavePoint,
} from '../../types';

/** The accessibility of the markers: the tooltip's text, and your own words over the language's. */
export type MarkersA11y = TooltipA11y & {
    /** What the markers say (the tooltip's `'and 3 more'`), over the frame's language. */
    words?: Partial<MarkerWords>;
};

/** The markers' keys: M (or your own letter) to the next marker, with Shift to the one before. */
export type MarkersKeys = {
    /** The letter; `'m'` by default; false turns the keys off. */
    letter?: string | false;
    /**
     * Seconds after a marker during which Shift+M skips it and goes to the one before, like a
     * player's "previous track"; later, Shift+M returns to that marker. 1 by default; 0 always
     * lands on it.
     */
    backGrace?: number;
};

export type MarkersOptions = {
    /** The moments to mark, in seconds, each with a label and a color if you like. */
    items?: readonly Mark[];
    /** @deprecated Use `items`; `marks` goes in 2.0. */
    marks?: readonly Mark[];
    /** @deprecated Use `items` (`{ time }` each); `times` goes in 2.0. */
    times?: readonly number[];
    /** Any CSS color or `var(--name)` for a plain marker. */
    color?: string;
    /** Line width in CSS pixels. */
    width?: number;
    /** Markers closer than this many CSS pixels become one pill with a count: 12. */
    groupDistance?: number;
    /** @deprecated Use `groupDistance`; `group` goes in 2.0. */
    group?: number;
    /** A click on a marker seeks to its exact moment. */
    snap?: boolean;
    /** Show a tooltip on hover. */
    tooltip?: boolean;
    /** The most markers kept: 2000, up to 20 000 (past it, 20 000 until 2.0). */
    max?: number;
    /** M and Shift+M (or your own letter); true by default, false turns them off. */
    keys?: boolean | MarkersKeys;
    /** @deprecated Use `keys.backGrace`; `backGrace` goes in 2.0. */
    backGrace?: number;
    /** Called when a marker or a group is chosen (click or keyboard). */
    onSelect?: (marks: Mark[]) => void;
    /** @deprecated Use `a11y.words`; `words` goes in 2.0. */
    words?: Partial<MarkerWords>;
    a11y?: MarkersA11y;
};

export type MarkersPlugin = Plugin & {
    /** The markers, in the order given. */
    readonly items: readonly Mark[];
    /** @deprecated Use `items`; `marks` goes in 2.0. */
    readonly marks: readonly Mark[];
    /** The markers' moments, in seconds. */
    readonly times: readonly number[];
    /** Replaces the markers (marks, or plain moments in seconds). */
    set(next: readonly number[] | readonly Mark[]): void;
};

/** The markers kept by default, and the most `max` may be (it shipped taking any, so past it, the most). */
const MAX_MARKS = 2000;
const MOST_MARKS = 20_000;
const TOOLTIP_LINES = 5;

/** The longest word taken from the app, in characters. */
const MAX_WORD = 120;

export function markers(options: MarkersOptions = {}): MarkersPlugin {
    const groupPx = within(
        options.groupDistance ?? options.group,
        12,
        0,
        Number.POSITIVE_INFINITY,
    );
    const snap = options.snap ?? true;
    const withTooltip = options.tooltip ?? true;
    const max = within(options.max, MAX_MARKS, 0, MOST_MARKS);
    const own = typeof options.keys === 'object' ? options.keys : {};
    const { letter, backGrace } = letterKeys(
        options.keys === false
            ? false
            : { ...own, backGrace: own.backGrace ?? options.backGrace },
        'm',
        // Never under a hundredth of a second, so a marker just landed on is never chosen again.
        0.01,
    );
    const defaultColor = options.color ?? 'var(--sonicframe-marker, #e5484d)';
    const width = finiteOr(options.width, 2);

    let marks: Mark[] = toMarks(
        options.items ?? options.marks ?? options.times ?? [],
    ).slice(0, max);
    let host: PluginHost | null = null;
    let openedTooltip = false;

    /** The app's own words, over the frame's language. */
    const ownWords =
        options.words === undefined && options.a11y?.words === undefined
            ? undefined
            : { ...options.words, ...options.a11y?.words };

    function wordsOf(frame: PluginHost): MarkerWords {
        return mergeWords(wordsFor(frame.lang).markers, ownWords, MAX_WORD);
    }

    /** The tooltip's last line, for `count` markers left out, in the frame's language. */
    function more(frame: PluginHost, count: number): string {
        const locale = localeFor(frame.lang, ownWords !== undefined);

        return fillTemplate(wordsOf(frame).more, {
            count: new Intl.NumberFormat(locale).format(count),
        });
    }

    /** Clusters of marks in CSS pixels, for hover and click; each cluster keeps its marks. */
    function clustersCss(
        width: number,
        duration: number,
    ): { from: number; to: number; marks: Mark[] }[] {
        const { order, centers } = placeMarks(
            marks,
            width,
            duration,
            host?.view ?? FULL_VIEW,
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

    function choose(
        chosen: Mark[],
        toward: number,
        source: SeekSource = 'api',
    ): void {
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
            frame.seekTo(nearest.time / duration, source);
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

        get items(): readonly Mark[] {
            return marks.map((mark) => ({ ...mark }));
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

            const { order, centers } = placeMarks(
                marks,
                paint.width,
                duration,
                paint.view,
            );
            const clusters = groupMarks(centers, groupPx * paint.pixelRatio);
            const lineWidth = Math.max(1, Math.round(width * paint.pixelRatio));
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
            const frame = host;

            if (frame !== null) {
                if (cluster.marks.length > TOOLTIP_LINES) {
                    lines.push(
                        more(frame, cluster.marks.length - TOOLTIP_LINES),
                    );
                }

                sharedTooltip().show(
                    frame.container,
                    lines,
                    tooltipColors(frame, options.a11y),
                );
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

        keyDown(key, modifiers): boolean {
            const way = letterStep(key, modifiers, letter);
            const frame = host;
            const duration = frame?.duration ?? null;

            if (
                way === null ||
                frame === null ||
                duration === null ||
                duration <= 0
            ) {
                return false;
            }

            const order = sortedMarks(marks);

            // With no marker at all, the key goes on to the page.
            if (order.length === 0) {
                return false;
            }

            const now = frame.progress * duration;
            const next =
                way === -1
                    ? [...order]
                          .reverse()
                          .find((mark) => mark.time < now - backGrace)
                    : order.find((mark) => mark.time > now + 0.01);

            if (next === undefined) {
                frame.announce(wordsOf(frame).none);

                return true;
            }

            choose([next], next.time, 'keyboard');

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
    ctx.fillStyle = paint.color(ON_PROGRESS) || '#ffffff';
    ctx.fillText(text, x + width / 2, height / 2);
}
