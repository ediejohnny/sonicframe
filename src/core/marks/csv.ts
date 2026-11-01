/**
 * CSV cells as RFC 4180 writes them: a cell holding the separator, a quote or a line break goes in
 * quotes, its quotes doubled. A cell a spreadsheet would read as a formula (starting with `=`, `+`,
 * `-`, `@`, a tab or a carriage return) can be guarded with a leading `'`, and the guard taken back.
 */

/** What separates the cells of a line. */
export type CsvSeparator = ',' | ';' | '\t';

/** A cell a spreadsheet would run, behind any quotes already guarding it. */
const FORMULA = /^'*[=+\-@\t\r]/;

/** The cells of each line of `text` (lines ending in `\n`), with empty lines left out. */
export function csvRows(text: string, separator: CsvSeparator): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    let at = 0;

    const endRow = (): void => {
        row.push(cell);

        if (row.length > 1 || row[0] !== '') {
            rows.push(row);
        }

        row = [];
        cell = '';
    };

    while (at < text.length) {
        const character = text[at];

        if (quoted) {
            if (character === '"' && text[at + 1] === '"') {
                cell += '"';
                at += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                cell += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === separator) {
            row.push(cell);
            cell = '';
        } else if (character === '\n') {
            endRow();
        } else {
            cell += character;
        }

        at += 1;
    }

    if (cell !== '' || row.length > 0) {
        endRow();
    }

    return rows;
}

/** One line of cells, each quoted when it holds the separator, a quote or a line break. */
export function csvLine(
    cells: readonly string[],
    separator: CsvSeparator,
): string {
    return cells
        .map((cell) =>
            cell.includes(separator) || /["\n\r]/.test(cell)
                ? `"${cell.replace(/"/g, '""')}"`
                : cell,
        )
        .join(separator);
}

/** The separator a first line uses most, outside quotes; a comma when it uses none. */
export function csvSeparator(firstLine: string): CsvSeparator {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let quoted = false;

    for (const character of firstLine) {
        if (character === '"') {
            quoted = !quoted;
        } else if (!quoted && character in counts) {
            counts[character as CsvSeparator] += 1;
        }
    }

    const most = (Object.keys(counts) as CsvSeparator[]).reduce((best, next) =>
        counts[next] > counts[best] ? next : best,
    );

    return counts[most] > 0 ? most : ',';
}

/** A cell with a `'` before it when a spreadsheet would read it as a formula. */
export function guardCell(cell: string): string {
    return FORMULA.test(cell) ? `'${cell}` : cell;
}

/** A guarded cell as it was: the `'` that `guardCell` added taken back. */
export function unguardCell(cell: string): string {
    return /^'+[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell;
}
