/**
 * Regions and markers read from files, which are untrusted input: JSON (a list, or one under
 * `regions` / `markers`), WebVTT (its cues, the identifiers as ids), CSV (the separator found on the
 * first line, the columns by their names or, without known names, in the order `writeRegions` writes
 * them; a decimal comma taken, the formula guard of each text cell taken back) and Audacity labels
 * (frequency lines skipped). The format comes from the content unless given. A text over 512 KB is
 * refused, at most 2000 items are read, a time must be a finite number from zero (a region's end not
 * before its start) and labels, colors and ids are cleaned to one short safe line. Nothing here
 * touches the page.
 */

import { isRecord, oneOf } from '../shared/checked';
import { limitOf, TEXT_LENGTH, type Limit } from '../shared/limits';
import { cleanText } from '../shared/text';
import { isVtt, readVtt, textLines } from '../shared/vtt';
import { csvRows, csvSeparator, unguardCell } from './csv';
import type { Mark } from './markers';
import type { RegionInput } from './regions';
import { MARKS_FORMATS, type MarksFormat } from './write-marks';

export type MarksReadOptions = {
    /** The file's format, or `'auto'` (the default): known by its content. */
    format?: MarksFormat | 'auto';
    /** CSV: takes back the `'` that guards a cell a spreadsheet would run as a formula. On by default. */
    guardFormulas?: boolean;
    /** The most regions or markers kept: 2000, from 1 to 20 000; past either end, a `RangeError`. */
    maxItems?: number;
    /** The longest text read, in characters: 524 288 (512 KB), from 1 to 5 242 880 (5 MB). */
    maxSize?: number;
    /** The longest label kept, in characters: 120, from 1 to 1000; past either end, a `RangeError`. */
    maxText?: number;
};

/** The longest text read, in characters: 512 KB, up to 5 MB. */
const MARKS_TEXT: Limit = {
    value: 524_288,
    least: 1,
    most: 5_242_880,
    whole: true,
};

/** The most items read from one file: 2000, up to 20 000 (a mark every 2 s for 10 hours is 18 000). */
export const MARKS_COUNT: Limit = {
    value: 2000,
    least: 1,
    most: 20_000,
    whole: true,
};

/** The longest color and id kept, in characters (a label's is `maxText`). */
const MAX_COLOR = 100;
const MAX_ID = 200;

/** A line of a file, as read: its start, its end when it has one, and its texts. */
type Row = {
    start: number | null;
    end: number | null;
    label?: unknown;
    color?: unknown;
    id?: unknown;
};

/** The names a CSV header may give each column, lowercase. */
const COLUMNS: Readonly<Record<keyof Row, readonly string[]>> = {
    start: ['start', 'begin', 'from', 'in', 'time', 'at'],
    end: ['end', 'stop', 'to', 'out'],
    label: ['label', 'title', 'name', 'text', 'note'],
    color: ['color', 'colour'],
    id: ['id'],
};

function notMarks(): TypeError {
    return new TypeError('sonicframe: the text is no regions or markers file');
}

/** A number as a file writes it, a decimal comma taken; null when it is none. */
function numberOf(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const written = value.trim();

    return /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(written)
        ? Number(written.replace(',', '.'))
        : null;
}

/** A text field cleaned to one safe line of at most `max` characters, or none. */
function textOf(value: unknown, max: number): string | undefined {
    const text = typeof value === 'string' ? cleanText(value, max) : '';

    return text === '' ? undefined : text;
}

/** The format of a text, known by its content. */
function formatOf(text: string): MarksFormat {
    if (isVtt(text)) {
        return 'vtt';
    }

    const head = text.trimStart();

    if (head.startsWith('[') || head.startsWith('{')) {
        return 'json';
    }

    const first = text.split('\n').find((line) => line.trim() !== '') ?? '';

    return /^\s*\d+(?:[.,]\d+)?\t\d+(?:[.,]\d+)?(?:\t|$)/.test(first)
        ? 'audacity'
        : 'csv';
}

/** The rows of a JSON list, or of the list under `key`; twice `most` at the very most, as each format. */
function jsonRows(text: string, key: string, most: number): Row[] {
    let parsed: unknown;

    try {
        parsed = JSON.parse(text);
    } catch {
        throw notMarks();
    }

    const list = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed)
          ? parsed[key]
          : undefined;

    if (!Array.isArray(list)) {
        throw notMarks();
    }

    return list.slice(0, most * 2).map((item: unknown) =>
        isRecord(item)
            ? {
                  start: numberOf(item.start ?? item.time),
                  end: numberOf(item.end),
                  label: item.label,
                  color: item.color,
                  id: item.id,
              }
            : {
                  start: numberOf(typeof item === 'number' ? item : null),
                  end: null,
              },
    );
}

/** The rows of a CSV: by the header's column names, or in the written order without known names. */
function csvRowsOf(text: string, guard: boolean, most: number): Row[] {
    const separator = csvSeparator(text.split('\n', 1)[0]);
    const lines = csvRows(text, separator);
    const header = lines[0] ?? [];
    const named = numberOf(header[0]) === null;
    const names = header.map((name) => name.trim().toLowerCase());
    const found = (column: keyof Row, at: number): number => {
        const index = names.findIndex((name) => COLUMNS[column].includes(name));

        return named && names.some((name) => COLUMNS.start.includes(name))
            ? index
            : at;
    };
    const columns = {
        start: found('start', 0),
        end: found('end', 1),
        label: found('label', 2),
        color: found('color', 3),
        id: found('id', 4),
    };
    // A column the header does not name is at -1, which no line has.
    const cell = (line: readonly string[], at: number): string | undefined =>
        line[at];
    const words = (line: readonly string[], at: number): string | undefined => {
        const written = cell(line, at);

        return written !== undefined && guard ? unguardCell(written) : written;
    };

    return lines.slice(named ? 1 : 0, most * 2 + 1).map((line) => ({
        start: numberOf(cell(line, columns.start)),
        end: numberOf(cell(line, columns.end)),
        label: words(line, columns.label),
        color: words(line, columns.color),
        id: words(line, columns.id),
    }));
}

/**
 * The rows of Audacity's labels: start, end and label by tabs. A frequency line (`\`) or an empty
 * one has no start, so it is left out with the other rows that have none.
 */
function audacityRows(text: string, most: number): Row[] {
    return text
        .split('\n')
        .slice(0, most * 2)
        .map((line) => {
            const [start, end, ...label] = line.split('\t');

            return {
                start: numberOf(start),
                end: numberOf(end),
                label: label.join(' '),
            };
        });
}

/** The rows of a text, in its format, read up to twice `most` of them. */
function rowsOf(
    input: string,
    options: MarksReadOptions,
    key: string,
    most: number,
): Row[] {
    if (typeof input !== 'string') {
        throw notMarks();
    }

    const maxSize = limitOf('maxSize', options.maxSize, MARKS_TEXT);

    if (input.length > maxSize) {
        throw new RangeError(
            `sonicframe: the text is over maxSize (${maxSize} characters)`,
        );
    }

    const text = textLines(input);
    const asked = oneOf(options.format, [...MARKS_FORMATS, 'auto'], 'auto');

    switch (asked === 'auto' ? formatOf(text) : asked) {
        case 'json':
            return jsonRows(text, key, most);
        case 'vtt':
            return readVtt(text).map((cue) => ({
                start: cue.start,
                end: cue.end,
                label: cue.title,
                id: cue.id,
            }));
        case 'audacity':
            return audacityRows(text, most);
        default:
            return csvRowsOf(text, options.guardFormulas !== false, most);
    }
}

/** The texts a row carries: only those it has, each cleaned. */
function textsOf(
    row: Row,
    longest: number,
): { label?: string; color?: string; id?: string } {
    const texts: { label?: string; color?: string; id?: string } = {};
    const label = textOf(row.label, longest);
    const color = textOf(row.color, MAX_COLOR);
    const id = textOf(row.id, MAX_ID);

    if (label !== undefined) {
        texts.label = label;
    }

    if (color !== undefined) {
        texts.color = color;
    }

    if (id !== undefined) {
        texts.id = id;
    }

    return texts;
}

/**
 * Regions from a file of any format (see `MarksReadOptions`); a line without an end is a region of
 * no length, which the regions plugin keeps to its shortest. A text that is no such file throws a
 * `TypeError`, and one over `maxSize` a `RangeError`.
 */
export function readRegions(
    text: string,
    options: MarksReadOptions = {},
): RegionInput[] {
    const most = limitOf('maxItems', options.maxItems, MARKS_COUNT);
    const longest = limitOf('maxText', options.maxText, TEXT_LENGTH);
    const regions: RegionInput[] = [];

    for (const row of rowsOf(text, options, 'regions', most)) {
        const end = row.end ?? row.start;

        if (
            row.start !== null &&
            end !== null &&
            row.start >= 0 &&
            end >= row.start &&
            regions.length < most
        ) {
            regions.push({ start: row.start, end, ...textsOf(row, longest) });
        }
    }

    return regions;
}

/**
 * Markers from a file of any format, each at the start of its line (a region file gives its
 * starts); a plain moment in a JSON list counts too. A text that is no such file throws a
 * `TypeError`, and one over `maxSize` a `RangeError`.
 */
export function readMarkers(
    text: string,
    options: MarksReadOptions = {},
): Mark[] {
    const most = limitOf('maxItems', options.maxItems, MARKS_COUNT);
    const longest = limitOf('maxText', options.maxText, TEXT_LENGTH);
    const marks: Mark[] = [];

    for (const row of rowsOf(text, options, 'markers', most)) {
        if (row.start !== null && row.start >= 0 && marks.length < most) {
            marks.push({ time: row.start, ...textsOf(row, longest) });
        }
    }

    return marks;
}
