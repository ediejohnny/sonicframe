/**
 * Regions and markers read from files: each format known by its content, the files other programs
 * write (Audacity with its frequency lines, a spreadsheet's semicolons and decimal commas), what is
 * left out, the limits, and every format written and read back unchanged.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import type { RegionInput } from '../../../src/core/marks/regions';
import { readMarkers, readRegions } from '../../../src/core/marks/read-marks';
import {
    writeMarkers,
    writeRegions,
} from '../../../src/core/marks/write-marks';

describe('readRegions', () => {
    it('reads JSON, as a list or under regions, a region without an end as one of no length', () => {
        const list = [
            { id: 'a', start: 1, end: 2, label: 'One', color: 'red' },
        ];

        expect(readRegions(JSON.stringify(list))).toEqual(list);
        expect(readRegions(JSON.stringify({ regions: list }))).toEqual(list);
        expect(readRegions('\n  [{"start": 4}]')).toEqual([
            { start: 4, end: 4 },
        ]);
    });

    it('reads WebVTT, its identifiers as ids, skipping notes and styles', () => {
        const text = [
            'WEBVTT',
            '',
            'NOTE made by hand',
            '',
            'STYLE',
            '::cue { color: red }',
            '',
            'intro',
            '00:01.000 --> 00:02.500 align:start',
            '<b>Intro</b> &amp; more',
            '',
            '00:00:03.000 --> 00:00:04.000',
            '',
        ].join('\n');

        expect(readRegions(text)).toEqual([
            { id: 'intro', start: 1, end: 2.5, label: 'Intro & more' },
            { start: 3, end: 4 },
        ]);
    });

    it("reads Audacity's labels, skipping its frequency lines and taking a decimal comma", () => {
        const text = [
            '0.000000\t2.500000\tIntro "live"',
            '\\\t200.000000\t1500.000000',
            '5,250000\t5,250000\tclap',
            '',
        ].join('\n');

        expect(readRegions(text)).toEqual([
            { start: 0, end: 2.5, label: 'Intro "live"' },
            { start: 5.25, end: 5.25, label: 'clap' },
        ]);
    });

    it('reads a file that opens with a byte-order mark, as editors and spreadsheets save it', () => {
        const mark = String.fromCharCode(0xfeff);

        expect(readRegions(`${mark}[{"start": 1, "end": 2}]`)).toEqual([
            { start: 1, end: 2 },
        ]);
        expect(
            readRegions(
                `${mark}WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nOne\r\n`,
            ),
        ).toEqual([{ start: 1, end: 2, label: 'One' }]);
    });

    it('reads the format asked over the one the content looks like', () => {
        const text = '1\t2\t"Verse, one"\n';

        expect(readRegions(text)).toEqual([
            { start: 1, end: 2, label: '"Verse, one"' },
        ]);
        expect(readRegions(text, { format: 'csv' })).toEqual([
            { start: 1, end: 2, label: 'Verse, one' },
        ]);
    });

    it('reads a CSV of a spreadsheet: semicolons, decimal commas, its own column names, in their order', () => {
        const text = [
            'Início;Fim;Rótulo',
            '1,5;3;Abertura',
            '4,25;6,75;"Parte; dois"',
            '',
        ].join('\r\n');

        expect(readRegions(text)).toEqual([
            { start: 1.5, end: 3, label: 'Abertura' },
            { start: 4.25, end: 6.75, label: 'Parte; dois' },
        ]);
    });

    it('reads CSV columns by their names, in any order, and without a header in the usual order', () => {
        expect(
            readRegions('Label, ID,End,Start\nVerse,v1,16,8.5\n', {
                format: 'csv',
            }),
        ).toEqual([{ id: 'v1', start: 8.5, end: 16, label: 'Verse' }]);
        expect(readRegions('8.5,16,Verse\n', { format: 'csv' })).toEqual([
            { start: 8.5, end: 16, label: 'Verse' },
        ]);
    });

    it('takes back the guard of a formula in every text cell, unless asked not to', () => {
        const text = "start,end,label,color,id\n1,2,'=SUM(A1),'+x,'@intro\n";

        expect(readRegions(text)).toEqual([
            { start: 1, end: 2, label: '=SUM(A1)', color: '+x', id: '@intro' },
        ]);
        expect(readRegions(text, { guardFormulas: false })).toEqual([
            {
                start: 1,
                end: 2,
                label: "'=SUM(A1)",
                color: "'+x",
                id: "'@intro",
            },
        ]);
    });

    it('leaves out a region with a time that is not a number, below zero, or with its end before its start; a number may have spaces around it', () => {
        const text = [
            'start,end,label',
            'x,2,a',
            '-1,2,b',
            '5,4,c',
            '1,-2,e',
            '1,1,d',
            '1,3,',
            ' .5 , 1 ,f',
            '',
        ].join('\n');

        expect(readRegions(text)).toEqual([
            { start: 1, end: 1, label: 'd' },
            { start: 1, end: 3 },
            { start: 0.5, end: 1, label: 'f' },
        ]);
    });

    it('cleans the labels, the colors and the ids to one short safe line', () => {
        const [region, blank] = readRegions(
            JSON.stringify([
                {
                    start: 1,
                    end: 2,
                    label: `a\nb${'x'.repeat(200)}`,
                    color: 'c'.repeat(150),
                    id: 'i'.repeat(300),
                },
                { start: 3, end: 4, label: '   ', color: 7, id: '' },
            ]),
        );

        expect(region).toEqual({
            start: 1,
            end: 2,
            label: `a b${'x'.repeat(117)}`,
            color: 'c'.repeat(100),
            id: 'i'.repeat(200),
        });
        expect(Object.keys(blank)).toEqual(['start', 'end']);
    });

    it('keeps at most 2000 regions and 2000 markers', () => {
        const many = JSON.stringify(
            Array.from({ length: 2500 }, (_, index) => ({
                start: index,
                end: index + 1,
            })),
        );

        expect(readRegions(many)).toHaveLength(2000);
        expect(readMarkers(many)).toHaveLength(2000);
    });

    it('keeps labels of 120 characters, or maxText up to 1000, refusing one past it', () => {
        const csv = `start,end,label\n1,2,${'l'.repeat(2000)}`;

        expect(readRegions(csv)[0].label).toHaveLength(120);
        expect(readRegions(csv, { maxText: 1000 })[0].label).toHaveLength(1000);
        expect(readMarkers(csv, { maxText: 7 })[0].label).toHaveLength(7);
        expect(() => readMarkers(csv, { maxText: 1001 })).toThrow(
            'maxText goes past its most, 1000',
        );
    });

    it('keeps up to 20 000 items and reads up to 5 MB when asked, in every format, refusing past either by name', () => {
        const count = 20_001;
        const json = JSON.stringify(
            Array.from({ length: count }, (_, at) => ({ start: at, end: at })),
        );
        const csv = Array.from(
            { length: count },
            (_, at) => `${at},${at}`,
        ).join('\n');
        const audacity = Array.from(
            { length: count },
            (_, at) => `${at}\t${at}\tL`,
        ).join('\n');
        const most = { maxItems: 20_000, maxSize: 5_242_880 };

        for (const text of [json, csv, audacity]) {
            expect(readRegions(text, most)).toHaveLength(20_000);
            expect(readMarkers(text, most)).toHaveLength(20_000);
        }

        expect(readMarkers(csv, { maxItems: 3 })).toHaveLength(3);
        expect(() => readRegions(csv, { maxItems: 20_001 })).toThrow(
            new RangeError(
                'sonicframe: maxItems goes past its most, 20000 (20001)',
            ),
        );
        expect(() => readMarkers(csv, { maxSize: 5_242_881 })).toThrow(
            'maxSize goes past its most, 5242880',
        );
    });

    it('refuses what is no text, JSON that is broken or no list, and a text over 512 KB', () => {
        expect(() => readRegions(3 as unknown as string)).toThrow(
            'no regions or markers file',
        );
        expect(() => readRegions('[{oops')).toThrow(TypeError);
        expect(() => readRegions('{"regions": 3}')).toThrow(TypeError);
        expect(() => readRegions('x'.repeat(524289))).toThrow(RangeError);
        expect(readRegions('')).toEqual([]);
    });
});

describe('readMarkers', () => {
    it('reads each format: a region file as its starts, and JSON with plain moments', () => {
        const written = writeRegions(
            [{ id: 'a', start: 1.5, end: 3, label: 'One' }],
            { format: 'csv' },
        );

        expect(readMarkers(written)).toEqual([
            { id: 'a', time: 1.5, label: 'One' },
        ]);
        expect(
            readMarkers('[2, {"time": 3, "label": "x"}, "y", -1, 1e999]'),
        ).toEqual([{ time: 2 }, { time: 3, label: 'x' }]);
        expect(readMarkers('{"markers": [4]}')).toEqual([{ time: 4 }]);
        expect(readMarkers('4.000000\t4.000000\tclap\n')).toEqual([
            { time: 4, label: 'clap' },
        ]);
        expect(
            readMarkers('WEBVTT\n\n00:00:04.000 --> 00:00:05.000\nclap\n'),
        ).toEqual([{ time: 4, label: 'clap' }]);
    });
});

/** Seconds to the thousandth, as every format keeps them. */
const seconds = fc.integer({ min: 0, max: 36_000_000 }).map((ms) => ms / 1000);

/** One safe line with the characters each format must take care of. */
const label = fc
    .array(
        fc
            .array(
                fc.constantFrom(...'ab9,;"\'=+-@&<>!?:/#ÁçÜ'.split(''), '-->'),
                { minLength: 1, maxLength: 6 },
            )
            .map((parts) => parts.join('')),
        { minLength: 1, maxLength: 4 },
    )
    .map((words) => words.join(' '));

const region = fc
    .record({
        startMs: fc.integer({ min: 0, max: 36_000_000 }),
        // A WebVTT cue lasts at least a thousandth (see writeRegions).
        lengthMs: fc.integer({ min: 1, max: 600_000 }),
        label: fc.option(label, { nil: undefined }),
        id: fc.option(
            fc
                .stringMatching(/^[a-z][a-z0-9-]{0,11}$/)
                .filter((id) => !id.includes('-->')),
            { nil: undefined },
        ),
        color: fc.option(fc.constantFrom('red', '#00ff0080', 'var(--x)'), {
            nil: undefined,
        }),
    })
    .map(({ startMs, lengthMs, label: text, id, color }) => {
        // Counted in thousandths and divided once, as the files write them.
        const made: RegionInput = {
            start: startMs / 1000,
            end: (startMs + lengthMs) / 1000,
        };

        if (text !== undefined) {
            made.label = text;
        }

        if (id !== undefined) {
            made.id = id;
        }

        if (color !== undefined) {
            made.color = color;
        }

        return made;
    });

/** The regions with only the fields a format keeps. */
function kept(regions: RegionInput[], fields: string[]): RegionInput[] {
    return regions.map((item) =>
        Object.fromEntries(
            Object.entries(item).filter(([name]) => fields.includes(name)),
        ),
    ) as RegionInput[];
}

describe('every format, written and read back', () => {
    it('gives back the same regions', () => {
        const all = ['start', 'end', 'label', 'color', 'id'];
        const cases = [
            { options: { format: 'json' as const }, fields: all },
            { options: { format: 'csv' as const }, fields: all },
            {
                options: {
                    format: 'csv' as const,
                    separator: ';' as const,
                    decimal: ',' as const,
                },
                fields: all,
            },
            {
                options: { format: 'csv' as const, separator: '\t' as const },
                fields: all,
            },
            {
                options: { format: 'vtt' as const },
                fields: ['start', 'end', 'label', 'id'],
            },
            {
                options: { format: 'audacity' as const },
                fields: ['start', 'end', 'label'],
            },
        ];

        fc.assert(
            fc.property(
                fc.array(region, { maxLength: 12 }).map((list) =>
                    // VTT keeps its cues in order of their starts; equal starts keep their order.
                    [...list].sort((a, b) => a.start - b.start),
                ),
                (regions) => {
                    for (const { options, fields } of cases) {
                        expect(
                            readRegions(writeRegions(regions, options)),
                            options.format,
                        ).toEqual(kept(regions, fields));
                    }
                },
            ),
        );
    });

    it('gives back the same markers', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        time: seconds,
                        label: fc.option(label, { nil: undefined }),
                    }),
                    { maxLength: 12 },
                ),
                (marks) => {
                    const given = marks.map(({ time, label: text }) =>
                        text === undefined ? { time } : { time, label: text },
                    );
                    const sorted = [...given].sort((a, b) => a.time - b.time);

                    for (const format of ['json', 'csv', 'audacity'] as const) {
                        expect(
                            readMarkers(writeMarkers(given, { format })),
                            format,
                        ).toEqual(given);
                    }

                    expect(
                        readMarkers(writeMarkers(given, { format: 'vtt' })),
                    ).toEqual(sorted);
                },
            ),
        );
    });
});
