/**
 * What makes a language complete: every phrase English has, under the same group and name, with the
 * same `{name}` marks, and nothing English does not have. A language file and a registered language
 * both pass this check.
 */

import { EN } from './en';

/** The longest phrase a language may have, in characters. */
export const MAX_PHRASE = 200;

const MARK = /\{(\w+)\}/g;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The marks of a phrase, each once, in order of name: `'{from} {to}'`. */
function marksOf(phrase: string): string {
    const names = new Set(
        Array.from(phrase.matchAll(MARK), (match) => match[1]),
    );

    return [...names]
        .sort()
        .map((name) => `{${name}}`)
        .join(' ');
}

/** The names `record` has beyond those of `model`. */
function extra(
    record: Readonly<Record<string, unknown>>,
    model: object,
): string[] {
    return Object.keys(record).filter((name) => !Object.hasOwn(model, name));
}

/**
 * What is wrong with a language's words, one line each (`player.play is missing`); none for a
 * complete language.
 */
export function languageProblems(words: unknown): string[] {
    const problems: string[] = [];
    const given = isRecord(words) ? words : {};

    for (const [group, phrases] of Object.entries(EN)) {
        const own = given[group];
        const record = isRecord(own) ? own : {};

        for (const [name, english] of Object.entries(
            phrases as Record<string, string>,
        )) {
            const phrase = record[name];
            const place = `${group}.${name}`;

            if (typeof phrase !== 'string') {
                problems.push(`${place} is missing`);
            } else if (marksOf(phrase) !== marksOf(english)) {
                problems.push(
                    `${place} must have the marks ${marksOf(english) || '(none)'}`,
                );
            } else if (phrase.length > MAX_PHRASE) {
                problems.push(
                    `${place} is longer than ${MAX_PHRASE} characters`,
                );
            }
        }

        for (const name of extra(record, phrases)) {
            problems.push(`${group}.${name} is not a phrase of SonicFrame`);
        }
    }

    for (const group of extra(given, EN)) {
        problems.push(`${group} is not a group of SonicFrame`);
    }

    return problems;
}
