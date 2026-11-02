/**
 * What a player's parts read: the time as the look asks, the mold that keeps the time's room, the
 * precise clock the look may ask for, and the speed.
 */

import { decimalMark, type ClockFormat } from '../shared/clock';
import { formatPosition, formatTime } from '../shared/timing';
import type { PlayerLook } from './look';

/**
 * The time as the look asks: elapsed, remaining (with a minus), the duration, or both. The position
 * is a clock's (`formatPosition`): one a seek left a hair short of a second shows that second.
 */
export function timeText(
    format: PlayerLook['time'],
    time: number | null,
    duration: number | null,
): string {
    const now = time ?? 0;
    const total = duration ?? 0;

    switch (format) {
        case 'elapsed':
            return formatPosition(now, duration);
        case 'remaining':
            return `-${formatTime(Math.max(0, total - now))}`;
        case 'duration':
            return formatTime(total);
        default:
            return `${formatPosition(now, duration)} / ${formatTime(total)}`;
    }
}

/**
 * The longest text `timeText` shows for this sound, every digit a zero: laid under the time, it
 * keeps the room of the widest time, so the digits changing never move what sits beside it. The
 * longest is the duration, or the time already passed when that is longer (no duration yet).
 */
export function timeMold(
    format: PlayerLook['time'],
    time: number | null,
    duration: number | null,
): string {
    const longest = Math.max(time ?? 0, duration ?? 0);
    const text =
        format === 'remaining'
            ? timeText(format, 0, longest)
            : timeText(format, longest, longest);

    return text.replace(/\d/g, '0');
}

/**
 * The clock the look's time options ask for, its decimal mark from `locale` when `'auto'`; null for
 * the plain one (whole seconds, the hours from one hour on), which `timeText` writes.
 */
export function clockOf(look: PlayerLook, locale: string): ClockFormat | null {
    if (look.timePrecision === 'seconds' && look.timeHours === 'auto') {
        return null;
    }

    return {
        precision: look.timePrecision,
        fps: look.timeFps,
        hours: look.timeHours,
        decimal:
            look.timeDecimal === 'auto'
                ? decimalMark(locale)
                : look.timeDecimal,
    };
}

/** The speed after `rate`, wrapping around; the first one when `rate` is not in the list. */
export function nextSpeed(rate: number, list: readonly number[]): number {
    const at = list.findIndex((speed) => Math.abs(speed - rate) < 0.01);

    return list[at < 0 ? 0 : (at + 1) % list.length] ?? 1;
}

/** A speed in words: `1×`, `1.5×`. */
export function speedText(rate: number): string {
    return `${Number(rate.toFixed(2))}×`;
}
