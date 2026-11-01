/** What the recorder's screen takes and tells: its options, its parts in each state, and its events. */

import type { RecorderWords } from '../../core/languages/words';
import type { FontChoice } from '../../core/player/fonts';
import type { PlayerLook } from '../../core/player/look';
import type { PaletteChoice } from '../../core/player/palettes';
import type { ThemeInput } from '../../core/player/theme';
import type { RecorderState } from '../../core/recording/recording';
import type { BarStyle, WaveName, WaveStyle } from '../../types';
import type { RecorderUpload } from '../../core/recording/upload';
import type { Recording, RecorderOptions } from '../recorder/recorder';
import type { SendControl, UploadResponse } from '../upload/upload';
import type { RecorderScreen } from './recorder-screen';

/**
 * A piece of the screen: the buttons (`record`, `stop`, `pause` (it resumes while paused), `discard`,
 * `send`), the time recorded, the live `wave`, the `player` of the recording, the retro REC badge
 * (`rec`), and a `spacer` that pushes what follows to the end.
 */
export type RecorderPart =
    | 'record'
    | 'stop'
    | 'pause'
    | 'discard'
    | 'send'
    | 'time'
    | 'wave'
    | 'player'
    | 'rec'
    | 'spacer';

export const RECORDER_PARTS: readonly RecorderPart[] = Object.freeze([
    'record',
    'stop',
    'pause',
    'discard',
    'send',
    'time',
    'wave',
    'player',
    'rec',
    'spacer',
]);

/** A part's name in a stage's list: one of the screen's own, or the name of one of the app's `actions`. */
export type RecorderPartName = RecorderPart | (string & {});

/** The parts of each stage, in order: before recording, while recording, and in review. */
export type RecorderParts = {
    /** Before recording, and when it cannot (blocked microphone, say). */
    idle?: readonly RecorderPartName[];
    /** While recording or paused. */
    recording?: readonly RecorderPartName[];
    /** While the recording is heard and sent. */
    review?: readonly RecorderPartName[];
};

/**
 * One of the app's own buttons, shown where its name is listed in `parts`. Its name is lowercase
 * letters, digits and dashes, starting with a letter, and none of the screen's own parts.
 */
export type RecorderAction = {
    /** Its name for screen readers (up to 120 characters); its name in `actions` when empty. */
    label: string;
    /** Its icon: SVG path data on a 24 × 24 grid; a dot when missing or refused. */
    icon?: string;
    /** Filled like a stage's main button, and given the focus when it leads the stage. */
    main?: boolean;
    /** Called on a press with the recording in review (null when there is none) and the screen. */
    press: (recording: Recording | null, screen: RecorderScreen) => void;
};

export const DEFAULT_RECORDER_PARTS: Readonly<Required<RecorderParts>> =
    Object.freeze({
        idle: ['record'],
        recording: ['discard', 'time', 'wave', 'pause', 'stop'],
        review: ['discard', 'player', 'send'],
    });

/**
 * The parts of `stage` when the app gives none: the defaults, but while recording with the REC
 * style, the REC badge before the time (`'badge'`) or in its place, holding it (`'time'`).
 */
export function defaultParts(
    stage: keyof RecorderParts,
    style: RecordStyle,
    place: RecPlace,
): readonly RecorderPartName[] {
    if (stage !== 'recording' || style !== 'rec' || place === 'stop') {
        return DEFAULT_RECORDER_PARTS[stage];
    }

    return place === 'time'
        ? ['discard', 'rec', 'wave', 'pause', 'stop']
        : ['discard', 'rec', 'time', 'wave', 'pause', 'stop'];
}

/** The buttons whose icon the app may draw; `resume` is the pause button's while paused, `cancel` the send button's while it cancels. */
export type RecorderIcon =
    | 'record'
    | 'stop'
    | 'pause'
    | 'resume'
    | 'discard'
    | 'send'
    | 'cancel';

/** How the record button looks: the screen's dot, a red button, a microphone, or a retro REC badge. */
export type RecordStyle = 'dot' | 'red' | 'mic' | 'rec';

export const RECORD_STYLES: readonly RecordStyle[] = Object.freeze([
    'dot',
    'red',
    'mic',
    'rec',
]);

/** Where the REC mark shows while recording: a badge before the time, the stop button, or a badge holding the time. */
export type RecPlace = 'badge' | 'stop' | 'time';

export const REC_PLACES: readonly RecPlace[] = Object.freeze([
    'badge',
    'stop',
    'time',
]);

/** How the parts beside the player of the recording line up. */
export type RecorderAlign = 'bars' | 'center' | 'start' | 'end';

export const RECORDER_ALIGNS: readonly RecorderAlign[] = Object.freeze([
    'bars',
    'center',
    'start',
    'end',
]);

/** What the screen does when a recording stops. */
export type RecorderAfterStop = 'review' | 'send' | 'none';

export const RECORDER_AFTER_STOP: readonly RecorderAfterStop[] = Object.freeze([
    'review',
    'send',
    'none',
]);

export type RecorderScreenA11y = {
    /** The language of the screen's words and its player's: `'en'` by default, `'auto'` the page's. */
    lang?: string;
    /** Your own words, over the language's. */
    labels?: Partial<RecorderWords>;
    /** Says the time recorded every this many seconds while recording; 0 (the default) never. */
    announceEvery?: number;
};

export type RecorderScreenOptions = RecorderOptions & {
    /** The element the screen is added to. */
    container: HTMLElement;
    /** The parts of each stage. */
    parts?: RecorderParts;
    /** The app's own buttons, by name; each shows where its name is listed in `parts`. */
    actions?: Readonly<Record<string, RecorderAction>>;
    /** The live wave scrolls through the last seconds (`'scroll'`, the default) or fits the whole recording (`'fit'`). */
    live?: 'scroll' | 'fit';
    /** Seconds the scrolling wave shows: 10 by default, from 2 to 60. */
    window?: number;
    /** A theme, as the player takes it; it dresses the screen and the player of the recording. */
    theme?: string | ThemeInput;
    /** The screen's look, as the player's; laid over the theme's. */
    look?: Partial<PlayerLook>;
    /** The look of the player of the recording alone, laid over `look`; its rows under the wave start under its play button unless this says otherwise. */
    reviewLook?: Partial<PlayerLook>;
    /** How the record button looks: the screen's dot (`'dot'`, the default), a red button (`'red'`), a microphone (`'mic'`), or a retro REC badge (`'rec'`); your own `icons.record` is drawn in any of them. */
    recordStyle?: RecordStyle;
    /** The red of the `'red'` and `'rec'` styles, read as a color: `'#f44336'` by default. */
    recordColor?: string;
    /** With the REC style, where the REC mark shows while recording: a badge before the time (`'badge'`, the default), the stop button itself (`'stop'`), or a badge holding the time (`'time'`). */
    recPlace?: RecPlace;
    /** The REC dot blinks once a second while recording. Off by default; never with reduced motion; it holds still while the pointer is over or the focus is in the screen. */
    recordBlink?: boolean;
    /** Your own drawing of a button's icon: SVG path data on a 24 × 24 grid; data with anything but path commands and numbers is refused. */
    icons?: Partial<Record<RecorderIcon, string>>;
    /** How the parts beside the player of the recording line up: on its bars (`'bars'`, the default), or on its box's middle, top or bottom (`'center'`, `'start'`, `'end'`). */
    align?: RecorderAlign;
    palette?: PaletteChoice;
    /** How the live wave and the player draw the sound. */
    wave?: WaveName | Partial<WaveStyle>;
    bar?: Partial<BarStyle>;
    font?: FontChoice;
    /** When a recording stops: it goes to review (`'review'`, the default), is sent right away (`'send'`), or is only handed over, the screen starting again (`'none'`). */
    afterStop?: RecorderAfterStop;
    /** Called with every recording that stops, once the screen is in review or, with `afterStop: 'none'`, back at the start. */
    onRecorded?: (recording: Recording) => void;
    /**
     * Called with the recording when Send is pressed; a Promise keeps the screen busy until it
     * settles, and a rejection says the send failed. `control.signal` aborts when the send is
     * canceled or the screen destroyed, and `control.progress(fraction)` shows how far it got.
     */
    onSend?: (
        recording: Recording,
        control: Required<SendControl>,
    ) => void | Promise<void>;
    /** Sends to the app's own address when Send is pressed and there is no `onSend`. */
    upload?: RecorderUpload;
    /** While sending, the send button cancels the send (its signal aborts, the recording stays in review). Off by default. */
    cancelSend?: boolean;
    /** After a send: back to the start (`'reset'`, the default) or keep the recording (`'keep'`). */
    afterSend?: 'reset' | 'keep';
    /** Recording while the record button is held, stopping on release; a click still records. Off by default. */
    hold?: boolean;
    a11y?: RecorderScreenA11y;
};

export type RecorderScreenEvents = {
    /** The screen moved to another state. */
    state: [state: RecorderState];
    /** A recording stopped; `afterStop` says what comes next. */
    recorded: [recording: Recording];
    /** Send was pressed. */
    send: [recording: Recording];
    /** How far a send got, from 0 to 1. */
    progress: [fraction: number];
    /** The server's answer to an `upload`. */
    uploaded: [response: UploadResponse];
    /** The app's `onSend` settled without an error. */
    sent: [recording: Recording];
    /** Recording could not start or go on, or the app's `onSend` failed. */
    error: [error: unknown];
};
