/**
 * The wave in words: a short description of a sound's shape for people who cannot see the wave (how
 * long it is, where the sound and the pauses are, where it is loudest), built from its peaks alone.
 * Pure, so a server can write it ahead (it is on the `sonicframe/analysis` entry) and every rule is
 * tested in Node. It speaks of "sound", never of speech or music, since peaks cannot tell them apart;
 * and peaks are relative, so it describes the shape, never how loud the recording is.
 */

import { silencesFromPeaks, type Silence } from '../analysis/analysis';
import {
    byLanguage,
    localeFor,
    resolveLanguage,
    type Language,
} from '../languages/language';
import { mergeWords } from '../languages/merge-words';
import type { DescriptionWords } from '../languages/words';
import { normalize, resample } from '../peaks/peaks';
import { positive } from '../shared/math';
import { LANDING, stepIndex } from '../shared/steps';
import { cleanText, fillTemplate } from '../shared/text';
import { formatTime } from '../shared/timing';

export type { DescriptionWords };

/** A stretch with sound, in seconds. */
export type SoundPart = { start: number; end: number };

/** How the level moves along the sound: even, growing, fading, or up and down. */
export type SoundLevel = 'steady' | 'rises' | 'falls' | 'varies';

/** The shape of a sound, in seconds. */
export type SoundOutline = {
    duration: number;
    /** Every peak is zero. */
    silent: boolean;
    /** The stretches with sound, in order. */
    parts: SoundPart[];
    /** The quiet stretches between two parts. */
    pauses: Silence[];
    /** Silence before the first part; 0 when the sound starts right away. */
    leading: number;
    /** Silence after the last part; 0 when the sound runs to the end. */
    trailing: number;
    /** The middle of a stretch clearly louder than the rest, or null when none stands out. */
    loudest: number | null;
    /** Null for silence. */
    level: SoundLevel | null;
};

export type OutlineOptions = {
    /** Below this share of the loudest peak counts as quiet; 0.06 by default. */
    threshold?: number;
    /** The shortest quiet stretch that is a pause, in seconds; 3 % of the sound by default, from 0.75 to 5. */
    minPause?: number;
};

export type DescribeOptions = {
    /** A language tag: `'en'` (the default), `'pt'`, `'pt-BR'`… or any other with `words`. */
    lang?: string;
    /** Your own phrases, over the built-in ones; their language follows `lang`. */
    words?: Partial<DescriptionWords>;
    /** Positions as words (`'words'`, the default: "12 seconds") or as a clock (`'clock'`: "0:12"). */
    times?: 'words' | 'clock';
};

/** Phrases in one language, ready to describe a sound and the steps between its parts. */
export type SoundWords = {
    /** The language tag the text is in, for its `lang` attribute and a voice. */
    readonly locale: string;
    describe(outline: SoundOutline): string;
    /** Part `index` (from 0) of `count`, starting at `time` seconds. */
    part(index: number, count: number, time: number): string;
    noPart(): string;
    pauseNote(): string;
    silenceNote(): string;
};

export const DESCRIPTION_WORDS: Readonly<
    Record<Language, Readonly<DescriptionWords>>
> = byLanguage((words) => words.description);

/** The most peaks looked at; a longer list is folded first, so the cost stays the same. */
const MAX_VALUES = 2000;

/** The loudest stretch is this share of the sound. */
const LOUD_WINDOW = 0.02;

/** A stretch this many times the average level of the sound stands out as its loudest. */
const STANDS_OUT = 1.5;

/** Tenths of the sound whose levels stay within this ratio sound even. */
const EVEN = 1.6;

/** The last third this many times louder (or quieter) than the first one grows (or fades). */
const TREND = 1.5;

/** Up to this many pauses, the description walks through the sound; beyond, it sums them up. */
const NARRATED_PAUSES = 2;

/** The longest phrase taken from the app, in characters. */
const MAX_WORD = 200;

/** The longest description, in characters. */
const MAX_TEXT = 600;

function silenceOf(duration: number): SoundOutline {
    return {
        duration,
        silent: true,
        parts: [],
        pauses: [],
        leading: 0,
        trailing: 0,
        loudest: null,
        level: null,
    };
}

/** The middle of the loudest stretch, in seconds, when it is clearly louder than the sound around it. */
function loudestAt(
    values: readonly number[],
    quiet: number,
    step: number,
): number | null {
    const size = Math.max(1, Math.round(values.length * LOUD_WINDOW));
    let sum = 0;
    let best = -1;
    let bestSum = -1;
    let total = 0;
    let count = 0;

    for (let i = 0; i < values.length; i++) {
        sum += values[i];

        if (i >= size) {
            sum -= values[i - size];
        }

        if (i >= size - 1 && sum > bestSum) {
            bestSum = sum;
            best = i - size + 1;
        }

        if (values[i] >= quiet) {
            total += values[i];
            count++;
        }
    }

    if (
        best < 0 ||
        count === 0 ||
        bestSum / size < (total / count) * STANDS_OUT
    ) {
        return null;
    }

    return (best + size / 2) * step;
}

function average(list: readonly (number | null)[]): number | null {
    const known = list.filter((value): value is number => value !== null);

    return known.length === 0
        ? null
        : known.reduce((sum, value) => sum + value, 0) / known.length;
}

/** How the level of the sound (its quiet stretches left out) moves from tenth to tenth. */
function levelOf(values: readonly number[], quiet: number): SoundLevel {
    const tenths: (number | null)[] = [];

    for (let tenth = 0; tenth < 10; tenth++) {
        const from = Math.floor((tenth * values.length) / 10);
        const to = Math.floor(((tenth + 1) * values.length) / 10);
        let total = 0;
        let count = 0;

        for (let i = from; i < to; i++) {
            if (values[i] >= quiet) {
                total += values[i];
                count++;
            }
        }

        tenths.push(count > 0 ? total / count : null);
    }

    const known = tenths.filter((value): value is number => value !== null);

    if (known.length < 3 || Math.max(...known) <= Math.min(...known) * EVEN) {
        return 'steady';
    }

    const first = average(tenths.slice(0, 3));
    const last = average(tenths.slice(7));

    if (first === null || last === null) {
        return 'varies';
    }

    if (last >= first * TREND) {
        return 'rises';
    }

    return first >= last * TREND ? 'falls' : 'varies';
}

/**
 * The shape of a sound from its peaks (any scale; they are measured against the loudest) and its
 * duration in seconds. Null without peaks or without a real duration.
 */
export function outlineSound(
    peaks: readonly number[],
    duration: number,
    options: OutlineOptions = {},
): SoundOutline | null {
    if (peaks.length === 0 || !Number.isFinite(duration) || duration <= 0) {
        return null;
    }

    const values = normalize(
        resample(peaks, Math.min(peaks.length, MAX_VALUES)).map((value) =>
            Number.isFinite(value) ? Math.min(1, Math.abs(value)) : 0,
        ),
    );

    if (!values.some((value) => value > 0)) {
        return silenceOf(duration);
    }

    const step = duration / values.length;
    // At most 0.45: a quiet stretch closes above twice the threshold, which the loudest peak (1) is.
    const quiet = Math.min(0.45, Math.max(0.001, options.threshold ?? 0.06));
    const minPause =
        positive(options.minPause) ??
        Math.min(5, Math.max(0.75, duration * 0.03));
    const pauses = silencesFromPeaks(values, duration, {
        threshold: quiet,
        minDuration: minPause,
    });
    let leading = 0;
    let trailing = 0;
    const first = pauses[0];

    if (first !== undefined && first.start < step / 2) {
        leading = first.end;
        pauses.shift();
    }

    const last = pauses[pauses.length - 1];

    if (last !== undefined && last.end > duration - step / 2) {
        trailing = duration - last.start;
        pauses.pop();
    }

    const parts: SoundPart[] = [];
    let from = leading;

    for (const pause of pauses) {
        parts.push({ start: from, end: pause.start });
        from = pause.end;
    }

    parts.push({ start: from, end: duration - trailing });

    return {
        duration,
        silent: false,
        parts,
        pauses,
        leading,
        trailing,
        loudest: loudestAt(values, quiet, step),
        level: levelOf(values, quiet),
    };
}

/**
 * The index of the part playing at `time`, or -1 inside a silence. A time up to `LANDING` before a
 * part's start is in it already: a seek to that start can land a hair early.
 */
export function partAt(outline: SoundOutline, time: number): number {
    const parts = outline.parts;

    return parts.findIndex(
        (part, index) =>
            time >= part.start - LANDING &&
            (time < part.end ||
                (index === parts.length - 1 && time <= part.end)),
    );
}

/** Which silence `time` is in: a pause between two parts, the silence at an end, or none (null). */
export function silenceAt(
    outline: SoundOutline,
    time: number,
): 'pause' | 'silence' | null {
    if (partAt(outline, time) >= 0) {
        return null;
    }

    const parts = outline.parts;
    const first = parts[0];
    const last = parts[parts.length - 1];

    return first === undefined ||
        last === undefined ||
        time < first.start ||
        time > last.end
        ? 'silence'
        : 'pause';
}

/**
 * The part a step lands on, or null when there is none. Forward, the next part to start after
 * `time` (one starting within `LANDING` of it is where a step just landed); back, like a player's
 * previous track, the start of the current part once more than `grace` seconds into it (floored at
 * `LANDING`), otherwise the one before.
 */
export function nextPart(
    outline: SoundOutline,
    time: number,
    direction: 1 | -1,
    grace: number = 1,
): number | null {
    return stepIndex(
        outline.parts.map((part) => part.start),
        time,
        direction,
        grace,
    );
}

function amount(
    value: number,
    unit: 'second' | 'minute' | 'hour',
    locale: string,
): string {
    return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'long',
    }).format(value);
}

function both(first: string, second: string, locale: string): string {
    return new Intl.ListFormat(locale, { style: 'long', type: 'unit' }).format([
        first,
        second,
    ]);
}

/**
 * Seconds in words: whole seconds under a minute, minutes and seconds under ten minutes, then
 * minutes, then hours and minutes. A length is rounded and never said as zero; a position is cut,
 * as the slider's clock cuts it, so "8 seconds" and "0:08" always agree.
 */
function spoken(seconds: number, locale: string, length: boolean): string {
    const whole = length
        ? Math.max(1, Math.round(seconds))
        : Math.max(0, Math.floor(seconds));

    if (whole < 60) {
        return amount(whole, 'second', locale);
    }

    if (whole < 600) {
        const minutes = Math.floor(whole / 60);
        const rest = whole % 60;
        const said = amount(minutes, 'minute', locale);

        return rest === 0
            ? said
            : both(said, amount(rest, 'second', locale), locale);
    }

    const minutes = length
        ? Math.round(seconds / 60)
        : Math.floor(seconds / 60);

    if (minutes < 60) {
        return amount(minutes, 'minute', locale);
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const said = amount(hours, 'hour', locale);

    return rest === 0
        ? said
        : both(said, amount(rest, 'minute', locale), locale);
}

/** Phrases for a language, with the app's own words over them. */
export function soundWords(options: DescribeOptions = {}): SoundWords {
    const locale = localeFor(options.lang, options.words !== undefined);
    const words = mergeWords(
        DESCRIPTION_WORDS[resolveLanguage(options.lang)],
        options.words,
        MAX_WORD,
    );
    const clock = options.times === 'clock';
    const length = (seconds: number): string => spoken(seconds, locale, true);
    const at = (seconds: number): string =>
        clock ? formatTime(seconds) : spoken(seconds, locale, false);
    const count = (value: number): string =>
        new Intl.NumberFormat(locale).format(value);

    function shape(outline: SoundOutline): string[] {
        const { parts, pauses, leading, trailing } = outline;

        if (pauses.length > NARRATED_PAUSES) {
            const longest = pauses.reduce((best, pause) =>
                pause.end - pause.start > best.end - best.start ? pause : best,
            );
            const sentences: string[] = [];

            if (leading > 0) {
                sentences.push(
                    fillTemplate(words.startsAfter, {
                        duration: length(leading),
                    }),
                );
            }

            sentences.push(
                fillTemplate(words.pauses, {
                    count: count(pauses.length),
                    duration: length(longest.end - longest.start),
                    at: at(longest.start),
                }),
            );

            if (trailing > 0) {
                sentences.push(
                    fillTemplate(words.endsWith, {
                        duration: length(trailing),
                    }),
                );
            }

            return sentences;
        }

        if (pauses.length === 0 && leading === 0 && trailing === 0) {
            return [words.continuous];
        }

        const steps: string[] = [];

        if (leading > 0) {
            steps.push(
                fillTemplate(words.silenceFor, { duration: length(leading) }),
            );
        }

        parts.forEach((part, index) => {
            const pause = pauses[index - 1];

            if (pause !== undefined) {
                steps.push(
                    fillTemplate(words.pause, {
                        duration: length(pause.end - pause.start),
                    }),
                );
            }

            const toEnd = index === parts.length - 1 && trailing === 0;

            if (steps.length === 0) {
                steps.push(
                    fillTemplate(words.soundUntil, { at: at(part.end) }),
                );
            } else if (toEnd) {
                steps.push(words.thenSoundToEnd);
            } else {
                steps.push(
                    fillTemplate(words.thenSoundUntil, { at: at(part.end) }),
                );
            }
        });

        if (trailing > 0) {
            steps.push(words.thenSilenceToEnd);
        }

        return [steps.join(`${words.join} `) + words.stop];
    }

    function level(outline: SoundOutline): string[] {
        const sentences: string[] = [];

        if (outline.level === 'rises') {
            sentences.push(words.rises);
        } else if (outline.level === 'falls') {
            sentences.push(words.falls);
        }

        if (outline.loudest !== null) {
            sentences.push(
                outline.loudest < 1
                    ? words.loudestStart
                    : fillTemplate(words.loudest, { at: at(outline.loudest) }),
            );
        } else if (outline.level === 'steady') {
            sentences.push(words.even);
        }

        return sentences;
    }

    return {
        locale,

        describe(outline): string {
            const total = length(outline.duration);
            const sentences = outline.silent
                ? [fillTemplate(words.silence, { duration: total })]
                : [
                      fillTemplate(words.length, { duration: total }),
                      ...shape(outline),
                      ...level(outline),
                  ];

            return cleanText(sentences.join(' '), MAX_TEXT);
        },

        part(index, total, time): string {
            // The first second is the start: "0 seconds" reads oddly, and in some languages wrongly.
            const template = time < 1 ? words.partStart : words.part;

            return cleanText(
                fillTemplate(template, {
                    part: count(index + 1),
                    count: count(total),
                    at: at(time),
                }),
                MAX_WORD,
            );
        },

        noPart(): string {
            return words.noPart;
        },

        pauseNote(): string {
            return words.pauseNote;
        },

        silenceNote(): string {
            return words.silenceNote;
        },
    };
}

/** The description of a sound's outline (see `outlineSound`) in a language. */
export function describeSound(
    outline: SoundOutline,
    options: DescribeOptions = {},
): string {
    return soundWords(options).describe(outline);
}
