/**
 * The wave in words: a short description of a sound's shape for people who cannot see the wave (how
 * long it is, where the sound and the pauses are, where it is loudest), written from its outline
 * (`outlineSound`). Pure, so a server can write it ahead (it is on the `sonicframe/analysis` entry)
 * and every rule is tested in Node. It speaks of "sound", never of speech or music, since peaks
 * cannot tell them apart.
 */

import {
    byLanguage,
    localeFor,
    resolveLanguage,
    type Language,
} from '../languages/language';
import { mergeWords } from '../languages/merge-words';
import type { DescriptionWords } from '../languages/words';
import { cleanText, fillTemplate } from '../shared/text';
import { formatTime } from '../shared/timing';
import type { SoundOutline } from './outline';

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

/** Up to this many pauses, the description walks through the sound; beyond, it sums them up. */
const NARRATED_PAUSES = 2;

/** The longest phrase taken from the app, in characters. */
const MAX_WORD = 200;

/** The longest description, in characters. */
const MAX_TEXT = 600;

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
