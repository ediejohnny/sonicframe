/**
 * A recorder's life, without the page: the states it goes through (idle, asking for the microphone,
 * recording, paused, review, sending, and the two ends where it cannot record: denied and error),
 * the event that takes it from one to the next, the audio formats it tries and how long it records.
 * An event that does not apply leaves the state as it is, so a late or doubled event changes nothing.
 */

import { within } from '../shared/checked';

export type RecorderState =
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
    | 'send'
    | 'sent'
    | 'keep'
    | 'discard'
    | 'reset';

export const RECORDER_STATES: readonly RecorderState[] = Object.freeze([
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
    'send',
    'sent',
    'keep',
    'discard',
    'reset',
]);

/** Where each event takes each state; an event left out keeps the state. */
const MOVES: Readonly<
    Record<RecorderState, Partial<Record<RecorderEvent, RecorderState>>>
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
        failed: 'error',
        discard: 'idle',
    },
    paused: {
        resume: 'recording',
        stop: 'review',
        failed: 'error',
        discard: 'idle',
    },
    review: { send: 'sending', discard: 'idle' },
    sending: { sent: 'idle', keep: 'review', failed: 'review' },
    denied: { start: 'asking', reset: 'idle' },
    error: { start: 'asking', reset: 'idle' },
};

/** The state `event` takes `state` to (the same state when the event does not apply). */
export function nextRecorderState(
    state: RecorderState,
    event: RecorderEvent,
): RecorderState {
    return MOVES[state][event] ?? state;
}

/** Audio formats to record, in order of preference: Opus in WebM, then MP4 (Safari), then Opus in Ogg. */
export const DEFAULT_RECORD_TYPES: readonly string[] = Object.freeze([
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg;codecs=opus',
]);

/** How long a recording runs before it stops on its own, in seconds: 300 by default, from 1 to 3600. */
export function recordSeconds(asked: unknown): number {
    return within(asked, 300, 1, 3600);
}
