/**
 * Where a frame gets its peaks: values from 0 to 1, the loudest point of each slice of the sound.
 * A function is called once, when the frame first comes near the screen (lazy loading).
 */
export type PeaksSource =
    | readonly number[]
    | (() => Promise<readonly number[]>)
    | null;

/** How the bars of a waveform look. Sizes are in CSS pixels. */
export type BarStyle = {
    /** Width of one bar. */
    width: number;
    /** Space between two bars; 0 draws a solid shape. */
    gap: number;
    /** Corner radius; never more than half the bar's width or height. */
    radius: number;
    /** Height of a bar for silence, so the shape of the sound stays readable. */
    minHeight: number;
    /** Bars grow from the middle (a classic waveform) or from the bottom (a bar meter). */
    align: 'center' | 'bottom';
    /**
     * Each value is raised to this power before it is drawn: below 1 lifts quiet speech,
     * above 1 makes only the loud parts stand out. 1 draws the peaks as they are.
     */
    curve: number;
};

/**
 * Colors take any CSS color, or `var(--name)` / `var(--name, fallback)` to follow the page's theme
 * (read again by `refresh()`).
 */
export type Colors = {
    /** Bars not yet played. */
    wave: string;
    /** Bars already played. */
    progress: string;
    /**
     * Bars between the played part and the mouse pointer. `'auto'` mixes the two colors above;
     * null shows no hover.
     */
    hover: string | null;
    /** A thin line at the playing position; null draws none. */
    cursor: string | null;
};

/** What started a seek. */
export type SeekSource = 'pointer' | 'keyboard' | 'api';

export type SeekEvent = {
    /** 0..1 along the frame. */
    ratio: number;
    /** In seconds, or null while the duration is unknown. */
    time: number | null;
    source: SeekSource;
};

/** The part of an `HTMLMediaElement` that SonicFrame reads and writes. */
export type MediaLike = {
    currentTime: number;
    readonly duration: number;
    readonly paused: boolean;
    readonly ended: boolean;
    readonly readyState: number;
};

export type SonicFrameEvents = {
    /** The listener changed the position (click, drag, keyboard or `seekTo`). */
    seek: [event: SeekEvent];
    /** The mouse moved over the frame (null when it left). */
    hover: [ratio: number | null, time: number | null];
    /** The bound media moved, at the media's own pace (a few times a second), never once per frame. */
    timeupdate: [time: number | null, ratio: number];
    /** Loading the peaks or drawing a plugin failed. */
    error: [error: unknown];
    destroy: [];
};

/** What a plugin can read and ask from the frame it belongs to. */
export type PluginHost = {
    readonly container: HTMLElement;
    /** In seconds, or null while unknown. */
    readonly duration: number | null;
    /** 0..1, the position shown. */
    readonly progress: number;
    /** Asks for a new picture on the next animation frame. */
    invalidate(): void;
    on<Name extends keyof SonicFrameEvents>(
        event: Name,
        listener: (...args: SonicFrameEvents[Name]) => void,
    ): () => void;
};

/** What a plugin gets to draw its layer. Everything is in device pixels. */
export type PaintContext = {
    readonly ctx: CanvasRenderingContext2D;
    readonly width: number;
    readonly height: number;
    /** Device pixels per CSS pixel. */
    readonly pixelRatio: number;
    /** 0..1, the position shown. */
    readonly progress: number;
    readonly duration: number | null;
    /** 0..1 under the mouse pointer, or null. */
    readonly hover: number | null;
    /** The device-pixel x of a position from 0 to 1. */
    xAt(ratio: number): number;
    /** Resolves a CSS color (including `var(--name)`) against the frame's element. */
    color(value: string): string;
};

/** A plugin adds a layer or a behaviour to a frame: markers today; regions, timelines and more later. */
export type Plugin = {
    readonly name: string;
    /** Drawn under the bars or over them (the default). */
    readonly layer?: 'under' | 'over';
    /** Called once, when the frame takes the plugin. */
    setup?(host: PluginHost): void;
    /** Called on every picture. */
    draw?(paint: PaintContext): void;
    /** Called when the plugin is removed or the frame is destroyed. */
    destroy?(): void;
};
