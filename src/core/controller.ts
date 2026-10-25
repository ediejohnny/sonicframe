/**
 * Everything a frame does, without the page: it follows a media element, turns pointer and keyboard
 * input into seeks, and decides when a new picture or animation frames are needed. The DOM shell
 * (`dom/frame.ts`) only translates events in and carries effects out, so all of this runs in tests.
 */

import type { MediaLike, SeekSource, SonicFrameEvents } from '../types';
import { keyAction, type KeyModifiers } from './keys';
import { clamp01, positive } from './math';
import { rangeStep, type RangeState } from './range';
import { defaultValueText, effectiveDuration, stepRatio } from './timing';

/** `HAVE_METADATA`: from here on the media knows its duration and can seek. */
const HAVE_METADATA = 1;

export type MediaEventType =
    | 'play'
    | 'playing'
    | 'pause'
    | 'ended'
    | 'waiting'
    | 'seeking'
    | 'seeked'
    | 'timeupdate'
    | 'durationchange'
    | 'loadedmetadata'
    | 'emptied';

/** The media events a frame listens to. */
export const MEDIA_EVENTS: readonly MediaEventType[] = [
    'play',
    'playing',
    'pause',
    'ended',
    'waiting',
    'seeking',
    'seeked',
    'timeupdate',
    'durationchange',
    'loadedmetadata',
    'emptied',
];

export type ValueText = (
    time: number | null,
    ratio: number,
    duration: number | null,
) => string;

export type ControllerOptions = {
    /** Pointer and keyboard can seek. */
    interact: boolean;
    /** Seconds moved by an arrow key. */
    stepSeconds: number;
    /** Part of the sound moved by Page Up / Page Down. */
    largeStepRatio: number;
    /** Show the start again when the media ends. */
    rewindOnEnd: boolean;
    /** The position as words, for assistive technology. */
    valueText?: ValueText;
};

/** The slider's value for assistive technology: a percentage and its words. */
export type AriaState = { now: number; text: string };

export type ControllerEffects = {
    /** Something on screen changed: a new picture is needed. */
    invalidate(): void;
    /** Whether animation frames are wanted (the media plays and the frame is on screen). */
    loop(on: boolean): void;
    /** New slider values (only when they changed). */
    aria(state: AriaState): void;
    emit<Name extends keyof SonicFrameEvents>(
        event: Name,
        ...args: SonicFrameEvents[Name]
    ): void;
};

export class Controller {
    private options: ControllerOptions;
    private readonly effects: ControllerEffects;
    private media: MediaLike | null = null;
    private hint: number | null = null;
    /** 0..1 from the media, a seek or the app. */
    private position = 0;
    /** 0..1 under a pressed pointer, shown instead of the position until it is let go. */
    private dragging: number | null = null;
    private hovering: number | null = null;
    /** A seek asked for before the media could seek; done as soon as it can. */
    private pending: number | null = null;
    private waiting = false;
    private visible = false;
    private looping = false;
    private announced: AriaState | null = null;
    private reported: number | null | undefined = undefined;
    private range: RangeState | null = null;

    constructor(options: ControllerOptions, effects: ControllerEffects) {
        this.options = { ...options };
        this.effects = effects;
    }

    /** In seconds, or null while unknown. */
    get duration(): number | null {
        return effectiveDuration(this.media?.duration, this.hint);
    }

    /** 0..1, the position shown (under the pointer while it drags). */
    get progress(): number {
        return this.dragging ?? this.position;
    }

    /** 0..1 under the mouse pointer, or null. */
    get hover(): number | null {
        return this.hovering;
    }

    get playing(): boolean {
        const media = this.media;

        return media !== null && !media.paused && !media.ended && !this.waiting;
    }

    configure(options: Partial<ControllerOptions>): void {
        this.options = { ...this.options, ...options };
        this.updateAria();
    }

    /** Follows a media element (or none). Several frames can follow the same one. */
    bind(media: MediaLike | null): void {
        this.media = media;
        this.pending = null;
        this.dragging = null;
        this.waiting = false;
        this.reported = undefined;
        this.range = null;

        if (media === null) {
            this.position = 0;
        }

        this.sync(true);
        this.updateLoop();
        this.effects.invalidate();
    }

    /** Called with every media event in `MEDIA_EVENTS`. */
    mediaEvent(type: MediaEventType): void {
        if (this.media === null) {
            return;
        }

        switch (type) {
            case 'play':
            case 'playing':
                this.waiting = false;
                break;
            case 'waiting':
                this.waiting = true;
                break;
            case 'emptied':
                this.pending = null;
                this.waiting = false;
                this.range = null;
                break;
            default:
                break;
        }

        this.applyPending();
        this.sync(true);
        this.updateLoop();
        this.effects.invalidate();
    }

    /** One animation frame while looping: reads the media's time. Returns whether to keep looping. */
    tick(): boolean {
        if (this.media !== null && this.dragging === null) {
            this.sync(false);
        }

        if (this.range !== null && this.playing) {
            this.applyRange();
        }

        return this.looping;
    }

    /** Plays `start`..`end` seconds (optionally looping); the frame must have a media element. */
    playRange(start: number, end: number, loop: boolean = false): void {
        const duration = this.duration;

        if (this.media === null || duration === null) {
            return;
        }

        const from = Math.max(0, Math.min(start, duration));
        const to = Math.max(from, Math.min(end, duration));
        this.range = { start: from, end: to, loop };
        this.seek(from / duration, 'api');
        void this.media.play?.();
    }

    /** Forgets any range being played (playback itself carries on). */
    stopRange(): void {
        this.range = null;
    }

    private applyRange(): void {
        const media = this.media;

        if (media === null || this.range === null) {
            return;
        }

        const step = rangeStep(media.currentTime, this.range);

        if (step === 'wrap') {
            media.currentTime = this.range.start;
        } else if (step === 'stop') {
            const reachedEnd = media.currentTime >= this.range.end;
            this.range = null;

            if (reachedEnd) {
                media.pause?.();
            }

            this.effects.emit('rangeend');
        }
    }

    /** Whether the frame is on (or near) the screen; animation only runs where it can be seen. */
    setVisible(visible: boolean): void {
        this.visible = visible;

        if (visible) {
            this.sync(false);
            this.effects.invalidate();
        }

        this.updateLoop();
    }

    /** A duration known before the media knows its own (or without media at all), in seconds. */
    setDuration(seconds: number | null): void {
        this.hint = positive(seconds);
        this.applyPending();
        this.sync(true);
        this.updateAria();
        this.effects.invalidate();
    }

    /** Sets the position shown when no media is bound (a bound media decides on its own). */
    setProgress(ratio: number): void {
        if (this.media !== null) {
            return;
        }

        this.position = clamp01(ratio);
        this.updateAria();
        this.effects.invalidate();
    }

    seekTo(ratio: number): void {
        this.seek(ratio, 'api');
    }

    /** Returns whether the press starts a drag (the shell then captures the pointer). */
    pointerDown(ratio: number): boolean {
        if (!this.options.interact) {
            return false;
        }

        this.hoverAt(null);
        this.dragging = clamp01(ratio);
        this.updateAria();
        this.effects.invalidate();

        return true;
    }

    pointerMove(ratio: number): void {
        if (this.dragging === null) {
            return;
        }

        this.dragging = clamp01(ratio);
        this.updateAria();
        this.effects.invalidate();
    }

    /** Letting go seeks once, to where the pointer is. */
    pointerUp(ratio: number): void {
        if (this.dragging === null) {
            return;
        }

        this.dragging = null;
        this.seek(ratio, 'pointer');
    }

    /** The browser took the pointer (a scroll on a touch screen, say): nothing changes. */
    pointerCancel(): void {
        if (this.dragging === null) {
            return;
        }

        this.dragging = null;
        this.updateAria();
        this.effects.invalidate();
    }

    /** The mouse pointer moved over the frame (null: it left). Ignored while a drag shows its own position. */
    hoverAt(ratio: number | null): void {
        if (!this.options.interact || this.dragging !== null) {
            return;
        }

        const next = ratio === null ? null : clamp01(ratio);

        if (next === this.hovering) {
            return;
        }

        this.hovering = next;
        this.effects.invalidate();

        const duration = this.duration;
        this.effects.emit(
            'hover',
            next,
            next !== null && duration !== null ? next * duration : null,
        );
    }

    /** Returns whether the key was used (the shell then stops the page from scrolling). */
    key(key: string, modifiers: KeyModifiers = {}): boolean {
        if (!this.options.interact) {
            return false;
        }

        const action = keyAction(key, modifiers);

        if (action === null) {
            return false;
        }

        this.seek(
            action.kind === 'seek'
                ? action.ratio
                : stepRatio(
                      this.progress,
                      action.direction,
                      action.large,
                      this.duration,
                      this.options.stepSeconds,
                      this.options.largeStepRatio,
                  ),
            'keyboard',
        );

        return true;
    }

    /** Announces the slider values again (after the shell rewrote its attributes). */
    refresh(): void {
        this.announced = null;
        this.updateAria();
        this.effects.invalidate();
    }

    private seek(ratio: number, source: SeekSource): void {
        const target = clamp01(ratio);
        this.position = target;

        if (this.media !== null) {
            this.pending = target;
            this.applyPending();
        }

        this.updateAria();
        this.effects.invalidate();

        const duration = this.duration;

        // A seek out of the range being played abandons it (a seek to its start does not).
        if (this.range !== null && duration !== null) {
            const at = target * duration;

            if (at < this.range.start - 0.05 || at > this.range.end) {
                this.range = null;
            }
        }

        this.effects.emit('seek', {
            ratio: target,
            time: duration !== null ? target * duration : null,
            source,
        });
    }

    /** Seeks the media once it can; drops the wish if it never will (no duration at all). */
    private applyPending(): void {
        const media = this.media;

        if (
            media === null ||
            this.pending === null ||
            media.readyState < HAVE_METADATA
        ) {
            return;
        }

        const duration = this.duration;

        if (duration !== null) {
            media.currentTime = this.pending * duration;
        }

        this.pending = null;
    }

    private sync(report: boolean): void {
        const media = this.media;

        if (media === null) {
            return;
        }

        if (this.pending !== null) {
            this.position = this.pending;
        } else if (media.ended && this.options.rewindOnEnd) {
            this.position = 0;
        } else {
            const duration = this.duration;
            this.position =
                duration !== null ? clamp01(media.currentTime / duration) : 0;
        }

        if (report) {
            this.report();
            this.updateAria();
        }
    }

    private report(): void {
        const duration = this.duration;
        const time = duration !== null ? this.position * duration : null;

        if (time !== this.reported) {
            this.reported = time;
            this.effects.emit('timeupdate', time, this.position);
        }
    }

    private updateLoop(): void {
        const on = this.playing && this.visible;

        if (on !== this.looping) {
            this.looping = on;
            this.effects.loop(on);
        }
    }

    private updateAria(): void {
        const ratio = this.progress;
        const duration = this.duration;
        const time = duration !== null ? ratio * duration : null;
        const state: AriaState = {
            now: Math.round(ratio * 100),
            text: (this.options.valueText ?? defaultValueText)(
                time,
                ratio,
                duration,
            ),
        };

        if (
            this.announced === null ||
            this.announced.now !== state.now ||
            this.announced.text !== state.text
        ) {
            this.announced = state;
            this.effects.aria(state);
        }
    }
}
