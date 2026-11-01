/**
 * The microphone, opened only when asked, and why recording cannot happen when it cannot: a page
 * without HTTPS, a browser without a recorder, a microphone blocked or missing. Each reason is a word
 * an app (or the recorder's screen) turns into its own message.
 */

/** Why recording could not start, or stopped. */
export type RecordErrorReason =
    | 'denied'
    | 'missing'
    | 'insecure'
    | 'unsupported'
    | 'failed'
    | 'too-large';

const MESSAGES: Readonly<Record<RecordErrorReason, string>> = {
    denied: 'the microphone was blocked',
    missing: 'no microphone was found',
    insecure: 'recording needs a secure page (HTTPS)',
    unsupported: 'this browser cannot record',
    failed: 'recording failed',
    'too-large': 'the recording grew past its size cap',
};

/** A recording that could not start or go on, with its reason. */
export class RecordError extends Error {
    readonly reason: RecordErrorReason;

    constructor(reason: RecordErrorReason) {
        super(`sonicframe: ${MESSAGES[reason]}`);
        this.name = 'RecordError';
        this.reason = reason;
    }
}

/** Echo, noise and gain control on, so a voice reads clearly; the app's own choices go over them. */
const VOICE: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

/** Why this page cannot record, or null when it can (before anything is asked). */
export function cannotRecord(): RecordError | null {
    if (window.isSecureContext === false) {
        return new RecordError('insecure');
    }

    if (
        typeof MediaRecorder === 'undefined' ||
        typeof navigator.mediaDevices?.getUserMedia !== 'function'
    ) {
        return new RecordError('unsupported');
    }

    return null;
}

/** The microphone's stream; a refusal becomes a `RecordError` that says why. */
export async function openMicrophone(
    constraints: MediaTrackConstraints | undefined,
): Promise<MediaStream> {
    try {
        return await navigator.mediaDevices.getUserMedia({
            audio: { ...VOICE, ...constraints },
        });
    } catch (error) {
        const name = error instanceof DOMException ? error.name : '';

        if (name === 'NotAllowedError' || name === 'SecurityError') {
            throw new RecordError('denied');
        }

        throw new RecordError(
            name === 'NotFoundError' || name === 'OverconstrainedError'
                ? 'missing'
                : 'failed',
        );
    }
}

/** Stops every track of `stream`, so the browser's microphone light goes out. */
export function closeMicrophone(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
        track.stop();
    }
}
