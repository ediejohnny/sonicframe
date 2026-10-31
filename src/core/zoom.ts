/**
 * The zoom's options and the small rules around them: which key zooms, how far a wheel turn zooms,
 * and the words said about a view. Nothing here touches the page.
 */

import type { KeyModifiers } from './keys';
import { formatTime } from './timing';
import { FULL_VIEW, fitView, viewLevel, type View } from './view';

/** What moved the view. */
export type ViewSource =
    | 'api'
    | 'wheel'
    | 'keys'
    | 'pinch'
    | 'follow'
    | 'edge'
    | 'minimap'
    | 'button';

/** One zoom key or several; false switches it off. */
export type ZoomKey = string | readonly string[] | false;

export type ZoomOptions = {
    /** The view at the start, as ratios of the sound. The whole sound by default. */
    view?: { start: number; end: number };
    /**
     * The largest zoom, from 1 to 10 000. By default one peak per bar (100 without peaks); past the
     * peaks' own detail the bars blend their neighbours.
     */
    max?: number;
    /** How much one key or button zooms in or out: 2, from 1.01 to 100. */
    step?: number;
    /** Keys and buttons zoom around the playing position when it is in view (`'position'`) or the middle (`'center'`). */
    anchor?: 'position' | 'center';
    /** The wheel zooms around the pointer (a touchpad pinch arrives as a wheel with Ctrl). */
    wheel?: boolean;
    /** The key held for the wheel to zoom: `'ctrl'` (Ctrl or ⌘), `'alt'` or `'none'`. */
    wheelModifier?: 'ctrl' | 'alt' | 'none';
    /** How fast the wheel zooms: 1, from 0.1 to 10. */
    wheelSpeed?: number;
    /** The horizontal wheel, a touchpad swipe and Shift + wheel scroll the view. */
    scroll?: boolean;
    /** Two fingers zoom in and out and drag the view sideways. */
    pinch?: boolean;
    /** Keys zoom: `true` gives `+` (and `=`), `-` and `0`; each one can be your own or `false`. */
    keys?: boolean | { in?: ZoomKey; out?: ZoomKey; reset?: ZoomKey };
    /** While playing, the view follows the position. */
    follow?: boolean;
    /** `'page'` turns a whole view at a time; `'center'` keeps the position in the middle (`'page'` with reduced motion). */
    followType?: 'page' | 'center';
    /** A scroll or zoom made by the person holds the following until the next seek or play. */
    followHold?: boolean;
    /** Dragging near an edge scrolls the view, so a selection can grow past the screen. */
    edgeScroll?: boolean;
    /** The width of the edge zone, in CSS pixels: 32, from 1 to 200. */
    edgeSize?: number;
    /** Views scrolled per second right at the edge: 1, from 0.1 to 10. */
    edgeSpeed?: number;
    /** A keyboard seek outside the view brings the view to it. On by default. */
    revealKeys?: boolean;
};

export type ZoomKeys = {
    in: readonly string[];
    out: readonly string[];
    reset: readonly string[];
};

export type ZoomSettings = {
    view: View;
    /** null: one peak per bar. */
    max: number | null;
    step: number;
    anchor: 'position' | 'center';
    wheel: boolean;
    wheelModifier: 'ctrl' | 'alt' | 'none';
    wheelSpeed: number;
    scroll: boolean;
    pinch: boolean;
    /** null: no zoom keys. */
    keys: ZoomKeys | null;
    follow: boolean;
    followType: 'page' | 'center';
    followHold: boolean;
    edgeScroll: boolean;
    edgeSize: number;
    edgeSpeed: number;
    revealKeys: boolean;
};

/** The words said about a view; the frame brings English, the player brings Portuguese. */
export type ZoomWords = {
    /** `level` is rounded to one decimal; `from` and `to` are times, or percentages while the duration is unknown. */
    view(level: number, from: string, to: string): string;
};

export const ZOOM_WORDS: Readonly<ZoomWords> = Object.freeze({
    view: (level: number, from: string, to: string) =>
        `Zoom ${level}×, ${from} to ${to}`,
});

/** The largest zoom anyone can ask for. */
export const MAX_ZOOM = 10_000;

const DEFAULT_KEYS: ZoomKeys = Object.freeze({
    in: ['+', '='],
    out: ['-'],
    reset: ['0'],
});

function within(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
}

function oneOf<T extends string>(
    value: unknown,
    choices: readonly T[],
    fallback: T,
): T {
    return choices.includes(value as T) ? (value as T) : fallback;
}

function keyList(
    value: ZoomKey | undefined,
    fallback: readonly string[],
): string[] {
    if (value === false) {
        return [];
    }

    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.filter((key): key is string => typeof key === 'string');
    }

    return [...fallback];
}

/** The zoom's settings, or null when it is off; strange values fall back to their defaults. */
export function resolveZoom(
    input: boolean | ZoomOptions | undefined,
): ZoomSettings | null {
    if (input === undefined || input === false) {
        return null;
    }

    const options: ZoomOptions = input === true ? {} : input;
    const keys = options.keys;

    return {
        view:
            options.view === undefined
                ? FULL_VIEW
                : fitView(options.view.start, options.view.end, MAX_ZOOM),
        max:
            typeof options.max === 'number' && Number.isFinite(options.max)
                ? within(options.max, 1, 1, MAX_ZOOM)
                : null,
        step: within(options.step, 2, 1.01, 100),
        anchor: oneOf(options.anchor, ['position', 'center'], 'position'),
        wheel: options.wheel === true,
        wheelModifier: oneOf(
            options.wheelModifier,
            ['ctrl', 'alt', 'none'],
            'ctrl',
        ),
        wheelSpeed: within(options.wheelSpeed, 1, 0.1, 10),
        scroll: options.scroll === true,
        pinch: options.pinch === true,
        keys:
            keys === true
                ? { ...DEFAULT_KEYS }
                : keys !== undefined &&
                    keys !== false &&
                    typeof keys === 'object'
                  ? {
                        in: keyList(keys.in, DEFAULT_KEYS.in),
                        out: keyList(keys.out, DEFAULT_KEYS.out),
                        reset: keyList(keys.reset, DEFAULT_KEYS.reset),
                    }
                  : null,
        follow: options.follow === true,
        followType: oneOf(options.followType, ['page', 'center'], 'page'),
        followHold: options.followHold !== false,
        edgeScroll: options.edgeScroll === true,
        edgeSize: within(options.edgeSize, 32, 1, 200),
        edgeSpeed: within(options.edgeSpeed, 1, 0.1, 10),
        revealKeys: options.revealKeys !== false,
    };
}

/** The zoom action of a key, or null; with Ctrl, ⌘ or Alt held the key is the browser's. */
export function zoomKey(
    key: string,
    modifiers: KeyModifiers & { shiftKey?: boolean },
    keys: ZoomKeys,
): 'in' | 'out' | 'reset' | null {
    if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) {
        return null;
    }

    if (keys.in.includes(key)) {
        return 'in';
    }

    if (keys.out.includes(key)) {
        return 'out';
    }

    return keys.reset.includes(key) ? 'reset' : null;
}

/** Pixels per line and per page, for wheels that count in lines (1) or pages (2). */
const LINE = 16;
const PAGE = 400;
/** How much one pixel of wheel zooms, as an exponent. */
const PER_PIXEL = 0.002;

/** The zoom factor of a vertical wheel turn: above 1 zooms in (wheel up), below 1 out. */
export function wheelFactor(
    deltaY: number,
    deltaMode: number,
    speed: number,
): number {
    const pixels =
        deltaY * (deltaMode === 1 ? LINE : deltaMode === 2 ? PAGE : 1);

    return Math.exp(-pixels * PER_PIXEL * speed);
}

/** The words for a view: its zoom, and where it starts and ends (in seconds, or in percent). */
export function viewWords(
    words: ZoomWords,
    view: View,
    duration: number | null,
): string {
    const at = (ratio: number): string =>
        duration === null
            ? `${Math.round(ratio * 100)}%`
            : formatTime(Math.round(ratio * duration));

    return words.view(
        Math.round(viewLevel(view) * 10) / 10,
        at(view.start),
        at(view.end),
    );
}
