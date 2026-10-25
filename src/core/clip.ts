/**
 * The pure parts of exporting a clip: choosing a container/codec the browser can record, and
 * clamping the time range to a safe length. The recording itself (canvas + MediaRecorder) lives in
 * the DOM layer; this is tested in Node.
 */

/** Container/codec candidates, in order of preference (MP4/H.264 first, then WebM). */
export const DEFAULT_CLIP_TYPES: readonly string[] = [
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
];

/** The longest clip, in seconds. */
export const MAX_CLIP_SECONDS = 120;

/** The first candidate the browser says it can record, or null. */
export function pickMimeType(
    candidates: readonly string[],
    isSupported: (type: string) => boolean,
): string | null {
    for (const candidate of candidates) {
        if (isSupported(candidate)) {
            return candidate;
        }
    }

    return null;
}

/** Orders and clamps the range to the sound and to `maxSeconds`. */
export function clipPlan(
    start: number,
    end: number,
    duration: number,
    maxSeconds: number = MAX_CLIP_SECONDS,
): { start: number; end: number; seconds: number } {
    const from = Math.max(0, Math.min(Math.min(start, end), duration));
    const limit = Math.min(duration, from + Math.max(0, maxSeconds));
    const to = Math.max(from, Math.min(Math.max(start, end), limit));

    return { start: from, end: to, seconds: to - from };
}
