/**
 * How a clock lays out a time: its fields (hours, minutes, seconds, then the decimals or the frame),
 * each with its least digits, and the text between them. A layout is built from the clock's
 * options, or read from a mask such as `'hh:mm:ss.SSS'`, where each letter is a field and its
 * repeats are its least digits: `h` the hours, `H` the hours from one hour on, `m` the minutes,
 * `s` the seconds, `S` the decimals and `f` the frame. Anything else is text, and `[...]` writes
 * its letters as text.
 */

import type { ClockDigits, ClockHours, ClockPrecision } from './clock';

/** A field of a layout. */
export type ClockField = 'h' | 'H' | 'm' | 's' | 'S' | 'f';

/** A field with its least digits, or text written as it is. */
export type ClockPiece =
    | { field: ClockField; digits: number }
    | { text: string };

export type ClockLayout = {
    pieces: readonly ClockPiece[];
    /** What the layout's last field counts: the seconds, the decimals' digits, or the frame. */
    precision: ClockPrecision;
    /**
     * Minutes take two digits under hours that show, and seconds two under minutes: the layout
     * built from options. A mask writes the digits it says.
     */
    snug: boolean;
};

/** The most characters a mask may have. */
const LONGEST_MASK = 40;

/** The most repeats of each letter: four digits, three for the decimals (milliseconds). */
const MOST: Readonly<Record<ClockField, number>> = {
    h: 4,
    H: 4,
    m: 4,
    s: 4,
    S: 3,
    f: 4,
};

/** Where each field goes: the hours first, the decimals or the frame last. */
const RANK: Readonly<Record<ClockField, number>> = {
    h: 0,
    H: 0,
    m: 1,
    s: 2,
    S: 3,
    f: 3,
};

const BY_DECIMALS: readonly ClockPrecision[] = [
    'tenths',
    'hundredths',
    'milliseconds',
];

/** The decimals' digits of each precision that has them. */
export const DECIMAL_DIGITS: Readonly<Partial<Record<ClockPrecision, number>>> =
    { tenths: 1, hundredths: 2, milliseconds: 3 };

function isField(char: string): char is ClockField {
    return Object.hasOwn(MOST, char);
}

function isText(piece: ClockPiece): piece is { text: string } {
    return 'text' in piece;
}

/** The mask's pieces, side by side texts joined; null for an open `[` or a letter repeated past its most. */
function piecesOf(mask: string): ClockPiece[] | null {
    const pieces: ClockPiece[] = [];
    const text = (value: string): void => {
        const last = pieces.at(-1);

        if (last !== undefined && isText(last)) {
            pieces[pieces.length - 1] = { text: last.text + value };
        } else {
            pieces.push({ text: value });
        }
    };
    let at = 0;

    while (at < mask.length) {
        const char = mask[at];

        if (char === '[') {
            const end = mask.indexOf(']', at + 1);

            if (end < 0) {
                return null;
            }

            text(mask.slice(at + 1, end));
            at = end + 1;
        } else if (isField(char)) {
            let run = 1;

            while (mask[at + run] === char) {
                run += 1;
            }

            if (run > MOST[char]) {
                return null;
            }

            pieces.push({ field: char, digits: run });
            at += run;
        } else {
            text(char);
            at += 1;
        }
    }

    return pieces;
}

/**
 * A mask read into a layout, or null when it is not one: empty or longer than 40 characters, an
 * open `[`, a letter repeated past its most, no seconds, minutes missing under hours, a field
 * twice, both `h` and `H` or both decimals and a frame, or fields out of their order.
 */
export function readClockMask(mask: string): ClockLayout | null {
    if (mask.length === 0 || mask.length > LONGEST_MASK) {
        return null;
    }

    const pieces = piecesOf(mask);

    if (pieces === null) {
        return null;
    }

    const fields = pieces.filter((piece) => !isText(piece)) as {
        field: ClockField;
        digits: number;
    }[];
    const has = (field: ClockField): boolean =>
        fields.some((piece) => piece.field === field);
    const ranks = fields.map((piece) => RANK[piece.field]);
    const ordered = ranks.every((rank, at) => at === 0 || rank > ranks[at - 1]);

    if (!ordered || !has('s') || ((has('h') || has('H')) && !has('m'))) {
        return null;
    }

    const decimals = fields.find((piece) => piece.field === 'S');

    return {
        pieces,
        precision: has('f')
            ? 'frames'
            : decimals !== undefined
              ? BY_DECIMALS[decimals.digits - 1]
              : 'seconds',
        snug: false,
    };
}

/**
 * The layout the options give: the hours (always with `'always'`, and with `'auto'` for a frame,
 * as a timecode writes them; otherwise from one hour on), the minutes, the seconds, then the
 * decimals after `decimal` or the frame after a colon.
 */
export function optionsLayout(
    precision: ClockPrecision,
    hours: ClockHours,
    digits: ClockDigits,
    decimal: string,
): ClockLayout {
    const always =
        hours === 'always' || (hours === 'auto' && precision === 'frames');
    const pieces: ClockPiece[] = [
        { field: always ? 'h' : 'H', digits: digits.hours },
        { text: ':' },
        { field: 'm', digits: digits.minutes },
        { text: ':' },
        { field: 's', digits: digits.seconds },
    ];

    if (precision === 'frames') {
        pieces.push({ text: ':' }, { field: 'f', digits: digits.frames });
    } else if (precision !== 'seconds') {
        pieces.push(
            { text: decimal },
            { field: 'S', digits: DECIMAL_DIGITS[precision] ?? 1 },
        );
    }

    return { pieces, precision, snug: true };
}

/** The parts of a time a layout writes: whole hours, minutes, seconds, and the decimals or frame. */
export type ClockValues = {
    hours: number;
    minutes: number;
    seconds: number;
    part: number;
};

/**
 * The layout written with `values`; `width` gives each field's least digits (the layout's own,
 * or a mold's). Hours from one hour on (`H`) and the text after them are left out below an hour.
 */
export function writeLayout(
    layout: ClockLayout,
    values: ClockValues,
    width: (field: ClockField, digits: number) => number,
    digit: (value: number, digits: number) => string,
): string {
    let out = '';
    let skipping = false;

    for (const piece of layout.pieces) {
        if (isText(piece)) {
            out += skipping ? '' : piece.text;
            continue;
        }

        skipping = piece.field === 'H' && values.hours === 0;

        if (!skipping) {
            out += digit(
                valueOf(piece.field, values),
                width(piece.field, piece.digits),
            );
        }
    }

    return out;
}

function valueOf(field: ClockField, values: ClockValues): number {
    switch (field) {
        case 'h':
        case 'H':
            return values.hours;
        case 'm':
            return values.minutes;
        case 's':
            return values.seconds;
        default:
            return values.part;
    }
}

/** Whether the layout has a field for the hours, and one for the minutes. */
export function fieldsOf(layout: ClockLayout): {
    hours: boolean;
    minutes: boolean;
} {
    const has = (fields: ClockField[]): boolean =>
        layout.pieces.some(
            (piece) => !isText(piece) && fields.includes(piece.field),
        );

    return { hours: has(['h', 'H']), minutes: has(['m']) };
}
