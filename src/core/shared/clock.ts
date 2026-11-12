/**
 * A precise clock: the time with tenths, hundredths or milliseconds, or with the frame of a
 * timecode, its hours, least digits and decimal mark as asked, or written by a mask of the app's
 * own (`clock-layout.ts`). Every reading is a whole number of steps (a hundredth, a frame), so the
 * time played and the time left always add up to the length shown.
 */

import { oneOf, within } from './checked';
import {
    DECIMAL_DIGITS,
    fieldsOf,
    optionsLayout,
    readClockMask,
    writeLayout,
    type ClockField,
    type ClockLayout,
    type ClockValues,
} from './clock-layout';
import { LANDING } from './steps';

/** What a clock shows after the seconds: nothing, tenths, hundredths, milliseconds, or the frame. */
export type ClockPrecision =
    | 'seconds'
    | 'tenths'
    | 'hundredths'
    | 'milliseconds'
    | 'frames';

/**
 * The hours: from one hour on, but always for a frame, as a timecode writes them (`'auto'`);
 * always (`'always'`); or from one hour on, frame or not (`'needed'`).
 */
export type ClockHours = 'auto' | 'always' | 'needed';

/** The least digits of each field: hours and minutes 1 to 4, seconds and the frame 2 to 4. */
export type ClockDigits = {
    hours: number;
    minutes: number;
    seconds: number;
    frames: number;
};

/** How a clock writes a time; what is left out takes its default. */
export type ClockFormat = {
    /** `'seconds'` by default. */
    precision?: ClockPrecision;
    /** Frames in a second, with `'frames'`, 1 to 120 (30); 29.97 counts 30 frames in each second. */
    fps?: number;
    /** `'auto'` by default. */
    hours?: ClockHours;
    /** The mark before the decimals, a point by default. */
    decimal?: '.' | ',';
    /** The least digits of each field (1, 1, 2 and 2 by default). */
    digits?: Partial<ClockDigits>;
    /**
     * A mask that writes the time its own way (`'hh:mm:ss.SSS'`, `'hh[h]mm[m]ss[s]'`), over the
     * precision, hours, decimal and digits; null, empty or not a mask, the options write it.
     */
    format?: string | null;
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
    'needed',
] as const);

export const DEFAULT_CLOCK_DIGITS: Readonly<ClockDigits> = Object.freeze({
    hours: 1,
    minutes: 1,
    seconds: 2,
    frames: 2,
});

/** In seconds: the float noise a reading ignores (3 frames at 30 per second is 0.0999…, still frame 3). */
const NOISE = 0.000001;

/** A clock ready to write: its layout, its frames a second, and the steps in each second. */
type Clock = { layout: ClockLayout; fps: number; slots: number };

/** The least digits of each field, each kept in its range. */
export function clockDigits(
    given: Partial<ClockDigits> | undefined,
): ClockDigits {
    const digits = given ?? {};
    const whole = (value: number): number => Math.round(value);

    return {
        hours: within(digits.hours, DEFAULT_CLOCK_DIGITS.hours, 1, 4, whole),
        minutes: within(
            digits.minutes,
            DEFAULT_CLOCK_DIGITS.minutes,
            1,
            4,
            whole,
        ),
        seconds: within(
            digits.seconds,
            DEFAULT_CLOCK_DIGITS.seconds,
            2,
            4,
            whole,
        ),
        frames: within(digits.frames, DEFAULT_CLOCK_DIGITS.frames, 2, 4, whole),
    };
}

/** A clock's options checked and laid out; the mask, when it is one, wins. */
function clockOf(format: ClockFormat): Clock {
    const fps = within(format.fps, 30, 1, 120);
    const mask =
        typeof format.format === 'string' ? readClockMask(format.format) : null;
    const layout =
        mask ??
        optionsLayout(
            oneOf(format.precision, CLOCK_PRECISIONS, 'seconds'),
            oneOf(format.hours, CLOCK_HOURS, 'auto'),
            clockDigits(format.digits),
            oneOf(format.decimal, ['.', ','] as const, '.'),
        );
    const precision = layout.precision;
    const slots =
        precision === 'seconds'
            ? 1
            : precision === 'frames'
              ? Math.ceil(fps)
              : 10 ** (DECIMAL_DIGITS[precision] ?? 1);

    return { layout, fps, slots };
}

/** The clocks read lately, by what their format says: a player reads its own many times a second. */
const READ = new Map<string, Clock>();

/** The most clocks kept read; past it, the oldest goes. */
const MOST_READ = 32;

function ready(format: ClockFormat): Clock {
    const digits = format.digits ?? {};
    const key = JSON.stringify([
        format.precision,
        format.fps,
        format.hours,
        format.decimal,
        digits.hours,
        digits.minutes,
        digits.seconds,
        digits.frames,
        format.format,
    ]);
    let clock = READ.get(key);

    if (clock === undefined) {
        clock = clockOf(format);
        READ.set(key, clock);

        if (READ.size > MOST_READ) {
            READ.delete(READ.keys().next().value as string);
        }
    }

    return clock;
}

/** A time to read: never below zero, and zero when it is not a number. */
function safe(seconds: number): number {
    return Math.max(0, Number.isFinite(seconds) ? seconds : 0);
}

/** The frame of its second a time is in, and the whole seconds before it. */
function frameAt(time: number, clock: Clock): { whole: number; frame: number } {
    const whole = Math.floor(time + NOISE);
    const frame = Math.floor((time - whole) * clock.fps + NOISE);

    return { whole, frame: Math.min(clock.slots - 1, Math.max(0, frame)) };
}

/**
 * A time as steps of the clock: whole seconds cut, decimals rounded to the nearest (59.996 s in
 * hundredths is a whole minute), and frames cut, as the frame the sound is in.
 */
function stepsAt(seconds: number, clock: Clock): number {
    const time = safe(seconds);

    switch (clock.layout.precision) {
        case 'seconds':
            return Math.floor(time + NOISE);
        case 'frames': {
            const { whole, frame } = frameAt(time, clock);

            return whole * clock.slots + frame;
        }
        default:
            return Math.round(Number((time * clock.slots).toFixed(6)));
    }
}

/** Steps split into the fields the layout has: without hours, the minutes hold them; without minutes, the seconds. */
function valuesOf(steps: number, clock: Clock): ClockValues {
    const whole = Math.floor(steps / clock.slots);
    const fields = fieldsOf(clock.layout);
    const hours = fields.hours ? Math.floor(whole / 3600) : 0;
    const minutes = fields.minutes
        ? Math.floor((whole - hours * 3600) / 60)
        : 0;

    return {
        hours,
        minutes,
        seconds: whole - hours * 3600 - minutes * 60,
        part: steps - whole * clock.slots,
    };
}

/** The digits a frame needs for its largest number: two up to 100 frames a second, three above. */
function frameDigits(clock: Clock, digits: number): number {
    return Math.max(digits, String(clock.slots - 1).length);
}

/** The first field the time shows: the hours, unless they wait for an hour (`H`) that has not come. */
function topField(clock: Clock, values: ClockValues): ClockField | undefined {
    for (const piece of clock.layout.pieces) {
        if ('field' in piece && !(piece.field === 'H' && values.hours === 0)) {
            return piece.field;
        }
    }

    return undefined;
}

/** Steps of the clock written out, each field with its least digits. */
function write(steps: number, clock: Clock): string {
    const values = valuesOf(steps, clock);
    const top = topField(clock, values);
    const snug = clock.layout.snug;

    return writeLayout(
        clock.layout,
        values,
        (field, digits) =>
            field === 'f'
                ? frameDigits(clock, digits)
                : snug && (field === 'm' || field === 's') && field !== top
                  ? Math.max(digits, 2)
                  : digits,
        (value, digits) => String(value).padStart(digits, '0'),
    );
}

/**
 * The widest text the clock writes up to `steps`, every digit a zero: the first field as wide as
 * its value at `steps`, minutes and seconds under it as wide as 59, the frame as wide as its
 * largest number.
 */
function mold(steps: number, clock: Clock): string {
    const values = valuesOf(steps, clock);
    const top = topField(clock, values);

    return writeLayout(
        clock.layout,
        values,
        (field, digits) =>
            field === 'f'
                ? frameDigits(clock, digits)
                : (field === 'm' || field === 's') && field !== top
                  ? Math.max(digits, 2)
                  : digits,
        (value, digits) => '0'.repeat(Math.max(digits, String(value).length)),
    );
}

/** A time in seconds, as the clock writes it (`1:05.25`, `0:01:05:12`, `00h01m05s`). */
export function formatClock(seconds: number, format: ClockFormat = {}): string {
    const clock = ready(format);

    return write(stepsAt(seconds, clock), clock);
}

/** The time played and the length, in steps: the time played never passes the length. */
function readings(
    time: number | null,
    duration: number | null,
    clock: Clock,
): { now: number; total: number } {
    const total = stepsAt(duration ?? 0, clock);
    // Whole seconds read `LANDING` ahead, as the plain clock does: a seek lands a hair short.
    const nudge = clock.layout.precision === 'seconds' ? LANDING : 0;
    const played = stepsAt((time ?? 0) + nudge, clock);
    const now =
        duration !== null && played > total
            ? Math.max(stepsAt(time ?? 0, clock), total)
            : played;

    return { now, total };
}

/**
 * What a time part reads with this clock. The time left is the length less the time played, in
 * steps, as a timecode subtracts.
 */
export function clockText(
    form: ClockForm,
    time: number | null,
    duration: number | null,
    format: ClockFormat,
): string {
    const clock = ready(format);
    const { now, total } = readings(time, duration, clock);

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
 * The widest text `clockText` shows for this sound, every digit a zero: laid under the time, it
 * keeps the room of the widest time, so the digits changing never move what sits beside it.
 */
export function clockMold(
    form: ClockForm,
    time: number | null,
    duration: number | null,
    format: ClockFormat,
): string {
    const clock = ready(format);
    const longest = mold(
        stepsAt(Math.max(time ?? 0, duration ?? 0), clock),
        clock,
    );

    switch (form) {
        case 'remaining':
            return `-${longest}`;
        case 'both':
            return `${longest} / ${longest}`;
        default:
            return longest;
    }
}

/** What the clock counts in its last field: its precision, or the mask's when it has one. */
export function clockPrecision(format: ClockFormat): ClockPrecision {
    return ready(format).layout.precision;
}

/** How long one step of the clock lasts, in seconds: a second, a tenth, a hundredth, a millisecond, a frame. */
export function clockStep(format: ClockFormat): number {
    const clock = ready(format);

    return clock.layout.precision === 'frames'
        ? 1 / clock.fps
        : 1 / clock.slots;
}

/**
 * Seconds of playing at `rate` until the time played reads differently: the next step's start
 * (half a step on, for decimals rounded to the nearest). Null while the sound does not move forward.
 */
export function nextClockChange(
    time: number,
    format: ClockFormat,
    rate: number,
): number | null {
    if (!Number.isFinite(rate) || rate <= 0) {
        return null;
    }

    const clock = ready(format);
    const now = safe(time);
    let next: number;

    switch (clock.layout.precision) {
        case 'seconds':
            next = Math.floor(now + LANDING + NOISE) + 1 - LANDING;
            break;
        case 'frames': {
            const { whole, frame } = frameAt(now, clock);
            next =
                frame + 1 < clock.slots
                    ? whole + (frame + 1) / clock.fps
                    : whole + 1;
            break;
        }
        default:
            next = (stepsAt(now, clock) + 0.5) / clock.slots;
    }

    const wait = next - now;

    return (wait > 0 ? wait : clockStep(format)) / rate;
}

/** Whether `mask` is a mask a clock can write with (see `clock-layout.ts`). */
export function isClockMask(mask: unknown): mask is string {
    return typeof mask === 'string' && readClockMask(mask) !== null;
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
