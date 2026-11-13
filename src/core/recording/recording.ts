/**
 * A recorder's life, without the page: the states it goes through (idle, asking for the microphone,
 * recording, paused, review, sending, and the two ends where it cannot record: denied and error),
 * the event that takes it from one to the next (a recording stops into review, or finishes straight
 * back to idle when it is only handed over), the audio formats it tries and how long it records.
 * An event that does not apply leaves the state as it is, so a late or doubled event changes nothing.
 */

import { within } from '../shared/checked';
import type { Limit } from '../shared/limits';

/** Where the recorder's screen is (the `Recorder` without a screen has its own `RecorderPhase`). */
export type RecorderScreenState =
    | 'idle'
    | 'asking'
    | 'recording'
    | 'paused'
    | 'review'
    | 'sending'
    | 'denied'
    | 'error';

export type RecorderEvent =
    | 'start'
    | 'granted'
    | 'denied'
    | 'failed'
    | 'pause'
    | 'resume'
    | 'stop'
    | 'finish'
    | 'send'
    | 'sent'
    | 'keep'
    | 'cancel'
    | 'discard'
    | 'reset';

export const RECORDER_SCREEN_STATES: readonly RecorderScreenState[] =
    Object.freeze([
        'idle',
        'asking',
        'recording',
        'paused',
        'review',
        'sending',
        'denied',
        'error',
    ]);

export const RECORDER_EVENTS: readonly RecorderEvent[] = Object.freeze([
    'start',
    'granted',
    'denied',
    'failed',
    'pause',
    'resume',
    'stop',
    'finish',
    'send',
    'sent',
    'keep',
    'cancel',
    'discard',
    'reset',
]);

/** Where each event takes each state; an event left out keeps the state. */
const MOVES: Readonly<
    Record<
        RecorderScreenState,
        Partial<Record<RecorderEvent, RecorderScreenState>>
    >
> = {
    idle: { start: 'asking' },
    asking: {
        granted: 'recording',
        denied: 'denied',
        failed: 'error',
        discard: 'idle',
    },
    recording: {
        pause: 'paused',
        stop: 'review',
        finish: 'idle',
        failed: 'error',
        discard: 'idle',
    },
    paused: {
        resume: 'recording',
        stop: 'review',
        finish: 'idle',
        failed: 'error',
        discard: 'idle',
    },
    review: { send: 'sending', discard: 'idle' },
    sending: {
        sent: 'idle',
        keep: 'review',
        failed: 'review',
        cancel: 'review',
    },
    denied: { start: 'asking', reset: 'idle' },
    error: { start: 'asking', reset: 'idle' },
};

/** The state `event` takes `state` to (the same state when the event does not apply). */
export function nextRecorderState(
    state: RecorderScreenState,
    event: RecorderEvent,
): RecorderScreenState {
    return MOVES[state][event] ?? state;
}

/** Audio formats to record, in order of preference: Opus in WebM, then MP4 (Safari), then Opus in Ogg. */
export const DEFAULT_RECORD_TYPES: readonly string[] = Object.freeze([
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg;codecs=opus',
]);

/**
 * The largest recording kept, in bytes; past it, recording stops with an error: 100 MiB, up to 1 GiB
 * (half the 2 GB a desktop Chrome keeps in memory for files; a phone keeps far less).
 */
export const RECORDING_BYTES: Limit = {
    value: 104_857_600,
    least: 1,
    most: 1_073_741_824,
    whole: true,
};

/** The default of `RECORDING_BYTES`. */
export const MAX_RECORDING_BYTES: number = RECORDING_BYTES.value;

/**
 * How long a recording runs before it stops on its own, in seconds: 300, from 1 to 21 600 (6 hours,
 * as long as the best known online recorders take). A tag keeps to 3600, as it always did.
 */
export const RECORDING_SECONDS: Limit = {
    value: 300,
    least: 1,
    most: 21_600,
    whole: false,
};

/** The most a tag's time limit may be, in seconds; longer is for an app's code. */
export const TAG_RECORDING_SECONDS = 3600;

/**
 * A recording's time limit, kept from 1 to 21 600 seconds: it shipped taking any number, so past its
 * ends it is kept at them until 2.0 instead of refused.
 */
export function recordSeconds(asked: unknown): number {
    const { value, least, most } = RECORDING_SECONDS;

    return within(asked, value, least, most);
}
