/**
 * A minimap: a strip above or below the wave with the whole sound, the played part and a box over
 * the part in view (zoom on). Dragging the box scrolls the view, a click beside it brings the view
 * there and the wheel can zoom, each with its own switch; a press on it never seeks. It is hidden
 * from screen readers unless `a11y.keys` makes it a keyboard slider of the part in view. Its colors
 * follow the page's theme variables.
 */

import { overlayOf } from '../core/scene';
import { barMetrics } from '../core/layout';
import { clamp01 } from '../core/math';
import { resample } from '../core/peaks';
import { DEFAULT_WAVE, resolveWave, waveShape } from '../core/shapes';
import { formatTime } from '../core/timing';
import { zoomView, type View } from '../core/view';
import { wheelFactor } from '../core/zoom';
import { drawingOf, paintWave, type Drawing } from '../dom/paint';
import type {
    BarStyle,
    Lane,
    PaintContext,
    Plugin,
    PluginHost,
    WaveName,
    WaveStyle,
} from '../types';

/** The words of the minimap as a slider; `total` is the sound's length. */
export type MinimapWords = {
    value(from: string, to: string, total: string): string;
};

export type MinimapOptions = {
    /** Above or below the wave: `'below'`. */
    side?: 'above' | 'below';
    /** The strip's height, in CSS pixels: 24. */
    height?: number;
    /** Space between the strip and the wave (or the lane next to it), in CSS pixels: 4. */
    gap?: number;
    /** How the sound is drawn in the strip: thin bars by default. */
    wave?: WaveName | Partial<WaveStyle>;
    bar?: Partial<BarStyle>;
    /** Colors (any CSS color or `var()`); by default the page's theme variables. */
    colors?: { wave?: string; progress?: string; view?: string; edge?: string };
    /** Paints the played part: on. */
    progress?: boolean;
    controls?: {
        /** Dragging the box scrolls the view: on. */
        drag?: boolean;
        /** A click beside the box brings the view there: on. */
        click?: boolean;
        /** The wheel over the strip zooms around the pointer: off. */
        wheel?: boolean;
    };
    /**
     * The mouse cursor (any CSS cursor): `'grab'` over the box, `'grabbing'` while dragging it,
     * `'pointer'` beside it. Where a press does nothing (its control off), the plain arrow.
     */
    cursors?: { box?: string; moving?: string; beside?: string };
    /** Takes no room while the whole sound is in view: off. */
    autoHide?: boolean;
    a11y?: {
        /**
         * Makes the strip a keyboard slider of the part in view (arrows, Page Up/Down, Home, End).
         * Off: the strip is hidden from screen readers.
         */
        keys?: boolean;
        /** Its accessible name: `'Visible part'`. */
        label?: string;
        /** Its value in words: English by default. */
        words?: Partial<MinimapWords>;
    };
};

export const MINIMAP_WORDS: Readonly<MinimapWords> = Object.freeze({
    value: (from: string, to: string, total: string) =>
        `${from} to ${to} of ${total}`,
});

const MINIMAP_BAR: Readonly<BarStyle> = Object.freeze({
    width: 2,
    gap: 1,
    radius: 0,
    minHeight: 1,
    align: 'center',
    curve: 0.7,
});

/** Part of the view an arrow key moves. */
const ARROW_STEP = 0.25;

const COLORS = {
    wave: 'var(--sonicframe-wave, #c4cad4)',
    progress: 'var(--sonicframe-progress, #2f6fdb)',
    view: 'var(--sonicframe-minimap-view, var(--sonicframe-region, rgba(47, 111, 219, 0.18)))',
    edge: 'var(--sonicframe-minimap-edge, var(--sonicframe-progress, #2f6fdb))',
};

function isFull(view: View): boolean {
    return view.start <= 0 && view.end >= 1;
}

/**
 * The strip's height and the space on its wave side, in CSS pixels: 24 and 4 unless given; the
 * height is at least 4 and the space at least 0.
 */
export function minimapSize(options: Pick<MinimapOptions, 'height' | 'gap'>): {
    height: number;
    gap: number;
} {
    return {
        height: Math.max(
            4,
            Number.isFinite(options.height) ? (options.height ?? 24) : 24,
        ),
        gap: Math.max(0, Number.isFinite(options.gap) ? (options.gap ?? 4) : 4),
    };
}

export function minimap(options: MinimapOptions = {}): Plugin {
    const side = options.side === 'above' ? 'above' : 'below';
    const { height, gap } = minimapSize(options);
    /** The lane's room: the strip and the space on its wave side. */
    const laneSize = height + gap;
    const wave = resolveWave({ ...DEFAULT_WAVE, style: 'bars' }, options.wave);
    const bar: BarStyle = { ...MINIMAP_BAR, ...options.bar };
    const colors = { ...COLORS, ...options.colors };
    const showProgress = options.progress !== false;
    const drag = options.controls?.drag !== false;
    const click = options.controls?.click !== false;
    const wheel = options.controls?.wheel === true;
    const cursors = {
        box: drag ? (options.cursors?.box ?? 'grab') : 'default',
        moving: options.cursors?.moving ?? 'grabbing',
        beside: click ? (options.cursors?.beside ?? 'pointer') : 'default',
    };
    const autoHide = options.autoHide === true;
    const keys = options.a11y?.keys === true;
    const words: MinimapWords = { ...MINIMAP_WORDS, ...options.a11y?.words };

    let host: PluginHost | null = null;
    let lane: Lane | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let drawing: Drawing | null = null;
    /** What the cached drawing was made for: its size and the peaks. */
    let drawn: {
        width: number;
        height: number;
        peaks: readonly number[] | null;
    } | null = null;
    /** A drag of the box: the ratio of the sound under the pointer, from the view's start. */
    let grab: number | null = null;
    const cleanups: (() => void)[] = [];

    /** The ratio of the sound at a pointer over the strip. */
    function ratioOf(event: { clientX: number }): number {
        const box = lane?.element.getBoundingClientRect();

        return box !== undefined && box.width > 0
            ? clamp01((event.clientX - box.left) / box.width)
            : 0;
    }

    function moveTo(start: number): void {
        const frame = host;

        if (frame !== null) {
            const { start: from, end } = frame.view;
            frame.setView(start, start + (end - from), 'minimap');
        }
    }

    function pointerDown(event: PointerEvent): void {
        const frame = host;

        if (frame === null || !event.isPrimary || event.button !== 0) {
            return;
        }

        const at = ratioOf(event);
        const { start, end } = frame.view;

        if (at < start || at > end) {
            if (!click) {
                return;
            }

            moveTo(at - (end - start) / 2);
        }

        if (drag) {
            grab = at - frame.view.start;
            showCursor(cursors.moving);

            try {
                lane?.element.setPointerCapture(event.pointerId);
            } catch {
                // The pointer is already gone; the drag ends with the next event.
            }
        }

        // Holding back the browser's default also holds back its focus, so a slider takes it here.
        if (keys) {
            lane?.element.focus({ preventScroll: true });
        }

        event.preventDefault();
    }

    function showCursor(cursor: string): void {
        lane?.element.style.setProperty('cursor', cursor);
    }

    /** The cursor for a mouse at rest over the strip: over the box or beside it. */
    function hover(event: PointerEvent): void {
        const frame = host;

        if (frame === null || event.pointerType !== 'mouse') {
            return;
        }

        const at = ratioOf(event);
        const { start, end } = frame.view;
        showCursor(at >= start && at <= end ? cursors.box : cursors.beside);
    }

    function pointerMove(event: PointerEvent): void {
        if (grab !== null) {
            moveTo(ratioOf(event) - grab);
        } else {
            hover(event);
        }
    }

    function pointerEnd(event: PointerEvent): void {
        grab = null;
        hover(event);
    }

    function onWheel(event: WheelEvent): void {
        const frame = host;

        if (frame === null || event.deltaY === 0) {
            return;
        }

        event.preventDefault();
        const view = frame.view;
        const next = zoomView(
            view,
            view.level * wheelFactor(event.deltaY, event.deltaMode, 1),
            ratioOf(event),
            view.maxLevel,
        );
        frame.setView(next.start, next.end, 'minimap');
    }

    function onKey(event: KeyboardEvent): void {
        const frame = host;

        if (frame === null || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        const { start, end } = frame.view;
        const size = end - start;
        const moves: Record<string, number> = {
            ArrowRight: start + size * ARROW_STEP,
            ArrowUp: start + size * ARROW_STEP,
            ArrowLeft: start - size * ARROW_STEP,
            ArrowDown: start - size * ARROW_STEP,
            PageDown: start + size,
            PageUp: start - size,
            Home: 0,
            End: 1 - size,
        };
        const target = moves[event.key];

        // The strip is its own control: a key it used never reaches the wave's slider too.
        if (target !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            moveTo(target);
        }
    }

    /** The slider's value and words for the view (keys on). */
    function describe(): void {
        const frame = host;
        const element = lane?.element;

        if (!keys || frame === null || element === undefined) {
            return;
        }

        const { start, end } = frame.view;
        const duration = frame.duration;
        const at = (ratio: number): string =>
            duration === null
                ? `${Math.round(ratio * 100)}%`
                : formatTime(Math.round(ratio * duration));
        const room = 1 - (end - start);

        element.setAttribute(
            'aria-valuenow',
            String(room > 0 ? Math.round((start / room) * 100) : 0),
        );
        element.setAttribute(
            'aria-valuetext',
            words.value(at(start), at(end), duration === null ? '100%' : at(1)),
        );
    }

    /** Shows or hides the strip at the whole sound (autoHide), and says the new value. */
    function viewChanged(): void {
        const frame = host;

        if (frame !== null && autoHide) {
            lane?.setSize(isFull(frame.view) ? 0 : laneSize);
        }

        describe();
    }

    function render(paint: PaintContext): void {
        const frame = host;
        const target = canvas;
        const context = target?.getContext('2d') ?? null;

        if (frame === null || target === null || context === null) {
            return;
        }

        const ratio = paint.pixelRatio;
        const width = paint.width;
        const tall = Math.max(1, Math.round(height * ratio));

        if (target.width !== width || target.height !== tall) {
            target.width = width;
            target.height = tall;
        }

        const peaks = frame.peaks;

        if (
            drawn === null ||
            drawn.width !== width ||
            drawn.height !== tall ||
            drawn.peaks !== peaks
        ) {
            const values =
                peaks === null
                    ? []
                    : resample(peaks, barMetrics(width, bar, ratio).count);
            drawing = drawingOf(
                waveShape(values, width, tall, bar, wave, ratio),
                Math.round(wave.glow * ratio),
            );
            drawn = { width, height: tall, peaks };
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, tall);

        if (drawing !== null) {
            paintWave(
                context,
                drawing,
                overlayOf(showProgress ? paint.progress : 0, null, width),
                width,
                tall,
                {
                    wave: paint.color(colors.wave),
                    progress: paint.color(colors.progress),
                    hover: null,
                    cursor: null,
                },
            );
        }

        const view = paint.view;

        if (isFull(view)) {
            return;
        }

        const from = Math.round(view.start * width);
        const to = Math.max(from + 1, Math.round(view.end * width));
        const edge = Math.max(1, Math.round(ratio));
        context.fillStyle = paint.color(colors.view);
        context.fillRect(from, 0, to - from, tall);
        context.fillStyle = paint.color(colors.edge);
        context.fillRect(from, 0, edge, tall);
        context.fillRect(to - edge, 0, edge, tall);
    }

    function listen<Name extends keyof HTMLElementEventMap>(
        element: HTMLElement,
        type: Name,
        listener: (event: HTMLElementEventMap[Name]) => void,
        passive: boolean = true,
    ): void {
        element.addEventListener(type, listener, { passive });
        cleanups.push(() => element.removeEventListener(type, listener));
    }

    return {
        name: 'minimap',
        layer: 'over',

        setup(frame): void {
            host = frame;
            lane = frame.addLane(
                side,
                autoHide && isFull(frame.view) ? 0 : laneSize,
            );
            const element = lane.element;
            element.classList.add('sonicframe-minimap');
            canvas = document.createElement('canvas');

            for (const [property, value] of [
                ['display', 'block'],
                ['width', '100%'],
                ['height', `${height}px`],
                [side === 'below' ? 'margin-top' : 'margin-bottom', `${gap}px`],
            ]) {
                canvas.style.setProperty(property, value);
            }

            canvas.setAttribute('aria-hidden', 'true');
            element.append(canvas);

            const pointer = drag || click || wheel || keys;
            element.style.setProperty(
                'pointer-events',
                pointer ? 'auto' : 'none',
            );

            // The wave's cursor says a press seeks; here it never does.
            if (pointer) {
                showCursor('default');
            }

            if (drag || click) {
                element.style.setProperty('touch-action', 'none');
                listen(element, 'pointerdown', pointerDown, false);
                listen(element, 'pointermove', pointerMove);
                listen(element, 'pointerup', pointerEnd);
                listen(element, 'pointercancel', pointerEnd);
                listen(element, 'lostpointercapture', pointerEnd);
            }

            if (wheel) {
                listen(element, 'wheel', onWheel, false);
            }

            if (keys) {
                element.setAttribute('role', 'slider');
                element.setAttribute('tabindex', '0');
                element.setAttribute(
                    'aria-label',
                    options.a11y?.label ?? 'Visible part',
                );
                element.setAttribute('aria-valuemin', '0');
                element.setAttribute('aria-valuemax', '100');
                listen(element, 'keydown', onKey, false);
            } else {
                element.setAttribute('aria-hidden', 'true');
            }

            cleanups.push(
                frame.on('viewchange', viewChanged),
                frame.on('durationchange', describe),
            );
            describe();
        },

        draw(paint): void {
            render(paint);
        },

        destroy(): void {
            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            lane?.remove();
            lane = null;
            canvas = null;
            drawing = null;
            drawn = null;
            host = null;
        },
    };
}
