/**
 * The part of the sound a frame shows, and the ways to move it besides the pointer: the API, the zoom
 * keys, the wheel, and following the position while it plays. Every move keeps the view possible
 * (never past the largest zoom); a move by the person holds the following until the next seek or
 * play, and one by the keys or a button is said aloud when asked. With zoom off the view is the
 * whole sound and never moves.
 */

import {
    FULL_VIEW,
    fitView,
    revealView,
    scrollView,
    viewLevel,
    viewRatio,
    zoomView,
    type View,
    type ViewState,
} from '../../core/view/view';
import {
    viewWords,
    wheelFactor,
    zoomKey,
    type ViewSource,
    type ZoomSettings,
    type ZoomWords,
} from '../../core/view/zoom';
import type { SeekEvent } from '../../types';
import { announce } from '../a11y/announce';
import { prefersReducedMotion } from '../shared/motion';

/** What the view needs from its frame. */
export type ViewHost = {
    /** The largest zoom now: it moves with the peaks, the bars and the size. */
    maxLevel(): number;
    /** The position shown, from 0 to 1. */
    progress(): number;
    duration(): number | null;
    playing(): boolean;
    /** Whether a press is held: the view never follows under one. */
    pressing(): boolean;
    /** The view moved: draw again and tell the listeners. */
    moved(source: ViewSource): void;
};

export class FrameView {
    private data: View = FULL_VIEW;
    /** A scroll or zoom by the person holds the following until the next seek or play. */
    private held = false;
    /** Once the frame is destroyed, the view never moves again. */
    private stopped = false;

    constructor(
        /** The zoom's settings, or null while it is off. */
        readonly zoom: ZoomSettings | null,
        private readonly host: ViewHost,
        /** Whether a move by the keys, a button or two fingers is said aloud. */
        private readonly announces: boolean,
        private readonly words: ZoomWords,
    ) {}

    /** The part of the sound in view, as ratios. */
    get current(): View {
        return this.data;
    }

    /** The view, its zoom level and the largest one. */
    state(): ViewState {
        return {
            start: this.data.start,
            end: this.data.end,
            level: viewLevel(this.data),
            maxLevel: this.host.maxLevel(),
        };
    }

    /** Starts at the zoom's own view, kept possible (zoom on only). */
    begin(): void {
        if (this.zoom !== null) {
            const view = this.zoom.view;
            this.data = fitView(view.start, view.end, this.host.maxLevel());
        }
    }

    /** Shows `start`..`end` of the sound, kept possible. */
    set(start: number, end: number, source: ViewSource): void {
        this.move(fitView(start, end, this.host.maxLevel()), source);
    }

    /**
     * Zooms to `level` around `at` (a ratio of the sound that keeps its place on screen); without it,
     * around the playing position when in view or the middle, as `anchor` says.
     */
    zoomTo(level: number, at: number | undefined, source: ViewSource): void {
        this.move(
            zoomView(
                this.data,
                level,
                at ?? this.anchor(),
                this.host.maxLevel(),
            ),
            source,
        );
    }

    /** Moves the view to begin at `start`, keeping its size. */
    scrollTo(start: number, source: ViewSource): void {
        this.move(scrollView(this.data, start), source);
    }

    /**
     * Shows `next` (zoom on only) and tells the frame. A move by the person holds the following;
     * keys, buttons and two fingers are announced when asked (two fingers once they let go).
     */
    move(
        next: View,
        source: ViewSource,
        hold: boolean = source !== 'api' && source !== 'follow',
    ): void {
        const view = this.data;

        if (
            this.zoom === null ||
            this.stopped ||
            (next.start === view.start && next.end === view.end)
        ) {
            return;
        }

        this.data = next;

        if (hold && this.zoom.followHold) {
            this.held = true;
        }

        this.host.moved(source);

        if (hold && (source === 'keys' || source === 'button')) {
            this.announce();
        }
    }

    /** Says the view through the live region, when asked to. */
    announce(): void {
        if (this.announces) {
            announce(viewWords(this.words, this.data, this.host.duration()));
        }
    }

    /** Keeps the view possible after the largest zoom changed (new peaks, a new size or bar). */
    refit(): void {
        const { start, end } = this.data;
        this.move(fitView(start, end, this.host.maxLevel()), 'api', false);
    }

    /** A seek ends the hold; a seek by the keys outside the view brings the view to it (`revealKeys`). */
    seeked(event: SeekEvent): void {
        this.held = false;

        if (event.source === 'keyboard' && this.zoom?.revealKeys) {
            this.move(
                revealView(this.data, event.ratio, 'page'),
                'keys',
                false,
            );
        }
    }

    /** Playing ends the hold. */
    played(): void {
        this.held = false;
    }

    /** The frame is gone: the view stays where it is. */
    stop(): void {
        this.stopped = true;
    }

    /** A zoom key (zoom keys on): in, out or back to the whole sound. Returns whether it was one. */
    keyDown(event: KeyboardEvent): boolean {
        const zoom = this.zoom;
        const action =
            zoom?.keys == null ? null : zoomKey(event.key, event, zoom.keys);

        if (zoom === null || action === null) {
            return false;
        }

        if (action === 'reset') {
            this.set(0, 1, 'keys');
        } else {
            this.zoomTo(
                viewLevel(this.data) *
                    (action === 'in' ? zoom.step : 1 / zoom.step),
                undefined,
                'keys',
            );
        }

        return true;
    }

    /** The wheel over `box`: zooms around the pointer with its modifier held, or scrolls the view sideways. */
    wheel(event: WheelEvent, box: DOMRect): void {
        const zoom = this.zoom;

        if (zoom === null) {
            return;
        }

        const held =
            zoom.wheelModifier === 'none' ||
            (zoom.wheelModifier === 'ctrl'
                ? event.ctrlKey || event.metaKey
                : event.altKey);

        if (zoom.wheel && held && event.deltaY !== 0 && !event.shiftKey) {
            event.preventDefault();
            this.zoomTo(
                viewLevel(this.data) *
                    wheelFactor(event.deltaY, event.deltaMode, zoom.wheelSpeed),
                viewRatio(event.clientX - box.left, this.data, box.width),
                'wheel',
            );

            return;
        }

        const { start, end } = this.data;
        const sideways =
            event.deltaX !== 0
                ? event.deltaX
                : event.shiftKey
                  ? event.deltaY
                  : 0;

        // At the whole sound there is nothing to scroll: the page keeps the wheel.
        if (
            !zoom.scroll ||
            sideways === 0 ||
            end - start >= 1 ||
            box.width <= 0
        ) {
            return;
        }

        const pixels =
            sideways *
            (event.deltaMode === 1
                ? 16
                : event.deltaMode === 2
                  ? box.width
                  : 1);
        event.preventDefault();
        this.scrollTo(start + (pixels / box.width) * (end - start), 'wheel');
    }

    /** While playing (following on, not held), the view turns a page or keeps the position centered. */
    follow(): void {
        const zoom = this.zoom;
        const { start, end } = this.data;

        if (
            zoom === null ||
            !zoom.follow ||
            this.held ||
            this.host.pressing() ||
            end - start >= 1 ||
            !this.host.playing()
        ) {
            return;
        }

        const at = this.host.progress();
        const center = zoom.followType === 'center' && !prefersReducedMotion();

        this.move(
            center
                ? scrollView(this.data, at - (end - start) / 2)
                : revealView(this.data, at, 'page'),
            'follow',
        );
    }

    /** Where keys and buttons zoom around: the playing position while in view, else the middle. */
    private anchor(): number {
        const { start, end } = this.data;
        const position = this.host.progress();

        return this.zoom?.anchor === 'position' &&
            position >= start &&
            position <= end
            ? position
            : (start + end) / 2;
    }
}
