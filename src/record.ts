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
    RECORDER_EVENTS,
    RECORDER_STATES,
    type RecorderEvent,
    type RecorderState,
} from './core/recording/recording';
export {
    createRecorder,
    RecorderScreen,
} from './record/screen/recorder-screen';
export {
    DEFAULT_RECORDER_PARTS,
    RECORDER_AFTER_STOP,
    RECORDER_ALIGNS,
    RECORDER_PARTS,
    type RecorderAfterStop,
    type RecorderAlign,
    type RecorderIcon,
    type RecorderPart,
    type RecorderParts,
    type RecorderScreenA11y,
    type RecorderScreenEvents,
    type RecorderScreenOptions,
} from './record/screen/screen-options';
export {
    defineSonicRecorder,
    RECORDER_ATTRIBUTES,
} from './record/element/recorder-element';
export type { RecorderWords } from './core/languages/words';
