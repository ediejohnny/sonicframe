/**
 * The media events a frame follows: playing, waiting, seeking, the time and the duration.
 */

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
