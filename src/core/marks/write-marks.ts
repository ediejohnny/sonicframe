/**
 * Regions and markers written as files other programs read:
 * - JSON: a list with the plugins' own fields;
 * - WebVTT: a cue each, in order of their starts, the ids as identifiers; a marker lasts until the
 *   next one, so the file serves as chapters;
 * - CSV: a header, quotes where a cell needs them (RFC 4180), the separator and decimal mark a
 *   spreadsheet reads, and the cells it would run as formulas guarded (on by default);
 * - Audacity labels: start, end and label by tabs, to six decimals; a marker is a point label.
 * A region or a marker whose time is not a finite number is left out. Nothing here touches the page.
 */

import { oneOf } from '../shared/checked';
import { vttText, vttTime } from '../shared/vtt';
import { csvLine, guardCell, type CsvSeparator } from './csv';
import type { Mark } from './markers';
import type { RegionInput } from './regions';

/** The files regions and markers are written as and read from. */
export type MarksFormat = 'json' | 'vtt' | 'csv' | 'audacity';

export const MARKS_FORMATS: readonly MarksFormat[] = Object.freeze([
    'json',
    'vtt',
    'csv',
    'audacity',
]);

export type MarksWriteOptions = {
    /** The file's format: `'json'` (the default), `'vtt'`, `'csv'` or `'audacity'`. */
    format?: MarksFormat;
    /** CSV: what separates the cells, `','` (the default), `';'` or a tab. */
    separator?: CsvSeparator;
    /** CSV: the decimal mark of the times, `'.'` (the default) or `','`. */
    decimal?: '.' | ',';
    /** CSV: a `'` before a cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@`). On by default. */
    guardFormulas?: boolean;
};

export type MarkersWriteOptions = MarksWriteOptions & {
    /** WebVTT: the sound's length, where the last marker's cue ends; a second after it without one. */
    duration?: number;
};

/** One line of a file: a region, or a marker (its end the same as its start). */
type Item = {
    start: number;
    end: number;
    label?: string;
    color?: string;
    id?: string;
};

/** What is written of a region or a marker, and how a file names its times. */
type Kind = 'regions' | 'markers';

/** The text of a field from outside, or none. */
function textOf(value: unknown): string | undefined {
    return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The finite regions as items. */
function regionItems(regions: readonly RegionInput[]): Item[] {
    return regions
        .filter(
            (region) =>
                Number.isFinite(region.start) && Number.isFinite(region.end),
        )
        .map((region) => ({
            start: region.start,
            end: region.end,
            label: textOf(region.label),
            color: textOf(region.color),
            id: textOf(region.id),
        }));
}

/** The finite markers as items, a plain moment as one with only its time. */
function markItems(marks: readonly (number | Mark)[]): Item[] {
    return marks
        .map((mark) => (typeof mark === 'number' ? { time: mark } : mark))
        .filter((mark) => Number.isFinite(mark.time))
        .map((mark) => ({
            start: mark.time,
            end: mark.time,
            label: textOf(mark.label),
            color: textOf(mark.color),
            id: textOf(mark.id),
        }));
}

/** An item as a JSON object: only the fields it has, the times named for its kind. */
function jsonOf(item: Item, kind: Kind): Record<string, unknown> {
    const object: Record<string, unknown> = {};

    if (item.id !== undefined) {
        object.id = item.id;
    }

    if (kind === 'markers') {
        object.time = item.start;
    } else {
        object.start = item.start;
        object.end = item.end;
    }

    if (item.label !== undefined) {
        object.label = item.label;
    }

    if (item.color !== undefined) {
        object.color = item.color;
    }

    return object;
}

/** A label on one line: line breaks (and, for a format split by tabs, tabs) become spaces. */
function oneLine(text: string | undefined, tabs: boolean = false): string {
    return (text ?? '').replace(tabs ? /[\r\n\t]+/g : /[\r\n]+/g, ' ');
}

/** An id WebVTT reads back as a cue's identifier: one line, no arrow, no word that opens another block. */
function vttId(id: string | undefined): string | undefined {
    const line = id === undefined ? '' : oneLine(id).trim();

    return line === '' ||
        line.includes('-->') ||
        /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/.test(line)
        ? undefined
        : line;
}

/** The items as WebVTT cues, each `ends[index]` seconds long at least a thousandth. */
function vttOf(items: readonly Item[], ends: readonly number[]): string {
    if (items.length === 0) {
        return 'WEBVTT\n';
    }

    const cues = items.map((item, index) => {
        const id = vttId(item.id);
        const end = Math.max(ends[index], item.start + 0.001);
        const lines = [`${vttTime(item.start)} --> ${vttTime(end)}`];
        const label = oneLine(item.label).trim();

        if (id !== undefined) {
            lines.unshift(id);
        }

        if (label !== '') {
            lines.push(vttText(label));
        }

        return lines.join('\n');
    });

    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

/** Where each marker's cue ends: at the next later marker, or the sound's end, or a second after it. */
function markerEnds(
    items: readonly Item[],
    duration: number | undefined,
): number[] {
    return items.map((item, index) => {
        const next = items
            .slice(index + 1)
            .find((later) => later.start > item.start);

        if (next !== undefined) {
            return next.start;
        }

        return duration !== undefined &&
            Number.isFinite(duration) &&
            duration > item.start
            ? duration
            : item.start + 1;
    });
}

/** The items as CSV: a header and a line each, ending in `\r\n`. */
function csvOf(
    items: readonly Item[],
    kind: Kind,
    options: MarksWriteOptions,
): string {
    const separator = oneOf(options.separator, [',', ';', '\t'], ',');
    const decimal = options.decimal === ',' ? ',' : '.';
    const guard = options.guardFormulas !== false;
    const number = (value: number): string =>
        String(Number(value.toFixed(3))).replace('.', decimal);
    const cell = (text: string | undefined): string =>
        text === undefined ? '' : guard ? guardCell(text) : text;
    const header =
        kind === 'markers'
            ? ['time', 'label', 'color', 'id']
            : ['start', 'end', 'label', 'color', 'id'];
    const lines = [csvLine(header, separator)];

    for (const item of items) {
        const times =
            kind === 'markers'
                ? [number(item.start)]
                : [number(item.start), number(item.end)];
        lines.push(
            csvLine(
                [...times, cell(item.label), cell(item.color), cell(item.id)],
                separator,
            ),
        );
    }

    return `${lines.join('\r\n')}\r\n`;
}

/** The items as Audacity labels: start, end and label by tabs, a line each. */
function audacityOf(items: readonly Item[]): string {
    return items
        .map(
            (item) =>
                `${item.start.toFixed(6)}\t${item.end.toFixed(6)}\t${oneLine(item.label, true)}\n`,
        )
        .join('');
}

/** Items in order of their starts, those that start together in the order given. */
function inOrder(items: readonly Item[]): Item[] {
    return [...items].sort((a, b) => a.start - b.start);
}

function write(
    items: readonly Item[],
    kind: Kind,
    options: MarkersWriteOptions,
): string {
    switch (oneOf(options.format, MARKS_FORMATS, 'json')) {
        case 'vtt': {
            const sorted = inOrder(items);

            return vttOf(
                sorted,
                kind === 'markers'
                    ? markerEnds(sorted, options.duration)
                    : sorted.map((item) => item.end),
            );
        }
        case 'csv':
            return csvOf(items, kind, options);
        case 'audacity':
            return audacityOf(items);
        default:
            return `${JSON.stringify(
                items.map((item) => jsonOf(item, kind)),
                null,
                2,
            )}\n`;
    }
}

/** Regions as a file of `format` (JSON by default); see `MarksWriteOptions`. */
export function writeRegions(
    regions: readonly RegionInput[],
    options: MarksWriteOptions = {},
): string {
    return write(regionItems(regions), 'regions', options);
}

/** Markers (marks, or plain moments in seconds) as a file of `format` (JSON by default). */
export function writeMarkers(
    marks: readonly (number | Mark)[],
    options: MarkersWriteOptions = {},
): string {
    return write(markItems(marks), 'markers', options);
}
