/**
 * A precise clock: the time with tenths, hundredths or milliseconds, or with the frame of a
 * timecode, the hours and the decimal mark as asked. Every reading is a whole number of steps (a
 * hundredth, a frame), so the time played and the time left always add up to the length shown.
 */

import { LANDING } from './steps';

/** What a clock shows after the seconds: nothing, tenths, hundredths, milliseconds, or the frame. */
export type ClockPrecision =
    | 'seconds'
    | 'tenths'
    | 'hundredths'
    | 'milliseconds'
    | 'frames';

/** The hours: from one hour on (`'auto'`), always (`0:01:05`), or always in two digits (`00:01:05`). */
export type ClockHours = 'auto' | 'always' | 'padded';

/** How a clock writes a time. */
export type ClockFormat = {
    precision: ClockPrecision;
    /** Frames in a second, with `'frames'`; 29.97 counts 30 frames in each second. */
    fps: number;
    hours: ClockHours;
    /** The mark before tenths, hundredths and milliseconds. */
    decimal: '.' | ',';
};

/** What a time part reads: the time played, the time left, the length, or the first two. */
export type ClockForm = 'elapsed' | 'remaining' | 'duration' | 'both';

export const CLOCK_PRECISIONS: readonly ClockPrecision[] = Object.freeze([
    'seconds',
    'tenths',
    'hundredths',
    'milliseconds',
    'frames',
] as const);

export const CLOCK_HOURS: readonly ClockHours[] = Object.freeze([
    'auto',
    'always',
    'padded',
] as const);

/** Steps in a second and the digits they take, for the clocks that count in decimals. */
const DECIMALS = {
    tenths: { unit: 10, digits: 1, step: 0.1 },
    hundredths: { unit: 100, digits: 2, step: 0.01 },
    milliseconds: { unit: 1000, digits: 3, step: 0.001 },
} as const;

/** In seconds: the float noise a reading ignores (3 frames at 30 per second is 0.0999…, still frame 3). */
const NOISE = 0.000001;

/** A time to read: never below zero, and zero when it is not a number. */
function safe(seconds: number): number {
    return Math.max(0, Number.isFinite(seconds) ? seconds : 0);
}

/** The steps every second holds: 1, 10, 100, 1000, or every frame a second can start (30 at 29.97). */
function slotsOf(clock: ClockFormat): number {
    switch (clock.precision) {
        case 'seconds':
            return 1;
        case 'frames':
            return Math.ceil(clock.fps);
        default:
            return DECIMALS[clock.precision].unit;
    }
}

/** The frame of its second a time is in, and the whole seconds before it. */
function frameAt(
    time: number,
    clock: ClockFormat,
): { whole: number; frame: number } {
    const whole = Math.floor(time + NOISE);
    const frame = Math.floor((time - whole) * clock.fps + NOISE);

    return {
        whole,
        frame: Math.min(slotsOf(clock) - 1, Math.max(0, frame)),
    };
}

/**
 * A time as steps of the clock: whole seconds cut, decimals rounded to the nearest (59.996 s in
 * hundredths is a whole minute), and frames cut, as the frame the sound is in.
 */
function stepsAt(seconds: number, clock: ClockFormat): number {
    const time = safe(seconds);

    switch (clock.precision) {
        case 'seconds':
            return Math.floor(time + NOISE);
        case 'frames': {
            const { whole, frame } = frameAt(time, clock);

            return whole * slotsOf(clock) + frame;
        }
        default:
            return Math.round(
                Number((time * DECIMALS[clock.precision].unit).toFixed(6)),
            );
    }
}

function two(value: number): string {
    return String(value).padStart(2, '0');
}

/** Steps of the clock written out: `m:ss`, with the hours as the clock asks, then the decimals or the frame. */
function write(steps: number, clock: ClockFormat): string {
    const slots = slotsOf(clock);
    const whole = Math.floor(steps / slots);
    const part = steps - whole * slots;
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const lead =
        clock.hours === 'padded'
            ? `${two(hours)}:${two(minutes)}`
            : clock.hours === 'always' || hours > 0
              ? `${hours}:${two(minutes)}`
              : String(minutes);
    const tail =
        clock.precision === 'seconds'
            ? ''
            : clock.precision === 'frames'
              ? `:${String(part).padStart(slots > 100 ? 3 : 2, '0')}`
              : `${clock.decimal}${String(part).padStart(DECIMALS[clock.precision].digits, '0')}`;

    return `${lead}:${two(whole % 60)}${tail}`;
}

/** A time in seconds, as the clock writes it (`1:05.25`, `1:05:12`). */
export function formatClock(seconds: number, clock: ClockFormat): string {
    return write(stepsAt(seconds, clock), clock);
}

/**
 * What a time part reads with this clock. The time played never passes the length; whole seconds
 * read `LANDING` ahead, as the plain clock does (a seek lands a hair short of the second asked for).
 * The time left is the length less the time played, in steps, as a timecode subtracts.
 */
export function clockText(
    form: ClockForm,
    time: number | null,
    duration: number | null,
    clock: ClockFormat,
): string {
    const total = stepsAt(duration ?? 0, clock);
    const nudge = clock.precision === 'seconds' ? LANDING : 0;
    const played = stepsAt((time ?? 0) + nudge, clock);
    const now =
        duration !== null && played > total
            ? Math.max(stepsAt(time ?? 0, clock), total)
            : played;

    switch (form) {
        case 'elapsed':
            return write(now, clock);
        case 'remaining':
            return `-${write(Math.max(0, total - now), clock)}`;
        case 'duration':
            return write(total, clock);
        default:
            return `${write(now, clock)} / ${write(total, clock)}`;
    }
}

/**
 * The longest text `clockText` shows for this sound, every digit a zero: laid under the time, it
 * keeps the room of the widest time, so the digits changing never move what sits beside it.
 */
export function clockMold(
    form: ClockForm,
    time: number | null,
    duration: number | null,
    clock: ClockFormat,
): string {
    const longest = Math.max(time ?? 0, duration ?? 0);
    const text =
        form === 'remaining'
            ? clockText(form, 0, longest, clock)
            : clockText(form, longest, longest, clock);

    return text.replace(/\d/g, '0');
}

/** How long one step of the clock lasts, in seconds: a second, a tenth, a hundredth, a millisecond, a frame. */
export function clockStep(clock: ClockFormat): number {
    switch (clock.precision) {
        case 'seconds':
            return 1;
        case 'frames':
            return 1 / clock.fps;
        default:
            return DECIMALS[clock.precision].step;
    }
}

/**
 * Seconds of playing at `rate` until the time played reads differently: the next step's start
 * (half a step on, for decimals rounded to the nearest). Null while the sound does not move forward.
 */
export function nextClockChange(
    time: number,
    clock: ClockFormat,
    rate: number,
): number | null {
    if (!Number.isFinite(rate) || rate <= 0) {
        return null;
    }

    const now = safe(time);
    let next: number;

    switch (clock.precision) {
        case 'seconds':
            next = Math.floor(now + LANDING + NOISE) + 1 - LANDING;
            break;
        case 'frames': {
            const { whole, frame } = frameAt(now, clock);
            next =
                frame + 1 < slotsOf(clock)
                    ? whole + (frame + 1) / clock.fps
                    : whole + 1;
            break;
        }
        default: {
            const { unit } = DECIMALS[clock.precision];
            next = (stepsAt(now, clock) + 0.5) / unit;
        }
    }

    const wait = next - now;

    return (wait > 0 ? wait : clockStep(clock)) / rate;
}

/** The mark a language writes before decimals (`,` in pt-BR), a point when the language is unknown. */
export function decimalMark(locale: string): '.' | ',' {
    try {
        const mark = new Intl.NumberFormat(locale)
            .formatToParts(1.5)
            .find((part) => part.type === 'decimal');

        return mark?.value === ',' ? ',' : '.';
    } catch {
        return '.';
    }
}
