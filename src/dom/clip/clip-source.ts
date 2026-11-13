/**
 * The sound a clip is recorded from: a decoded buffer as it is, or a blob or an address read (capped)
 * and decoded. A source past the length limit is refused with both lengths named.
 */

import type { Limit } from '../../core/shared/limits';
import { fetchAudio } from '../audio/decode';

/**
 * The largest sound a clip is recorded from, and the largest clip, in bytes: 100 MiB, up to 1 GiB
 * (half the 2 GB a desktop Chrome keeps in memory for files).
 */
export const CLIP_BYTES: Limit = {
    value: 104_857_600,
    least: 1,
    most: 1_073_741_824,
    whole: true,
};

/** Whether the sound is already decoded (and needs neither a download nor a decode). */
export function isDecoded(
    audio: AudioBuffer | Blob | string,
): audio is AudioBuffer {
    return typeof audio !== 'string' && 'getChannelData' in audio;
}

/** A source past `maxSourceSeconds`; both lengths are named so the app can tell the listener. */
export function tooLong(seconds: number, limit: number): Error {
    return new Error(
        `sonicframe: the source is too long to record a clip from (${Math.round(seconds)} s, the limit is ${Math.round(limit)} s)`,
    );
}

/** The sound decoded in `context`; a download or a blob past `maxBytes` is refused. */
export async function toBuffer(
    context: AudioContext,
    audio: AudioBuffer | Blob | string,
    signal: AbortSignal | undefined,
    maxBytes: number = CLIP_BYTES.value,
): Promise<AudioBuffer> {
    if (isDecoded(audio)) {
        return audio;
    }

    let data: ArrayBuffer;

    if (typeof audio === 'string') {
        data = await fetchAudio(audio, maxBytes, signal);
    } else {
        if (audio.size > maxBytes) {
            throw new Error('sonicframe: audio is too large to record');
        }

        data = await audio.arrayBuffer();
    }

    return context.decodeAudioData(data);
}
