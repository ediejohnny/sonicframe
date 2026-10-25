/**
 * Text handling for captions and tooltips, kept pure so it is tested in Node and the same cut runs
 * everywhere. `cleanText` makes an untrusted string safe to drop into the page (no control or
 * bidi-override characters, one line, a hard length cap); `truncateWords` shortens to a limit at a
 * word boundary and marks the cut, never splitting a character.
 */

const SEGMENTER = new Intl.Segmenter('und', { granularity: 'grapheme' });

/** The string as an array of user-perceived characters, so a slice never splits one. */
function graphemes(text: string): string[] {
    return Array.from(SEGMENTER.segment(text), (part) => part.segment);
}

/**
 * Control characters (C0 and C1), zero-width and bidi marks, and the bidi embedding / override /
 * isolate formatting characters: none belong in a one-line caption, and the overrides could reorder
 * the text around it on the page.
 */
function isUnsafe(codePoint: number): boolean {
    return (
        codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f) ||
        (codePoint >= 0x200b && codePoint <= 0x200f) ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2060 && codePoint <= 0x2064) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069) ||
        codePoint === 0xfeff
    );
}

/** A one-line, control- and bidi-safe version of `text`, capped to `max` characters. */
export function cleanText(text: string, max: number): string {
    let stripped = '';

    for (const character of text) {
        stripped += isUnsafe(character.codePointAt(0) ?? 0) ? ' ' : character;
    }

    const clean = stripped.replace(/\s+/g, ' ').trim();
    const chars = graphemes(clean);

    return chars.length <= max ? clean : chars.slice(0, max).join('');
}

/**
 * Shortens `text` to at most `limit` characters, cutting at the last word boundary that fits and
 * adding `ellipsis`. Text without spaces (as in many scripts) is cut at a character boundary.
 */
export function truncateWords(
    text: string,
    limit: number,
    ellipsis: string = ' (...)',
): string {
    const chars = graphemes(text);

    if (chars.length <= limit) {
        return text;
    }

    const head = chars.slice(0, limit).join('');
    let cut = head;

    // When the first dropped character is a space, the last word fit whole; otherwise step back to
    // the previous space (or, with no space at all, cut mid-word).
    if (!/\s/.test(chars[limit] ?? '')) {
        const lastSpace = head.search(/\s\S*$/);
        cut = lastSpace > 0 ? head.slice(0, lastSpace) : head;
    }

    return cut.trimEnd() + ellipsis;
}
