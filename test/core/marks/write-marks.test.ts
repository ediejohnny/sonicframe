/**
 * Regions and markers written as files: JSON, WebVTT, CSV and Audacity labels, each compared with the
 * file written by hand.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { Mark } from '../../../src/core/marks/markers';
import type { RegionInput } from '../../../src/core/marks/regions';
import {
    writeMarkers,
    writeRegions,
} from '../../../src/core/marks/write-marks';

const REGIONS: RegionInput[] = [
    {
        id: 'verse',
        start: 8.5,
        end: 16,
        label: 'Verse, "one"',
        color: '#ff000040',
    },
    { start: 61.25, end: 3725.002, label: '=SUM(A1)' },
];

const MARKS: (number | Mark)[] = [
    { time: 2.4, label: 'Title' },
    { time: 9, label: 'Second line', color: 'red', id: 'm2' },
    21,
];

describe('writeRegions', () => {
    it('writes JSON by default: only the known fields, in a list', () => {
        expect(writeRegions(REGIONS)).toBe(
            [
                '[',
                '  {',
                '    "id": "verse",',
                '    "start": 8.5,',
                '    "end": 16,',
                '    "label": "Verse, \\"one\\"",',
                '    "color": "#ff000040"',
                '  },',
                '  {',
                '    "start": 61.25,',
                '    "end": 3725.002,',
                '    "label": "=SUM(A1)"',
                '  }',
                ']',
                '',
            ].join('\n'),
        );
    });

    it('writes WebVTT: the ids as identifiers, the cues in order of their starts', () => {
        expect(writeRegions([REGIONS[1], REGIONS[0]], { format: 'vtt' })).toBe(
            [
                'WEBVTT',
                '',
                'verse',
                '00:00:08.500 --> 00:00:16.000',
                'Verse, "one"',
                '',
                '00:01:01.250 --> 01:02:05.002',
                '=SUM(A1)',
                '',
            ].join('\n'),
        );
    });

    it('writes CSV with a header, the quotes it needs and the formulas guarded', () => {
        expect(writeRegions(REGIONS, { format: 'csv' })).toBe(
            [
                'start,end,label,color,id',
                '8.5,16,"Verse, ""one""",#ff000040,verse',
                "61.25,3725.002,'=SUM(A1),,",
                '',
            ].join('\r\n'),
        );
    });

    it('writes CSV for a spreadsheet that reads semicolons and decimal commas, and without the guard when asked', () => {
        expect(
            writeRegions(REGIONS, {
                format: 'csv',
                separator: ';',
                decimal: ',',
                guardFormulas: false,
            }),
        ).toBe(
            [
                'start;end;label;color;id',
                '8,5;16;"Verse, ""one""";#ff000040;verse',
                '61,25;3725,002;=SUM(A1);;',
                '',
            ].join('\r\n'),
        );
    });

    it("writes Audacity's labels: start, end and label by tabs, to six decimals", () => {
        expect(writeRegions(REGIONS, { format: 'audacity' })).toBe(
            [
                '8.500000\t16.000000\tVerse, "one"',
                '61.250000\t3725.002000\t=SUM(A1)',
                '',
            ].join('\n'),
        );
    });

    it('leaves out a region whose times are not numbers, and an id WebVTT would not read as one', () => {
        const odd: RegionInput[] = [
            { start: Number.NaN, end: 2 },
            { start: 1, end: Number.NaN },
            { id: 'NOTE this', start: 1, end: 2 },
            { id: 'a --> b', start: 3, end: 4 },
            { id: ' ', start: 5, end: 6 },
            { id: 'NOTEBOOK', start: 7, end: 8 },
        ];

        expect(writeRegions(odd, { format: 'vtt' })).toBe(
            [
                'WEBVTT',
                '',
                '00:00:01.000 --> 00:00:02.000',
                '',
                '00:00:03.000 --> 00:00:04.000',
                '',
                '00:00:05.000 --> 00:00:06.000',
                '',
                'NOTEBOOK',
                '00:00:07.000 --> 00:00:08.000',
                '',
            ].join('\n'),
        );
        expect(writeRegions([], { format: 'vtt' })).toBe('WEBVTT\n');
        expect(writeRegions(odd, { format: 'audacity' })).toBe(
            [
                '1.000000\t2.000000\t',
                '3.000000\t4.000000\t',
                '5.000000\t6.000000\t',
                '7.000000\t8.000000\t',
                '',
            ].join('\n'),
        );
    });

    it('writes each label on one line, and no text field that is empty or no text', () => {
        const regions = [
            {
                start: 1,
                end: 2,
                label: ' two\nlines\tand a tab ',
                id: '',
                color: 7 as unknown as string,
            },
        ];

        expect(JSON.parse(writeRegions(regions))).toEqual([
            { start: 1, end: 2, label: ' two\nlines\tand a tab ' },
        ]);
        expect(writeRegions(regions, { format: 'vtt' })).toBe(
            'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\ntwo lines\tand a tab\n',
        );
        expect(writeRegions(regions, { format: 'audacity' })).toBe(
            '1.000000\t2.000000\t two lines and a tab \n',
        );
        expect(writeRegions(regions, { format: 'csv' })).toBe(
            'start,end,label,color,id\r\n1,2," two\nlines\tand a tab ",,\r\n',
        );
    });

    it('writes CSV times to the thousandth, and guards the color and the id too', () => {
        expect(
            writeRegions(
                [{ start: 1.23456, end: 2.0004, color: '+x', id: '@intro' }],
                { format: 'csv' },
            ),
        ).toBe("start,end,label,color,id\r\n1.235,2,,'+x,'@intro\r\n");
    });

    it('gives a WebVTT cue of no length a thousandth, since a cue ends after it starts', () => {
        expect(writeRegions([{ start: 1, end: 1 }], { format: 'vtt' })).toBe(
            'WEBVTT\n\n00:00:01.000 --> 00:00:01.001\n',
        );
    });
});

describe('writeMarkers', () => {
    it('writes JSON by default, a plain moment as one with only its time, leaving out a time that is no number', () => {
        expect(
            JSON.parse(
                writeMarkers([...MARKS, Number.NaN, { time: Number.NaN }]),
            ),
        ).toEqual([
            { time: 2.4, label: 'Title' },
            { id: 'm2', time: 9, label: 'Second line', color: 'red' },
            { time: 21 },
        ]);
    });

    it('writes WebVTT with each marker until the next, and the last until the end of the sound', () => {
        expect(writeMarkers(MARKS, { format: 'vtt', duration: 30 })).toBe(
            [
                'WEBVTT',
                '',
                '00:00:02.400 --> 00:00:09.000',
                'Title',
                '',
                'm2',
                '00:00:09.000 --> 00:00:21.000',
                'Second line',
                '',
                '00:00:21.000 --> 00:00:30.000',
                '',
            ].join('\n'),
        );
    });

    it('lets the last marker last a second when the length is not given, or not after it', () => {
        const second = 'WEBVTT\n\n00:00:05.000 --> 00:00:06.000\n';

        expect(writeMarkers([5], { format: 'vtt', duration: 3 })).toBe(second);
        expect(
            writeMarkers([5], {
                format: 'vtt',
                duration: Number.POSITIVE_INFINITY,
            }),
        ).toBe(second);
    });

    it('lets a marker last until the next later one, skipping one at the same moment', () => {
        expect(
            writeMarkers([5, { time: 5, label: 'Again' }, 3], {
                format: 'vtt',
            }),
        ).toBe(
            [
                'WEBVTT',
                '',
                '00:00:03.000 --> 00:00:05.000',
                '',
                '00:00:05.000 --> 00:00:06.000',
                '',
                '00:00:05.000 --> 00:00:06.000',
                'Again',
                '',
            ].join('\n'),
        );
    });

    it('writes CSV with the time column, and Audacity point labels', () => {
        expect(writeMarkers(MARKS, { format: 'csv' })).toBe(
            [
                'time,label,color,id',
                '2.4,Title,,',
                '9,Second line,red,m2',
                '21,,,',
                '',
            ].join('\r\n'),
        );
        expect(writeMarkers(MARKS, { format: 'audacity' })).toBe(
            [
                '2.400000\t2.400000\tTitle',
                '9.000000\t9.000000\tSecond line',
                '21.000000\t21.000000\t',
                '',
            ].join('\n'),
        );
    });
});
