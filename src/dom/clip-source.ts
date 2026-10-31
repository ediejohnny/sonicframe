/**
 * The sound a clip is recorded from: a decoded buffer as it is, or a blob or an address read (capped)
 * and decoded. A source past the length limit is refused with both lengths named.
 */

import { fetchAudio } from './decode';

/** The largest sound a clip is recorded from, and the largest clip, in bytes (100 MiB). */
export const MAX_BYTES = 104_857_600;

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

/** The sound decoded in `context`; a download or a blob past `MAX_BYTES` is refused. */
export async function toBuffer(
    context: AudioContext,
    audio: AudioBuffer | Blob | string,
    signal: AbortSignal | undefined,
): Promise<AudioBuffer> {
    if (isDecoded(audio)) {
        return audio;
    }

    let data: ArrayBuffer;

    if (typeof audio === 'string') {
        data = await fetchAudio(audio, MAX_BYTES, signal);
    } else {
        if (audio.size > MAX_BYTES) {
            throw new Error('sonicframe: audio is too large to record');
        }

        data = await audio.arrayBuffer();
    }

    return context.decodeAudioData(data);
}
