/**
 * `sonicframe/record`: recording from the microphone. `createRecorder` makes a ready-made screen
 * (record, hear, send), `<sonic-recorder>` is the same as a tag, and `Recorder` records without a
 * screen; the recording comes back with its length and its peaks, ready for a player. Kept apart
 * from the other entries, so an app that never records never loads it.
 */

export {
    Recorder,
    type Recording,
    type RecorderEvents,
    type RecorderOptions,
    type RecorderPhase,
} from './record/recorder/recorder';
export {
    RecordError,
    type RecordErrorReason,
} from './record/recorder/microphone';
export {
    DEFAULT_RECORD_TYPES,
    MAX_RECORDING_BYTES,
    RECORDER_STATES,
    type RecorderState,
} from './core/recording/recording';
export {
    createRecorder,
    RecorderScreen,
} from './record/screen/recorder-screen';
export {
    DEFAULT_RECORDER_PARTS,
    MIC_COLORS,
    MIC_STYLES,
    type MicColor,
    type MicStyle,
    REC_PLACES,
    RECORD_STYLES,
    type RecPlace,
    type RecordStyle,
    RECORDER_AFTER_SEND,
    RECORDER_AFTER_STOP,
    RECORDER_ALIGNS,
    RECORDER_ICONS,
    RECORDER_LIVE,
    RECORDER_PARTS,
    type RecorderAction,
    type RecorderAfterSend,
    type RecorderAfterStop,
    type RecorderAlign,
    type RecorderIcon,
    type RecorderLive,
    type RecorderPart,
    type RecorderPartName,
    type RecorderParts,
    type RecorderScreenA11y,
    type RecorderScreenEvents,
    type RecorderScreenOptions,
} from './record/screen/screen-options';
export {
    type SendControl,
    UploadError,
    type UploadResponse,
    uploadRecording,
} from './record/upload/upload';
export type { RecorderUpload } from './core/recording/upload';
export {
    defineSonicRecorder,
    RECORDER_ATTRIBUTES,
} from './record/element/recorder-element';
export type { RecorderWords } from './core/languages/words';
export type { LanguageTag } from './core/languages/language';
export type { LevelTrack } from './core/recording/levels';

// Names kept until 2.0: each works as before, and its note says what to use instead.

import {
    RECORDER_EVENTS as screenSteps,
    type RecorderEvent as ScreenStep,
} from './core/recording/recording';

/** @deprecated The steps of the screen's own state machine, not events; goes in 2.0. */
export const RECORDER_EVENTS: typeof screenSteps = screenSteps;

/** @deprecated The steps of the screen's own state machine, not events; goes in 2.0. */
export type RecorderEvent = ScreenStep;
