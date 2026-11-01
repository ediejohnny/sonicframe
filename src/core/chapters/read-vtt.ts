/**
 * The cues of a WebVTT file, read as the specification's parser reads them: the timestamps, an
 * identifier and cue settings allowed, the text without its tags and with its character references
 * decoded, and the blocks that are no cue (comments, style sheets, regions) skipped. Nothing here
 * touches the page.
 */

/** A cue, in seconds, with its text on one line. */
export type VttCue = { start: number; end: number; title: string };

/**
 * A WebVTT timestamp in seconds, read as the specification's parser reads it, or null: `h:mm:ss.ttt`
 * (hours of any length) or `mm:ss.ttt`, where a first part that is not two digits up to 59 counts
 * as hours and then needs the seconds after it.
 */
function timestamp(text: string): number | null {
    const match = /^(\d+):(\d{2})(?::(\d{2}))?\.(\d{3})$/.exec(text);

    if (match === null) {
        return null;
    }

    const [, first, second, third, thousandths] = match;
    const hoursFirst = first.length !== 2 || Number(first) > 59;

    if (hoursFirst && third === undefined) {
        return null;
    }

    const [hours, minutes, seconds] =
        third === undefined
            ? [0, Number(first), Number(second)]
            : [Number(first), Number(second), Number(third)];

    if (minutes > 59 || seconds > 59) {
        return null;
    }

    // Counted in whole thousandths and divided once, the time is the nearest number to the one
    // written; adding the thousandths to the seconds would leave float noise (1.5030000000000001).
    const thousandthsInAll =
        ((hours * 60 + minutes) * 60 + seconds) * 1000 + Number(thousandths);

    return thousandthsInAll / 1000;
}

const ENTITIES: Readonly<Record<string, string>> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
    lrm: '\u200e',
    rlm: '\u200f',
};

/** A code point as text, or the replacement character when it is not a character. */
function character(code: number): string {
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code)
        : '\ufffd';
}

/** A cue's text without its tags, with its character references decoded (after, so `&lt;b&gt;` stays text). */
function cueText(lines: readonly string[]): string {
    return lines
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .replace(
            /&(?:#x([0-9a-f]{1,6})|#(\d{1,7})|([a-z]+));/gi,
            (whole, hex?: string, decimal?: string, name?: string) => {
                if (hex !== undefined) {
                    return character(parseInt(hex, 16));
                }

                if (decimal !== undefined) {
                    return character(Number(decimal));
                }

                return ENTITIES[(name ?? '').toLowerCase()] ?? whole;
            },
        );
}

/** A timing line: two timestamps around an arrow, then any cue settings. */
const TIMING = /^[ \t]*([\d:.]+)[ \t]*-->[ \t]*([\d:.]+)(?:[ \t].*)?$/;

/** A block that is no cue: a comment, a style sheet or a region. */
const NOT_A_CUE = /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/;

/**
 * The cues of a WebVTT text whose lines end in `\n`, in the order written. A cue without a timing
 * line, or one that ends before it starts, is left out, as the specification's parser leaves it.
 */
export function readVtt(text: string): VttCue[] {
    const blocks = text.split(/\n{2,}/);
    const cues: VttCue[] = [];

    // The first block is the header (`WEBVTT` and anything after it on its lines).
    for (const block of blocks.slice(1)) {
        const lines = block.split('\n');

        if (NOT_A_CUE.test(lines[0])) {
            continue;
        }

        // An identifier may come first; the timing line is the first or the second.
        const at = lines[0].includes('-->') ? 0 : 1;
        const timing = TIMING.exec(lines[at] ?? '');

        if (timing === null) {
            continue;
        }

        const start = timestamp(timing[1]);
        const end = timestamp(timing[2]);

        if (start === null || end === null || end <= start) {
            continue;
        }

        const payload: string[] = [];

        for (const line of lines.slice(at + 1)) {
            if (line.includes('-->')) {
                break;
            }

            payload.push(line);
        }

        cues.push({ start, end, title: cueText(payload) });
    }

    return cues;
}
