import { describe, expect, it } from 'vite-plus/test';
import {
    csvLine,
    csvRows,
    csvSeparator,
    guardCell,
    unguardCell,
} from '../../../src/core/marks/csv';

describe('csvRows', () => {
    it('reads cells between separators, quoted ones with their separators, quotes and line breaks', () => {
        const text = 'start,end,label\n1,2,"a, ""b"""\n3,4,"two\nlines"\n5,,\n';

        expect(csvRows(text, ',')).toEqual([
            ['start', 'end', 'label'],
            ['1', '2', 'a, "b"'],
            ['3', '4', 'two\nlines'],
            ['5', '', ''],
        ]);
    });

    it('reads by the separator asked, and skips empty lines', () => {
        expect(csvRows('1;2;a,b\n\n3;4;"c;d"', ';')).toEqual([
            ['1', '2', 'a,b'],
            ['3', '4', 'c;d'],
        ]);
        expect(csvRows('1\t2\tx', '\t')).toEqual([['1', '2', 'x']]);
    });
});

describe('csvLine', () => {
    it('quotes a cell only when it holds the separator, a quote or a line break, doubling its quotes', () => {
        expect(csvLine(['8.5', 'Verse, "one"', 'plain', ''], ',')).toBe(
            '8.5,"Verse, ""one""",plain,',
        );
        expect(csvLine(['a,b', 'c;d'], ';')).toBe('a,b;"c;d"');
    });

    it('is read back cell for cell', () => {
        const cells = ['a, "b"', 'c;d', 'e\tf', "'g", ''];

        for (const separator of [',', ';', '\t'] as const) {
            expect(
                csvRows(`${csvLine(cells, separator)}\n`, separator),
                separator,
            ).toEqual([cells.map((cell) => cell)]);
        }
    });
});

describe('csvSeparator', () => {
    it('picks the separator the first line uses most, outside quotes, and a comma by default', () => {
        expect(csvSeparator('start;end;label')).toBe(';');
        expect(csvSeparator('start\tend\tlabel')).toBe('\t');
        expect(csvSeparator('start,end,"a;b;c"')).toBe(',');
        expect(csvSeparator('start')).toBe(',');
    });
});

describe('guardCell and unguardCell', () => {
    it('write a quote before a cell a spreadsheet would read as a formula, and take it back', () => {
        const cases: [string, string][] = [
            ['=SUM(A1)', "'=SUM(A1)"],
            ['+1', "'+1"],
            ['-5 dB', "'-5 dB"],
            ['@user', "'@user"],
            ["'=x", "''=x"],
            ["'plain", "'plain"],
            ['plain', 'plain'],
            ['', ''],
        ];

        for (const [cell, guarded] of cases) {
            expect(guardCell(cell), cell).toBe(guarded);
            expect(unguardCell(guarded), guarded).toBe(cell);
        }
    });
});
