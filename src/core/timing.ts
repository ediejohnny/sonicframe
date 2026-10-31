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

/** Steps in a second a time is kept to: microseconds. */
const STEPS_PER_SECOND = 1000000;

/**
 * The time at `ratio` of a `duration`-second sound, in seconds. The bare product carries float
 * noise (5 / 77 * 77 is 4.999…), so a time chosen as a whole second would show one second less;
 * kept to the microsecond, it comes back whole, and nothing heard or shown changes.
 */
export function timeAt(ratio: number, duration: number): number {
    return Math.round(ratio * duration * STEPS_PER_SECOND) / STEPS_PER_SECOND;
}

/** Starts fast and settles softly; `t` runs from 0 to 1. */
export function easeOut(t: number): number {
    return 1 - (1 - clamp01(t)) ** 3;
}

/** Seconds as `m:ss`, or `h:mm:ss` from one hour on; `decimals` adds fractional seconds. */
export function formatTime(seconds: number, decimals: number = 0): string {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const whole = Math.floor(safe);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest =
        decimals > 0
            ? (safe % 60).toFixed(decimals).padStart(decimals + 3, '0')
            : String(whole % 60).padStart(2, '0');

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
