/**
 * The `SonicFrame` class: the browser shell around the pure core. It owns one canvas inside the
 * element it is given, listens to the pointer, the keyboard and a media element, and draws when the
 * core says something changed. `destroy()` gives the element back as it was.
 */

import { mixColors, resolveColor, rgbaString } from '../core/color';
import {
    Controller,
    MEDIA_EVENTS,
    type MediaEventType,
    type ValueText,
} from '../core/controller';
import { Emitter } from '../core/emitter';
import { barMetrics, layoutBars } from '../core/layout';
import { clamp01 } from '../core/math';
import { resample } from '../core/peaks';
import { overlayOf, ratioAt, sameOverlay, type Overlay } from '../core/scene';
import { easeOut } from '../core/timing';
import type {
    BarStyle,
    Colors,
    PaintContext,
    PeaksSource,
    Plugin,
    PluginHost,
    SonicFrameEvents,
} from '../types';
import { observeSize, observeVisibility, type Size } from './observe';
import {
    barsPath,
    linePath,
    paintBars,
    paintCursor,
    readColor,
    type Palette,
} from './paint';
import { schedule, setLooping, unschedule, type FrameTask } from './scheduler';

export type SonicFrameOptions = {
    /** The element to draw in. Its size comes from the page's CSS; give it a height. */
    container: HTMLElement;
    /** Peaks (0..1) or a function that loads them when the frame comes near the screen. */
    peaks?: PeaksSource;
    /** An audio or video element to follow and control. */
    media?: HTMLMediaElement | null;
    /** Duration in seconds, used until the media knows its own (or without media). */
    duration?: number | null;
    bar?: Partial<BarStyle>;
    colors?: Partial<Colors>;
    /** Width of the cursor line in CSS pixels (drawn only with a cursor color). */
    cursorWidth?: number;
    /** Click, drag and keys seek (a slider); false makes a picture only. */
    interact?: boolean;
    /** The accessible name, e.g. "Playback position". */
    label?: string;
    /** The position as words for screen readers; `0:12 / 0:45` by default. */
    valueText?: ValueText;
    /** Seconds moved by an arrow key. */
    stepSeconds?: number;
    /** Part of the sound moved by Page Up / Page Down. */
    largeStepRatio?: number;
    /** Show the start again when the media ends. */
    rewindOnEnd?: boolean;
    /** Keep pixels and load peaks only near the screen (many frames on one page). */
    lazy?: boolean;
    /** Let the bars grow in when peaks arrive (never with reduced motion). */
    animate?: boolean;
    plugins?: readonly Plugin[];
};

export const DEFAULT_BAR: Readonly<BarStyle> = Object.freeze({
    width: 2,
    gap: 1,
    radius: 1,
    minHeight: 2,
    align: 'center',
    curve: 1,
});

export const DEFAULT_COLORS: Readonly<Colors> = Object.freeze({
    wave: 'var(--sonicframe-wave, #c4cad4)',
    progress: 'var(--sonicframe-progress, #2f6fdb)',
    hover: 'auto',
    cursor: null,
});

/** How long the bars take to grow in, in milliseconds. */
const APPEAR_MS = 180;

/** How much of the way from the played color to the wave color an `'auto'` hover sits. */
const HOVER_MIX = 0.5;

const ATTRIBUTES = [
    'role',
    'tabindex',
    'aria-label',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'aria-valuetext',
];

function prefersReducedMotion(): boolean {
    return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export class SonicFrame implements PluginHost {
    readonly container: HTMLElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D | null;
    private readonly controller: Controller;
    private readonly events = new Emitter<SonicFrameEvents>();
    private readonly task: FrameTask;
    private readonly interact: boolean;
    private readonly lazy: boolean;
    private readonly animate: boolean;
    private readonly cursorWidth: number;
    private readonly cleanups: (() => void)[] = [];
    private readonly savedAttributes = new Map<string, string | null>();
    private readonly savedStyles = new Map<string, [string, string]>();
    private bar: BarStyle;
    private colors: Colors;
    private palette: Palette | null = null;
    private readonly colorCache = new Map<string, string>();
    private peaks: number[] | null = null;
    private values: number[] | null = null;
    private loader: (() => Promise<readonly number[]>) | null = null;
    private loads = 0;
    private size: Size = { width: 0, height: 0, pixelRatio: 1 };
    private near = false;
    private allocated = false;
    private path: Path2D | null = null;
    private layoutDirty = true;
    private paintDirty = true;
    private painted: Overlay | null = null;
    /** When the bars started growing in: -1 waits for the next animation frame, null means not growing. */
    private appear: number | null = null;
    private media: HTMLMediaElement | null = null;
    private plugins: Plugin[] = [];
    private readonly failed = new WeakSet<Plugin>();
    private dragBox: DOMRect | null = null;
    private destroyed = false;

    static create(options: SonicFrameOptions): SonicFrame {
        return new SonicFrame(options);
    }

    constructor(options: SonicFrameOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.container = options.container;
        this.interact = options.interact ?? true;
        this.lazy = options.lazy ?? true;
        this.animate = options.animate ?? true;
        this.cursorWidth = options.cursorWidth ?? 2;
        this.bar = { ...DEFAULT_BAR, ...options.bar };
        this.colors = { ...DEFAULT_COLORS, ...options.colors };
        this.task = { render: (now) => this.render(now) };

        this.prepareContainer(options.label ?? 'Audio position');

        this.canvas = document.createElement('canvas');
        this.canvas.setAttribute('aria-hidden', 'true');

        for (const [property, value] of [
            ['position', 'absolute'],
            ['inset', '0'],
            ['width', '100%'],
            ['height', '100%'],
            ['display', 'block'],
            ['pointer-events', 'none'],
        ]) {
            this.canvas.style.setProperty(property, value);
        }

        this.canvas.width = 0;
        this.canvas.height = 0;
        this.container.append(this.canvas);
        this.context = this.canvas.getContext('2d');

        this.controller = new Controller(
            {
                interact: this.interact,
                stepSeconds: options.stepSeconds ?? 5,
                largeStepRatio: options.largeStepRatio ?? 0.1,
                rewindOnEnd: options.rewindOnEnd ?? false,
                valueText: options.valueText,
            },
            {
                invalidate: () => this.invalidate(),
                loop: (on) => {
                    if (!this.destroyed) {
                        setLooping(this.task, on);
                    }
                },
                aria: (state) => {
                    if (this.interact && !this.destroyed) {
                        this.container.setAttribute(
                            'aria-valuenow',
                            String(state.now),
                        );
                        this.container.setAttribute(
                            'aria-valuetext',
                            state.text,
                        );
                    }
                },
                emit: (event, ...args) => this.events.emit(event, ...args),
            },
        );

        this.listen();
        this.cleanups.push(
            observeSize(this.canvas, (size) => this.resize(size)),
            observeVisibility(this.canvas, (near) => this.setNear(near)),
        );

        for (const plugin of options.plugins ?? []) {
            this.use(plugin);
        }

        this.setPeaks(options.peaks ?? null);
        this.controller.setDuration(options.duration ?? null);
        this.bind(options.media ?? null);
        this.controller.refresh();
    }

    /** 0..1, the position shown. */
    get progress(): number {
        return this.controller.progress;
    }

    /** In seconds, or null while unknown. */
    get duration(): number | null {
        return this.controller.duration;
    }

    on<Name extends keyof SonicFrameEvents>(
        event: Name,
        listener: (...args: SonicFrameEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    setPeaks(source: PeaksSource): void {
        if (this.destroyed) {
            return;
        }

        this.loads++;

        if (typeof source === 'function') {
            this.loader = source;
            this.receive(null);

            if (this.near || !this.lazy) {
                this.load();
            }
        } else {
            this.loader = null;
            this.receive(source);
        }
    }

    /** Follows an audio or video element (or none): its time drives the picture, seeks drive it. */
    bind(media: HTMLMediaElement | null): void {
        if (this.destroyed) {
            return;
        }

        this.unbindMedia();
        this.media = media;

        for (const type of MEDIA_EVENTS) {
            media?.addEventListener(type, this.onMedia);
        }

        this.controller.bind(media);
    }

    setDuration(seconds: number | null): void {
        this.controller.setDuration(seconds);
    }

    /** Sets the position shown while no media is bound. */
    setProgress(ratio: number): void {
        this.controller.setProgress(ratio);
    }

    /** Moves to a position from 0 to 1 (the bound media too) and emits `seek`. */
    seekTo(ratio: number): void {
        this.controller.seekTo(ratio);
    }

    setBar(bar: Partial<BarStyle>): void {
        this.bar = { ...this.bar, ...bar };
        this.layoutDirty = true;
        this.invalidate();
    }

    setColors(colors: Partial<Colors>): void {
        this.colors = { ...this.colors, ...colors };
        this.palette = null;
        this.invalidate();
    }

    setLabel(label: string): void {
        this.container.setAttribute('aria-label', label);
    }

    /** Reads the colors again (after a theme change) and redraws. */
    refresh(): void {
        this.palette = null;
        this.colorCache.clear();
        this.layoutDirty = true;
        this.controller.refresh();
    }

    /** Asks for a new picture on the next animation frame. */
    invalidate(): void {
        if (!this.destroyed) {
            this.paintDirty = true;
            schedule(this.task);
        }
    }

    /** Adds a plugin; returns the function that removes it. */
    use(plugin: Plugin): () => void {
        if (this.destroyed) {
            return () => undefined;
        }

        this.plugins.push(plugin);

        try {
            plugin.setup?.(this);
        } catch (error) {
            this.events.emit('error', error);
        }

        this.invalidate();

        return () => this.remove(plugin);
    }

    /** Removes everything SonicFrame added and gives the element back as it was. Safe to call twice. */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.unbindMedia();
        this.destroyed = true;
        unschedule(this.task);

        for (const cleanup of this.cleanups.splice(0).reverse()) {
            cleanup();
        }

        for (const plugin of this.plugins.splice(0).reverse()) {
            this.destroyPlugin(plugin);
        }

        this.canvas.width = 0;
        this.canvas.height = 0;
        this.canvas.remove();
        this.restoreContainer();
        this.events.emit('destroy');
        this.events.clear();
    }

    private prepareContainer(label: string): void {
        const style = this.container.style;
        const computed = getComputedStyle(this.container);
        const set = (property: string, value: string): void => {
            this.savedStyles.set(property, [
                style.getPropertyValue(property),
                style.getPropertyPriority(property),
            ]);
            style.setProperty(property, value);
        };

        for (const name of ATTRIBUTES) {
            this.savedAttributes.set(name, this.container.getAttribute(name));
        }

        // The canvas is placed against the element; a static element would let it escape.
        if (computed.position === 'static') {
            set('position', 'relative');
        }

        if (!this.interact) {
            this.container.setAttribute('role', 'img');
            this.container.setAttribute('aria-label', label);

            return;
        }

        set('touch-action', 'pan-y');
        set('user-select', 'none');
        set('-webkit-user-select', 'none');

        if (computed.cursor === 'auto') {
            set('cursor', 'pointer');
        }

        this.container.setAttribute('role', 'slider');
        this.container.setAttribute('aria-label', label);
        this.container.setAttribute('aria-valuemin', '0');
        this.container.setAttribute('aria-valuemax', '100');

        if (this.container.getAttribute('tabindex') === null) {
            this.container.setAttribute('tabindex', '0');
        }
    }

    private restoreContainer(): void {
        for (const [name, value] of this.savedAttributes) {
            if (value === null) {
                this.container.removeAttribute(name);
            } else {
                this.container.setAttribute(name, value);
            }
        }

        for (const [property, [value, priority]] of this.savedStyles) {
            if (value === '') {
                this.container.style.removeProperty(property);
            } else {
                this.container.style.setProperty(property, value, priority);
            }
        }
    }

    private listen(): void {
        const on = <Name extends keyof HTMLElementEventMap>(
            target: HTMLElement,
            type: Name,
            listener: (event: HTMLElementEventMap[Name]) => void,
        ): void => {
            target.addEventListener(type, listener);
            this.cleanups.push(() =>
                target.removeEventListener(type, listener),
            );
        };

        if (this.interact) {
            on(this.container, 'pointerdown', (event) =>
                this.pointerDown(event),
            );
            on(this.container, 'pointermove', (event) =>
                this.pointerMove(event),
            );
            on(this.container, 'pointerup', (event) => this.pointerUp(event));
            on(this.container, 'pointercancel', () => this.pointerCancel());
            on(this.container, 'lostpointercapture', () =>
                this.pointerCancel(),
            );
            on(this.container, 'pointerleave', (event) => {
                if (event.pointerType === 'mouse' && this.dragBox === null) {
                    this.controller.hoverAt(null);
                }
            });
            on(this.container, 'keydown', (event) => {
                if (this.controller.key(event.key, event)) {
                    event.preventDefault();
                }
            });
        }

        if (typeof window.matchMedia === 'function') {
            const scheme = window.matchMedia('(prefers-color-scheme: dark)');
            const changed = (): void => this.refresh();
            scheme.addEventListener('change', changed);
            this.cleanups.push(() =>
                scheme.removeEventListener('change', changed),
            );
        }
    }

    private readonly onMedia = (event: Event): void => {
        this.controller.mediaEvent(event.type as MediaEventType);
    };

    private unbindMedia(): void {
        for (const type of MEDIA_EVENTS) {
            this.media?.removeEventListener(type, this.onMedia);
        }

        this.media = null;
    }

    private ratioOf(event: PointerEvent, box: DOMRect): number {
        return ratioAt(event.clientX - box.left, box.width);
    }

    private pointerDown(event: PointerEvent): void {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        const box = this.canvas.getBoundingClientRect();

        if (!this.controller.pointerDown(this.ratioOf(event, box))) {
            return;
        }

        this.dragBox = box;

        try {
            this.container.setPointerCapture(event.pointerId);
        } catch {
            // The pointer is already gone; the drag ends with the next event.
        }
    }

    private pointerMove(event: PointerEvent): void {
        if (this.dragBox !== null) {
            this.controller.pointerMove(this.ratioOf(event, this.dragBox));
        } else if (event.pointerType === 'mouse') {
            this.controller.hoverAt(
                this.ratioOf(event, this.canvas.getBoundingClientRect()),
            );
        }
    }

    private pointerUp(event: PointerEvent): void {
        const box = this.dragBox;

        if (box === null) {
            return;
        }

        this.dragBox = null;
        this.controller.pointerUp(this.ratioOf(event, box));
    }

    private pointerCancel(): void {
        this.dragBox = null;
        this.controller.pointerCancel();
    }

    private load(): void {
        const loader = this.loader;

        if (loader === null) {
            return;
        }

        this.loader = null;
        const load = this.loads;

        new Promise<readonly number[]>((resolve) => resolve(loader())).then(
            (peaks) => {
                if (load === this.loads && !this.destroyed) {
                    this.receive(peaks);
                }
            },
            (error: unknown) => {
                if (load === this.loads && !this.destroyed) {
                    this.events.emit('error', error);
                }
            },
        );
    }

    private receive(peaks: readonly number[] | null): void {
        this.peaks =
            peaks === null
                ? null
                : peaks.map((value) => clamp01(Math.abs(value)));
        this.values = null;
        this.layoutDirty = true;
        this.appear =
            this.peaks !== null &&
            this.animate &&
            this.allocated &&
            this.near &&
            !prefersReducedMotion()
                ? -1
                : null;
        this.invalidate();
    }

    private resize(size: Size): void {
        if (
            size.width === this.size.width &&
            size.height === this.size.height &&
            size.pixelRatio === this.size.pixelRatio
        ) {
            return;
        }

        this.size = size;
        this.allocate();
    }

    private setNear(near: boolean): void {
        this.near = near;

        if (near) {
            this.load();
        }

        this.allocate();
        this.controller.setVisible(near);
    }

    /** Gives the canvas its pixels (or takes them back far from the screen, when lazy). */
    private allocate(): void {
        const keep = !this.lazy || this.near;
        const width = keep ? this.size.width : 0;
        const height = keep ? this.size.height : 0;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.layoutDirty = true;
            this.painted = null;
        }

        this.allocated = width > 0 && height > 0;

        if (this.allocated) {
            this.invalidate();
        }
    }

    private render(now: number): void {
        if (this.destroyed) {
            return;
        }

        this.controller.tick();

        if (!this.allocated || this.context === null) {
            return;
        }

        if (this.appear !== null) {
            this.layoutDirty = true;
        }

        if (this.layoutDirty) {
            this.relayout(now);
            this.paintDirty = true;
        }

        const palette = (this.palette ??= this.resolvePalette());
        const overlay = overlayOf(
            this.controller.progress,
            palette.hover === null ? null : this.controller.hover,
            this.size.width,
        );

        if (this.paintDirty || !sameOverlay(this.painted, overlay)) {
            this.paint(this.context, overlay, palette);
            this.painted = overlay;
            this.paintDirty = false;
        }

        if (this.appear !== null) {
            schedule(this.task);
        }
    }

    private relayout(now: number): void {
        const { width, height, pixelRatio } = this.size;
        this.layoutDirty = false;

        if (this.peaks === null) {
            this.path = linePath(width, height, pixelRatio, this.bar.align);

            return;
        }

        const count = barMetrics(width, this.bar, pixelRatio).count;

        if (this.values === null || this.values.length !== count) {
            this.values = resample(this.peaks, count);
        }

        let values = this.values;

        if (this.appear !== null) {
            if (this.appear < 0) {
                this.appear = now;
            }

            const grown = (now - this.appear) / APPEAR_MS;

            if (grown >= 1) {
                this.appear = null;
            } else {
                const scale = easeOut(grown);
                values = values.map((value) => value * scale);
            }
        }

        this.path = barsPath(
            layoutBars(values, width, height, this.bar, pixelRatio),
        );
    }

    private paint(
        ctx: CanvasRenderingContext2D,
        overlay: Overlay,
        palette: Palette,
    ): void {
        const { width, height, pixelRatio } = this.size;
        const paint: PaintContext = {
            ctx,
            width,
            height,
            pixelRatio,
            progress: this.controller.progress,
            duration: this.controller.duration,
            hover: this.controller.hover,
            xAt: (ratio) => Math.round(clamp01(ratio) * width),
            color: (value) => this.color(value),
        };

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        this.drawPlugins('under', paint);

        if (this.path !== null) {
            paintBars(ctx, this.path, overlay, width, height, palette);
        }

        this.drawPlugins('over', paint);

        if (palette.cursor !== null) {
            paintCursor(
                ctx,
                overlay.progress,
                Math.max(1, Math.round(this.cursorWidth * pixelRatio)),
                width,
                height,
                palette.cursor,
            );
        }
    }

    private drawPlugins(layer: 'under' | 'over', paint: PaintContext): void {
        for (const plugin of this.plugins) {
            if (
                plugin.draw === undefined ||
                (plugin.layer ?? 'over') !== layer ||
                this.failed.has(plugin)
            ) {
                continue;
            }

            paint.ctx.save();

            try {
                plugin.draw(paint);
            } catch (error) {
                // A broken plugin is skipped from now on instead of failing every picture.
                this.failed.add(plugin);
                this.events.emit('error', error);
            } finally {
                paint.ctx.restore();
            }
        }
    }

    private color(value: string): string {
        let resolved = this.colorCache.get(value);

        if (resolved === undefined) {
            const style = getComputedStyle(this.container);
            resolved = resolveColor(value, (name) =>
                style.getPropertyValue(name),
            );
            this.colorCache.set(value, resolved);
        }

        return resolved;
    }

    private resolvePalette(): Palette {
        const wave = this.color(this.colors.wave) || 'gray';
        const progress = this.color(this.colors.progress) || 'currentColor';
        let hover: string | null = null;

        if (this.colors.hover === 'auto') {
            const from = readColor(progress);
            const to = readColor(wave);
            hover =
                from !== null && to !== null
                    ? rgbaString(mixColors(from, to, HOVER_MIX))
                    : progress;
        } else if (this.colors.hover !== null) {
            hover = this.color(this.colors.hover) || null;
        }

        return {
            wave,
            progress,
            hover,
            cursor:
                this.colors.cursor === null
                    ? null
                    : this.color(this.colors.cursor) || null,
        };
    }

    private remove(plugin: Plugin): void {
        const index = this.plugins.indexOf(plugin);

        if (index >= 0) {
            this.plugins.splice(index, 1);
            this.destroyPlugin(plugin);
            this.invalidate();
        }
    }

    private destroyPlugin(plugin: Plugin): void {
        try {
            plugin.destroy?.();
        } catch (error) {
            this.events.emit('error', error);
        }
    }
}
