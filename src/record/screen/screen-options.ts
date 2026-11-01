/** What the recorder's screen takes and tells: its options, its parts in each state, and its events. */

import type { RecorderWords } from '../../core/languages/words';
import type { FontChoice } from '../../core/player/fonts';
import type { PlayerLook } from '../../core/player/look';
import type { PaletteChoice } from '../../core/player/palettes';
import type { ThemeInput } from '../../core/player/theme';
import type { RecorderState } from '../../core/recording/recording';
import type { BarStyle, WaveName, WaveStyle } from '../../types';
import type { Recording, RecorderOptions } from '../recorder/recorder';

/**
 * A piece of the screen: the buttons (`record`, `stop`, `pause` (it resumes while paused), `discard`,
 * `send`), the time recorded, the live `wave`, the `player` of the recording, and a `spacer` that
 * pushes what follows to the end.
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
    'spacer',
]);

/** The parts of each stage, in order: before recording, while recording, and in review. */
export type RecorderParts = {
    /** Before recording, and when it cannot (blocked microphone, say). */
    idle?: readonly RecorderPart[];
    /** While recording or paused. */
    recording?: readonly RecorderPart[];
    /** While the recording is heard and sent. */
    review?: readonly RecorderPart[];
};

export const DEFAULT_RECORDER_PARTS: Readonly<Required<RecorderParts>> =
    Object.freeze({
        idle: ['record'],
        recording: ['discard', 'time', 'wave', 'pause', 'stop'],
        review: ['discard', 'player', 'send'],
    });

/** The buttons whose icon the app may draw; `resume` is the pause button's while paused. */
export type RecorderIcon =
    | 'record'
    | 'stop'
    | 'pause'
    | 'resume'
    | 'discard'
    | 'send';

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
    /** Called with the recording when Send is pressed; a Promise keeps the screen busy until it settles, and a rejection says the send failed. */
    onSend?: (recording: Recording) => void | Promise<void>;
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
    /** The app's `onSend` settled without an error. */
    sent: [recording: Recording];
    /** Recording could not start or go on, or the app's `onSend` failed. */
    error: [error: unknown];
};
