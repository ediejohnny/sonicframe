/**
 * Why a sound could not load, from the media element's `MediaError.code`, and the error the player
 * hands its `error` listeners. Pure: the words are the player's own, never the browser's message.
 */

/** Why the sound could not load. */
export type SoundErrorReason = 'aborted' | 'network' | 'decode' | 'unsupported';

/** The reasons in the order of `MediaError`'s codes, 1 to 4. */
const BY_CODE: readonly SoundErrorReason[] = [
    'aborted',
    'network',
    'decode',
    'unsupported',
];

/** The reason for a `MediaError.code`; any other value counts as the network's. */
export function soundErrorReason(code: unknown): SoundErrorReason {
    return typeof code === 'number' && Number.isInteger(code) && code >= 1
        ? (BY_CODE[code - 1] ?? 'network')
        : 'network';
}

/** The player's label that says each reason. */
export const SOUND_ERROR_LABELS: Readonly<
    Record<
        SoundErrorReason,
        'soundAborted' | 'soundFailed' | 'soundDecode' | 'soundUnsupported'
    >
> = Object.freeze({
    aborted: 'soundAborted',
    network: 'soundFailed',
    decode: 'soundDecode',
    unsupported: 'soundUnsupported',
});

/** The sound of a player could not load: `reason` says why. */
export class SoundError extends Error {
    readonly reason: SoundErrorReason;

    constructor(reason: SoundErrorReason) {
        super(`sonicframe: the sound could not load (${reason})`);
        this.name = 'SoundError';
        this.reason = reason;
    }
}
