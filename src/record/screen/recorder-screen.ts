/**
 * The recorder's ready-made screen, in one box dressed like a player: a record button until pressed;
 * while recording, the time, a live wave and the buttons to pause, stop and drop it; then a player of
 * the recording, to hear it before sending it to the app (`onSend`). Each stage shows the parts it is
 * given (`screen-parts`), a line under them shows what went wrong or what is under way, and every
 * change is said through the page's live region. The focus follows each stage's main button, and the
 * recording's object address is given back whenever the recording goes. The screen holds its state
 * and its actions; what runs while recording is `LiveView`, the player of the recording `ReviewPlayer`.
 * It stays one file: every action moves the state and draws it again, so split further, that state
 * would only be handed around.
 */

import type { PlayerLook } from '../../core/player/look';
import {
    defineTheme,
    findTheme,
    themeParts,
    type ThemeParts,
} from '../../core/player/theme';
import {
    recorderWords,
    type RecorderSay,
} from '../../core/recording/recorder-words';
import {
    nextRecorderState,
    type RecorderEvent,
    type RecorderState,
} from '../../core/recording/recording';
import { Emitter } from '../../core/shared/emitter';
import { formatTime } from '../../core/shared/timing';
import { MUTED } from '../../core/shared/variables';
import { announce } from '../../dom/a11y/announce';
import { pageLanguage } from '../../dom/a11y/page-language';
import { css } from '../../dom/shared/css';
import { useFont } from '../../dom/shared/fonts';
import type { Player } from '../../player/player/player';
import {
    finishBox,
    followPalette,
    wearPalette,
} from '../../player/player/player-paint';
import { RecordError, type RecordErrorReason } from '../recorder/microphone';
import { Recorder, type Recording } from '../recorder/recorder';
import { LiveView } from './live-view';
import { ReviewPlayer } from './review-player';
import {
    DEFAULT_RECORDER_PARTS,
    type RecorderScreenEvents,
    type RecorderScreenOptions,
} from './screen-options';
import { mainButton, screenPart, type PartHost } from './screen-parts';

/** The words that say why recording cannot happen, by reason. */
const REASONS = {
    denied: 'denied',
    missing: 'missing',
    insecure: 'insecure',
    unsupported: 'unsupported',
    failed: 'failed',
    'too-large': 'tooLarge',
} as const satisfies Record<RecordErrorReason, string>;

export class RecorderScreen {
    readonly element: HTMLDivElement;
    /** The recording engine under the screen. */
    readonly recorder: Recorder;
    private readonly options: RecorderScreenOptions;
    private readonly events = new Emitter<RecorderScreenEvents>();
    private readonly words: RecorderSay;
    private readonly parts: ThemeParts;
    private readonly row: HTMLDivElement;
    private readonly status: HTMLDivElement;
    private readonly live: LiveView;
    private readonly host: PartHost;
    private stateRef: RecorderState = 'idle';
    private recordingRef: Recording | null = null;
    private address: string | null = null;
    private reviewRef: ReviewPlayer | null = null;
    private frame = 0;
    private limited = false;
    private stopScheme: () => void = () => undefined;
    private destroyed = false;

    constructor(options: RecorderScreenOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.options = options;
        const a11y = options.a11y ?? {};
        this.words = recorderWords(
            a11y.lang === 'auto' ? pageLanguage(options.container) : a11y.lang,
            a11y.labels,
        );
        const theme =
            options.theme === undefined
                ? null
                : typeof options.theme === 'string'
                  ? findTheme(options.theme)
                  : defineTheme(options.theme);
        this.parts = themeParts(theme, options);
        this.recorder = new Recorder(options);
        this.live = new LiveView(this.parts, options, this.words);
        this.host = {
            look: this.look,
            words: this.words.words,
            hold: options.hold === true,
            live: this.live,
            state: () => this.stateRef,
            seconds: () => this.recorder.seconds,
            review: () => this.reviewPart(),
            start: () => void this.start(),
            stop: () => void this.stop(),
            pause: () => this.pause(),
            resume: () => this.resume(),
            discard: () => this.discard(),
            send: () => void this.send(),
        };

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-recorder';
        this.element.setAttribute('role', 'group');
        this.element.setAttribute('aria-label', this.words.words.recorder);

        if (a11y.lang !== undefined) {
            this.element.setAttribute('lang', this.words.locale);
        }

        this.row = document.createElement('div');
        this.row.className = 'sonicframe-recorder-row';
        this.status = document.createElement('div');
        this.status.className = 'sonicframe-recorder-status';
        this.status.hidden = true;
        css(this.row, [
            ['display', 'flex'],
            ['align-items', 'center'],
            ['gap', `${this.look.gap}rem`],
            ['min-width', '0'],
        ]);
        css(this.status, [
            ['color', MUTED],
            ['font-size', '0.85em'],
        ]);
        this.element.append(this.row, this.status);
        this.dress();
        options.container.append(this.element);

        this.recorder.on('limit', () => {
            this.limited = true;
        });
        this.recorder.on('stop', (recording) => this.review(recording));
        this.recorder.on('error', (error) => this.cannot(error));
        this.render();
    }

    get state(): RecorderState {
        return this.stateRef;
    }

    /** The recording in review, or null. */
    get recording(): Recording | null {
        return this.recordingRef;
    }

    /** The player of the recording in review, or null. */
    get player(): Player | null {
        return this.reviewRef?.player ?? null;
    }

    on<Name extends keyof RecorderScreenEvents>(
        event: Name,
        listener: (...args: RecorderScreenEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /** Asks for the microphone and records; a refusal is shown and said. */
    async start(): Promise<void> {
        if (!this.move('start')) {
            return;
        }

        this.say(this.words.words.asking, true);

        try {
            await this.recorder.start();
        } catch (error) {
            this.cannot(error);

            return;
        }

        if (this.recorder.state === 'recording' && this.move('granted')) {
            this.live.begin();
            this.limited = false;
            this.say(this.words.words.recording);
            this.tick();
        }
    }

    pause(): void {
        if (this.move('pause')) {
            this.recorder.pause();
            this.say(this.words.words.paused);
        }
    }

    resume(): void {
        if (this.move('resume')) {
            this.recorder.resume();
            this.say(this.words.words.recording);
            this.tick();
        }
    }

    /** Stops recording; the recording goes to review. */
    async stop(): Promise<void> {
        await this.recorder.stop().catch(() => undefined);
    }

    /** Drops the recording under way or in review. */
    discard(): void {
        if (this.move('discard')) {
            this.recorder.cancel();
            this.forget();
            this.say(this.words.words.deleted);
        }
    }

    /** Hands the recording in review to the app's `onSend`. */
    async send(): Promise<void> {
        const recording = this.recordingRef;

        if (recording === null || !this.move('send')) {
            return;
        }

        this.say(this.words.words.sending, true);
        this.events.emit('send', recording);

        try {
            await this.options.onSend?.(recording);
        } catch (error) {
            // Destroyed meanwhile, the screen has nothing left to say.
            if (this.move('failed')) {
                this.say(this.words.words.sendFailed, true);
                this.events.emit('error', error);
            }

            return;
        }

        if (this.destroyed) {
            return;
        }

        if (this.options.afterSend === 'keep') {
            this.move('keep');
        } else if (this.move('sent')) {
            this.forget();
        }

        this.say(this.words.words.sent);
        this.events.emit('sent', recording);
    }

    /** Takes the screen off the page, letting the microphone and the recording go. */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        cancelAnimationFrame(this.frame);
        this.recorder.destroy();
        this.forget();
        this.live.release();
        this.stopScheme();
        this.element.remove();
        this.events.clear();
    }

    private get look(): PlayerLook {
        return this.parts.look;
    }

    /** The box, the palette (following the system for `'auto'`) and the font. */
    private dress(): void {
        const look = { ...this.look, background: null };
        this.stopScheme = followPalette(this.parts.palette, (palette) => {
            finishBox(this.element, look, wearPalette(this.element, palette));
        });
        useFont(this.element, this.options.font, this.look.font, (error) =>
            this.events.emit('error', error),
        );
    }

    /** Takes `event`; false when it does not apply. The screen is drawn again on a change. */
    private move(event: RecorderEvent): boolean {
        const next = nextRecorderState(this.stateRef, event);

        if (this.destroyed || next === this.stateRef) {
            return false;
        }

        this.stateRef = next;
        this.render();
        this.events.emit('state', next);

        return true;
    }

    /** A recording came back (stopped, or at its limit): it goes to review. */
    private review(recording: Recording): void {
        cancelAnimationFrame(this.frame);

        if (
            this.destroyed ||
            nextRecorderState(this.stateRef, 'stop') !== 'review'
        ) {
            return;
        }

        // Ready before the move: the review's player plays it.
        this.recordingRef = recording;
        this.address = URL.createObjectURL(recording.blob);
        this.move('stop');

        const stopped = this.words.say('stopped', {
            time: formatTime(recording.duration),
        });
        this.say(
            this.limited ? `${this.words.words.limit}. ${stopped}` : stopped,
        );
        this.events.emit('recorded', recording);
    }

    /** Recording could not start or go on: the screen says why. */
    private cannot(error: unknown): void {
        cancelAnimationFrame(this.frame);
        const reason = error instanceof RecordError ? error.reason : 'failed';

        if (this.move(reason === 'denied' ? 'denied' : 'failed')) {
            this.say(this.words.words[REASONS[reason]], true);
        }

        this.events.emit('error', error);
    }

    /** Lets the recording in review go: its player and its object address. */
    private forget(): void {
        this.recordingRef = null;
        this.reviewRef?.destroy();
        this.reviewRef = null;

        if (this.address !== null) {
            URL.revokeObjectURL(this.address);
            this.address = null;
        }

        this.render();
    }

    /** Says `text` through the live region; `show` also writes it under the parts. */
    private say(text: string, show = false): void {
        announce(text);
        this.status.textContent = show ? text : '';
        this.status.hidden = !show;
    }

    /** While recording, a frame at a time: the time, the live wave and the time said when asked. */
    private readonly tick = (): void => {
        cancelAnimationFrame(this.frame);

        if (this.stateRef === 'recording') {
            this.live.show(this.recorder.seconds, this.recorder.levels);
            this.frame = requestAnimationFrame(this.tick);
        }
    };

    /** The player of the recording in review, made once per recording. */
    private reviewPart(): HTMLElement | null {
        if (this.recordingRef === null || this.address === null) {
            return null;
        }

        this.reviewRef ??= new ReviewPlayer(
            this.options,
            this.words.words.review,
            this.recordingRef,
            this.address,
        );

        return this.reviewRef.element;
    }

    /** The parts of the stage the screen is in, with the focus kept on the stage's main button. */
    private render(): void {
        const focused = this.element.contains(document.activeElement);
        const stage = this.stage();
        const list =
            this.options.parts?.[stage] ?? DEFAULT_RECORDER_PARTS[stage];

        this.row.replaceChildren();
        this.live.clear(stage === 'recording');

        for (const part of list) {
            const node = screenPart(part, this.host);

            if (node !== null) {
                this.row.append(node);
            }
        }

        if (focused) {
            mainButton(this.row)?.focus();
        }
    }

    /** Which list of parts the state shows. */
    private stage(): 'idle' | 'recording' | 'review' {
        switch (this.stateRef) {
            case 'recording':
            case 'paused':
                return 'recording';
            case 'review':
            case 'sending':
                return 'review';
            default:
                return 'idle';
        }
    }
}

/** Makes a recorder screen inside `options.container`. */
export function createRecorder(options: RecorderScreenOptions): RecorderScreen {
    return new RecorderScreen(options);
}
