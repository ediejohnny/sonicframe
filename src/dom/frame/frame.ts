/**
 * The `SonicFrame` class: the browser shell around the pure core. It owns one canvas inside the
 * element it is given, follows a media element, and draws when the core says something changed.
 * `destroy()` gives the element back as it was.
 *
 * The frame holds the wave's own life: its peaks (loaded near the screen), its size and pixels, and
 * when to draw. Its collaborators do the rest: the element made ready (`prepareContainer`), the
 * colors read from the page (`FrameColors`), the plugins (`PluginSet`), the view and its zoom
 * (`FrameView`), the pointer (`FramePointer`) and the picture itself (`FramePicture`).
 */

import { Controller, type ValueText } from '../../core/frame/controller';
import {
    MEDIA_EVENTS,
    type MediaEventType,
} from '../../core/frame/media-events';
import { wordsFor } from '../../core/languages/language';
import { Emitter } from '../../core/shared/emitter';
import { finiteOr } from '../../core/shared/checked';
import { clamp01 } from '../../core/shared/math';
import { defaultValueText } from '../../core/shared/timing';
import {
    viewLevel,
    viewRatio,
    viewX,
    type ViewState,
} from '../../core/view/view';
import {
    MAX_ZOOM,
    resolveZoom,
    zoomWords,
    type ViewSource,
} from '../../core/view/zoom';
import { barMetrics } from '../../core/wave/layout';
import { overlayOf, sameOverlay, type Overlay } from '../../core/wave/scene';
import { DEFAULT_WAVE, resolveWave } from '../../core/wave/shapes';
import type {
    BarStyle,
    Colors,
    FrameGeometry,
    Lane,
    PaintContext,
    PeaksData,
    PeaksSource,
    Plugin,
    PluginHost,
    SeekSource,
    SonicFrameEvents,
    WaveName,
    WaveStyle,
} from '../../types';
import { announce } from '../a11y/announce';
import { chosenLanguage } from '../a11y/page-language';
import { exportClip, type ClipOptions } from '../clip/clip';
import { css } from '../shared/css';
import { prefersReducedMotion } from '../shared/motion';
import { observeSize, observeVisibility, type Size } from '../shared/observe';
import { onSchemeChange } from '../shared/scheme';
import { FrameColors } from './frame-colors';
import { prepareContainer } from './frame-container';
import {
    DEFAULT_BAR,
    DEFAULT_COLORS,
    type SonicFrameOptions,
} from './frame-options';
import { FramePicture, type Scene } from './frame-picture';
import { FramePointer } from './frame-pointer';
import { FrameView } from './frame-view';
import { LaneManager } from './lanes';
import { PluginSet } from './plugin-set';
import { schedule, setLooping, unschedule, type FrameTask } from './scheduler';

/** The largest zoom while the frame has no peaks to set it. */
const DEFAULT_MAX_ZOOM = 100;

/** The peaks of either kind of source, and the duration they came with (null for a bare list). */
function unpack(source: readonly number[] | PeaksData | null): {
    peaks: readonly number[] | null;
    duration: number | null;
} {
    if (source !== null && 'peaks' in source) {
        return { peaks: source.peaks, duration: source.duration ?? null };
    }

    return { peaks: source, duration: null };
}

export class SonicFrame implements PluginHost {
    readonly container: HTMLElement;
    /** The language tag the wave and its plugins speak. */
    readonly lang: string;
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D | null;
    private readonly controller: Controller;
    private readonly events = new Emitter<SonicFrameEvents>();
    private readonly task: FrameTask;
    private readonly interact: boolean;
    private readonly lazy: boolean;
    private readonly animate: boolean;
    private readonly cursorWidth: number;
    private readonly valueText: ValueText;
    private readonly cleanups: (() => void)[] = [];
    private readonly restoreContainer: () => void;
    private bar: BarStyle;
    private wave: WaveStyle;
    private readonly colors: FrameColors;
    private readonly plugins = new PluginSet((error) =>
        this.events.emit('error', error),
    );
    private readonly frameView: FrameView;
    private readonly pointer: FramePointer;
    private readonly picture = new FramePicture();
    private peaksData: number[] | null = null;
    private loader: (() => Promise<readonly number[] | PeaksData>) | null =
        null;
    private loads = 0;
    private size: Size = { width: 0, height: 0, pixelRatio: 1 };
    private near = false;
    private allocated = false;
    /** The wave must be shaped again before the next picture. */
    private layoutDirty = true;
    /** The picture must be painted again. */
    private paintDirty = true;
    private painted: Overlay | null = null;
    private mediaEl: HTMLMediaElement | null = null;
    private override: number[] | null = null;
    private destroyed = false;
    private readonly lanes: LaneManager;
    private overlayEl: HTMLElement | null = null;

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
        this.cursorWidth = finiteOr(options.cursorWidth, 2);
        this.valueText = options.valueText ?? defaultValueText;
        this.bar = { ...DEFAULT_BAR, ...options.bar };
        this.wave = resolveWave(DEFAULT_WAVE, options.wave);
        this.colors = new FrameColors(this.container, {
            ...DEFAULT_COLORS,
            ...options.colors,
        });
        this.task = { render: (now) => this.render(now) };
        this.lang = chosenLanguage(options.a11y?.lang, this.container);
        this.restoreContainer = prepareContainer(
            this.container,
            this.interact,
            options.label ?? wordsFor(this.lang).frame.position,
        );

        this.canvas = document.createElement('canvas');
        this.canvas.setAttribute('aria-hidden', 'true');
        css(this.canvas, [
            ['position', 'absolute'],
            ['inset', '0'],
            ['width', '100%'],
            ['height', '100%'],
            ['display', 'block'],
            ['pointer-events', 'none'],
        ]);
        this.canvas.width = 0;
        this.canvas.height = 0;
        this.container.append(this.canvas);
        this.context = this.canvas.getContext('2d');
        this.lanes = new LaneManager(this.container, this.canvas, () =>
            this.relayoutLanes(),
        );
        this.frameView = new FrameView(
            resolveZoom(options.zoom),
            {
                maxLevel: () => this.maxLevel(),
                progress: () => this.controller.progress,
                duration: () => this.controller.duration,
                playing: () => this.controller.playing,
                pressing: () => this.pointer.pressing,
                moved: (source) => {
                    this.layoutDirty = true;
                    this.invalidate();
                    this.events.emit('viewchange', this.view, source);
                },
            },
            options.a11y?.zoom?.announce === true,
            { ...zoomWords(this.lang), ...options.a11y?.zoom?.words },
        );

        this.controller = new Controller(
            {
                interact: this.interact,
                stepSeconds: finiteOr(options.stepSeconds, 5),
                largeStepRatio: finiteOr(options.largeStepRatio, 0.1),
                rewindOnEnd: options.rewindOnEnd ?? false,
                valueText: (time, ratio, duration) =>
                    [
                        this.valueText(time, ratio, duration),
                        ...this.plugins.notes(time, ratio),
                    ].join(', '),
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
        this.pointer = new FramePointer({
            container: this.container,
            controller: this.controller,
            plugins: this.plugins,
            lanes: this.lanes,
            view: this.frameView,
            box: () => this.canvas.getBoundingClientRect(),
            maxLevel: () => this.maxLevel(),
            schedule: () => schedule(this.task),
        });

        this.listen();
        this.cleanups.push(
            observeSize(this.canvas, (size) => this.resize(size)),
            observeVisibility(this.canvas, (near) => this.setNear(near)),
        );

        this.setPeaks(options.peaks ?? null);
        this.controller.setDuration(options.duration ?? null);
        this.bind(options.media ?? null);

        if (this.frameView.zoom !== null) {
            this.frameView.begin();
            this.events.on('seek', (event) => this.frameView.seeked(event));
        }

        // After bind, so a plugin's setup already sees the media (e.g. liveFrequency taps it).
        for (const plugin of options.plugins ?? []) {
            this.use(plugin);
        }

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

    /**
     * Where the sound is, in seconds: the media's own time, or where a seek waiting for the media
     * to load (`preload="none"`) will start it; without media, the position set. A drag moves it
     * only when let go. Null without media while the duration is unknown.
     */
    get time(): number | null {
        return this.controller.time;
    }

    on<Name extends keyof SonicFrameEvents>(
        event: Name,
        listener: (...args: SonicFrameEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /** The peaks the frame drew (0..1), or null while it has none. */
    get peaks(): readonly number[] | null {
        return this.peaksData;
    }

    /** The duration the peaks came with (a waveform file's), in seconds, or null. */
    get peaksDuration(): number | null {
        return this.controller.peaksDuration;
    }

    /** The part of the sound in view, its zoom level and the largest one; the whole sound while zoom is off. */
    get view(): ViewState {
        return this.frameView.state();
    }

    /** Shows `start`..`end` of the sound (ratios from 0 to 1), kept possible; zoom must be on. */
    setView(start: number, end: number, source: ViewSource = 'api'): void {
        this.frameView.set(start, end, source);
    }

    /**
     * Zooms to `level` around `at` (a ratio of the sound that keeps its place on screen); without it,
     * around the playing position when in view or the middle, as `anchor` says.
     */
    zoomTo(level: number, at?: number, source: ViewSource = 'api'): void {
        this.frameView.zoomTo(level, at, source);
    }

    /** Zooms in (`factor` above 1) or out (below 1) from the current level; see `zoomTo`. */
    zoomBy(factor: number, at?: number, source: ViewSource = 'api'): void {
        this.zoomTo(viewLevel(this.frameView.current) * factor, at, source);
    }

    /** Moves the view to begin at `start` (a ratio of the sound), keeping its size. */
    scrollTo(start: number, source: ViewSource = 'api'): void {
        this.frameView.scrollTo(start, source);
    }

    /** The media element the frame follows, or null. */
    get media(): HTMLMediaElement | null {
        return this.mediaEl;
    }

    /** Overrides the bar heights with live values (e.g. a spectrum); null gives the peaks back. */
    setValues(values: readonly number[] | null): void {
        this.override = values === null ? null : values.map((v) => clamp01(v));
        this.picture.newValues();
        this.layoutDirty = true;
        this.invalidate();
    }

    /** The wave area's size and state, or null before the frame has pixels. */
    get geometry(): FrameGeometry | null {
        if (!this.allocated) {
            return null;
        }

        return {
            width: this.size.width,
            height: this.size.height,
            pixelRatio: this.size.pixelRatio,
            duration: this.controller.duration,
            progress: this.controller.progress,
        };
    }

    /** Takes a strip above or below the bars; the wave shrinks to make room. */
    addLane(side: 'above' | 'below', cssPixels: number): Lane {
        return this.lanes.add(side, cssPixels);
    }

    /** A layer over the canvas for a plugin's text and tooltips, created once and shared. */
    overlay(): HTMLElement {
        if (this.overlayEl === null) {
            const element = document.createElement('div');
            css(element, [
                ['position', 'absolute'],
                ['left', '0'],
                ['right', '0'],
                ['pointer-events', 'none'],
            ]);
            this.container.append(element);
            this.lanes.fitToBars(element);
            this.overlayEl = element;
        }

        return this.overlayEl;
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
        this.mediaEl = media;

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

    /**
     * Moves to a position from 0 to 1 (the bound media too) and emits `seek`; `source` says what
     * asked (`'api'` by default; a plugin's key passes `'keyboard'`, so the view follows it).
     */
    seekTo(ratio: number, source: SeekSource = 'api'): void {
        this.controller.seekTo(ratio, source);
    }

    /** Plays `start`..`end` seconds of the bound media, optionally looping. */
    playRange(start: number, end: number, options?: { loop?: boolean }): void {
        this.controller.playRange(start, end, options?.loop ?? false);
    }

    /** Forgets any range being played (playback itself carries on). */
    stopRange(): void {
        this.controller.stopRange();
    }

    /** Says something through the page's shared polite live region, for screen readers. */
    announce(text: string): void {
        announce(text);
    }

    /** Reports a plugin's failure outside its hooks (a download, a decode) as the `error` event. */
    reportError(error: unknown): void {
        if (!this.destroyed) {
            this.events.emit('error', error);
        }
    }

    /** Says the slider's value in words again, after a plugin's `valueNote` changed. */
    updateValueText(): void {
        if (!this.destroyed) {
            this.controller.refresh();
        }
    }

    /** Records a clip of the wave playing, using the frame's own peaks, bars and colors. */
    exportClip(
        options: Partial<ClipOptions> = {},
    ): Promise<{ blob: Blob; mimeType: string; duration: number }> {
        const audio =
            options.audio ?? this.mediaEl?.currentSrc ?? this.mediaEl?.src;

        if (audio === undefined || audio === '') {
            return Promise.reject(
                new Error('sonicframe: no audio to record a clip from'),
            );
        }

        const palette = this.colors.palette();

        return exportClip({
            audio,
            peaks: this.peaksData ?? [],
            bar: this.bar,
            wave: this.wave,
            colors: {
                wave: palette.wave,
                progress: palette.progress,
                knob: palette.knob ?? undefined,
            },
            // Its own media's length is known, so an over-long source is refused before any download.
            sourceSeconds:
                options.audio === undefined
                    ? (this.duration ?? undefined)
                    : undefined,
            ...options,
        });
    }

    setBar(bar: Partial<BarStyle>): void {
        this.bar = { ...this.bar, ...bar };
        this.frameView.refit();
        this.layoutDirty = true;
        this.invalidate();
    }

    /** Changes how the sound is drawn: a name, or details over the current drawing. */
    setWave(wave: WaveName | Partial<WaveStyle>): void {
        this.wave = resolveWave(this.wave, wave);
        this.layoutDirty = true;
        this.invalidate();
    }

    setColors(colors: Partial<Colors>): void {
        this.colors.set(colors);
        this.invalidate();
    }

    setLabel(label: string): void {
        this.container.setAttribute('aria-label', label);
    }

    /** Reads the colors again (after a theme change) and redraws. */
    refresh(): void {
        this.colors.forget();
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

        this.plugins.add(plugin, this);
        const geometry = this.geometry;

        if (geometry !== null) {
            this.plugins.resize(geometry, plugin);
        }

        if (plugin.valueNote !== undefined) {
            this.controller.refresh();
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
        this.frameView.stop();
        unschedule(this.task);

        for (const cleanup of this.cleanups.splice(0).reverse()) {
            cleanup();
        }

        this.plugins.clear();
        this.canvas.width = 0;
        this.canvas.height = 0;
        this.canvas.remove();
        this.lanes.dispose();
        this.overlayEl?.remove();
        this.overlayEl = null;
        this.pointer.restore();
        this.restoreContainer();
        this.events.emit('destroy');
        this.events.clear();
    }

    /** A CSS color as the page computes it for this frame (`var()` followed); '' when it has none. */
    color(value: string): string {
        return this.colors.color(value);
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
        const pointer = this.pointer;

        if (this.interact) {
            on(this.container, 'pointerdown', (event) => pointer.down(event));
            on(this.container, 'pointermove', (event) => pointer.move(event));
            on(this.container, 'pointerup', (event) => pointer.up(event));
            on(this.container, 'pointercancel', (event) =>
                pointer.cancelled(event),
            );
            on(this.container, 'lostpointercapture', () => pointer.cancel());
            on(this.container, 'pointerleave', (event) => pointer.leave(event));
            on(this.container, 'keydown', (event) => {
                if (
                    this.plugins.key(event) ||
                    this.frameView.keyDown(event) ||
                    this.controller.key(event.key, event)
                ) {
                    event.preventDefault();
                }
            });
        }

        const zoom = this.frameView.zoom;

        if (zoom?.wheel || zoom?.scroll) {
            // Not passive: a wheel that zooms or scrolls the view must not scroll the page too.
            const listener = (event: WheelEvent): void =>
                this.frameView.wheel(
                    event,
                    this.canvas.getBoundingClientRect(),
                );
            this.container.addEventListener('wheel', listener, {
                passive: false,
            });
            this.cleanups.push(() =>
                this.container.removeEventListener('wheel', listener),
            );
        }

        this.cleanups.push(onSchemeChange(() => this.refresh()));
    }

    private readonly onMedia = (event: Event): void => {
        if (event.type === 'play') {
            this.frameView.played();
        }

        this.controller.mediaEvent(event.type as MediaEventType);
    };

    /** The largest zoom: the option, or one peak per bar (100 while there are no peaks or pixels). */
    private maxLevel(): number {
        const zoom = this.frameView.zoom;

        if (zoom === null) {
            return 1;
        }

        if (zoom.max !== null) {
            return zoom.max;
        }

        const { width, pixelRatio } = this.size;
        const bars = barMetrics(width, this.bar, pixelRatio).count;
        const peaks = this.peaksData;

        return peaks === null || bars === 0
            ? DEFAULT_MAX_ZOOM
            : Math.min(MAX_ZOOM, Math.max(1, peaks.length / bars));
    }

    private unbindMedia(): void {
        for (const type of MEDIA_EVENTS) {
            this.mediaEl?.removeEventListener(type, this.onMedia);
        }

        this.mediaEl = null;
    }

    private load(): void {
        const loader = this.loader;

        if (loader === null) {
            return;
        }

        this.loader = null;
        const load = this.loads;

        new Promise<readonly number[] | PeaksData>((resolve) =>
            resolve(loader()),
        ).then(
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

    private receive(source: readonly number[] | PeaksData | null): void {
        const { peaks, duration } = unpack(source);
        this.peaksData =
            peaks === null
                ? null
                : peaks.map((value) => clamp01(Math.abs(value)));
        this.controller.setPeaksDuration(duration);
        this.picture.newPeaks(
            this.peaksData !== null &&
                this.animate &&
                this.allocated &&
                this.near &&
                !prefersReducedMotion(),
        );
        this.frameView.refit();
        this.layoutDirty = true;
        this.invalidate();
        this.events.emit('peakschange', this.peaksData);
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
        this.frameView.refit();
        this.relayoutLanes();
        this.allocate();
        this.notifyResize();

        // A new canvas size clears its pixels. Sizes arrive after layout and before the page is
        // painted, so painting now shows the new wave in this very frame instead of a blank one.
        if (this.allocated) {
            this.render(performance.now());
        }
    }

    /** Re-places the lanes and insets the canvas and the overlay for the container's current height. */
    private relayoutLanes(): void {
        this.lanes.layout(this.container.getBoundingClientRect().height);

        if (this.overlayEl !== null) {
            this.lanes.fitToBars(this.overlayEl);
        }

        this.invalidate();
    }

    /** Tells listeners and plugins the wave area changed size (only once it has pixels). */
    private notifyResize(): void {
        const geometry = this.geometry;

        if (geometry === null) {
            return;
        }

        this.events.emit('resize', geometry);
        this.plugins.resize(geometry);
    }

    /** Coming near gives a lazy frame its pixels, so plugins learn its geometry right then. */
    private setNear(near: boolean): void {
        const wasAllocated = this.allocated;
        this.near = near;

        if (near) {
            this.load();
        }

        this.allocate();
        this.controller.setVisible(near);

        if (this.allocated && !wasAllocated) {
            this.notifyResize();
        }
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
        this.frameView.follow();
        this.pointer.scrollAtEdge(now);

        if (!this.allocated || this.context === null) {
            return;
        }

        const scene: Scene = {
            size: this.size,
            peaks: this.peaksData,
            override: this.override,
            view: this.frameView.current,
            bar: this.bar,
            wave: this.wave,
            cursorWidth: this.cursorWidth,
        };

        if (this.layoutDirty || this.picture.growing) {
            this.layoutDirty = false;
            this.picture.shape(scene, now);
            this.paintDirty = true;
        }

        const palette = this.colors.palette();
        const hoverMatters =
            palette.hover !== null ||
            palette.waveHover != null ||
            palette.progressHover != null;
        const overlay = overlayOf(
            this.controller.progress,
            palette.hover === null ? null : this.controller.hover,
            this.size.width,
            hoverMatters && this.controller.hover !== null,
            this.frameView.current,
        );

        if (this.paintDirty || !sameOverlay(this.painted, overlay)) {
            this.picture.paint(
                this.paintContext(this.context),
                scene,
                overlay,
                palette,
                this.plugins,
            );
            this.painted = overlay;
            this.paintDirty = false;
        }

        if (this.picture.growing) {
            schedule(this.task);
        }
    }

    /** What plugins draw with: the canvas, its size, the sound's state, and the view's maths. */
    private paintContext(ctx: CanvasRenderingContext2D): PaintContext {
        const { width, height, pixelRatio } = this.size;
        const view = this.frameView.current;

        return {
            ctx,
            width,
            height,
            pixelRatio,
            progress: this.controller.progress,
            duration: this.controller.duration,
            hover: this.controller.hover,
            view: this.view,
            xAt: (ratio) => Math.round(viewX(clamp01(ratio), view, width)),
            ratioAt: (x) => viewRatio(x, view, width),
            color: (value) => this.color(value),
        };
    }

    private remove(plugin: Plugin): void {
        if (this.plugins.remove(plugin)) {
            if (plugin.valueNote !== undefined) {
                this.controller.refresh();
            }

            this.invalidate();
        }
    }
}
