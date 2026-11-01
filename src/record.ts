/**
 * `sonicframe/record`: recording from the microphone. `Recorder` records without a screen; the
 * recording comes back with its length and its peaks, ready for a player. Kept apart from the other
 * entries, so an app that never records never loads it.
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
} from './core/recording/recording';
