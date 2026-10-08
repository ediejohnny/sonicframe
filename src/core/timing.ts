import { clamp01, positive } from './math';

/**
 * The duration to use, in seconds: the media's own once it knows a real one, otherwise the hint the
 * app gave. A media element reports NaN before its metadata loads (`preload="none"`) and Infinity for
 * many recordings made in the browser; neither is a duration.
 */
export function effectiveDuration(
    media: number | null | undefined,
    hint: number | null | undefined,
): number | null {
    return positive(media) ?? positive(hint);
}

/**
 * The position one step away. A step is `stepSeconds`, or 5 % of the sound while its duration is
 * unknown; a large step (Page Up / Page Down) is `largeRatio` of the sound.
 */
export function stepRatio(
    ratio: number,
    direction: -1 | 1,
    large: boolean,
    duration: number | null,
    stepSeconds: number,
    largeRatio: number,
): number {
    const known = positive(duration);
    const delta = large
        ? largeRatio
        : known !== null && stepSeconds > 0
          ? stepSeconds / known
          : 0.05;

    return clamp01(ratio + direction * delta);
}

/** Starts fast and settles softly; `t` runs from 0 to 1. */
export function easeOut(t: number): number {
    return 1 - (1 - clamp01(t)) ** 3;
}

/** Seconds as `m:ss`, or `h:mm:ss` from one hour on. */
export function formatTime(seconds: number): string {
    const total = Math.max(
        0,
        Math.floor(Number.isFinite(seconds) ? seconds : 0),
    );
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = String(total % 60).padStart(2, '0');

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
        : `${minutes}:${rest}`;
}

/** What a screen reader announces for the position: `0:12 / 0:45`, or a percentage without a duration. */
export function defaultValueText(
    time: number | null,
    ratio: number,
    duration: number | null,
): string {
    return time !== null && duration !== null
        ? `${formatTime(time)} / ${formatTime(duration)}`
        : `${Math.round(clamp01(ratio) * 100)}%`;
}
