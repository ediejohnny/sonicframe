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
            { id: 'NOTE this', start: 1, end: 2 },
            { id: 'a --> b', start: 3, end: 4 },
        ];

        expect(writeRegions(odd, { format: 'vtt' })).toBe(
            [
                'WEBVTT',
                '',
                '00:00:01.000 --> 00:00:02.000',
                '',
                '00:00:03.000 --> 00:00:04.000',
                '',
            ].join('\n'),
        );
        expect(writeRegions([], { format: 'vtt' })).toBe('WEBVTT\n');
        expect(writeRegions(odd, { format: 'audacity' })).toBe(
            '1.000000\t2.000000\t\n3.000000\t4.000000\t\n',
        );
    });

    it('gives a WebVTT cue of no length a thousandth, since a cue ends after it starts', () => {
        expect(writeRegions([{ start: 1, end: 1 }], { format: 'vtt' })).toBe(
            'WEBVTT\n\n00:00:01.000 --> 00:00:01.001\n',
        );
    });
});

describe('writeMarkers', () => {
    it('writes JSON by default, a plain moment as one with only its time', () => {
        expect(JSON.parse(writeMarkers(MARKS))).toEqual([
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

    it('lets the last marker last a second when the length is not given, and skips a marker at the same moment', () => {
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
