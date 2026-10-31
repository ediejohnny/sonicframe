/**
 * Text handling for captions and tooltips, kept pure so it is tested in Node and the same cut runs
 * everywhere. `cleanText` makes an untrusted string safe to drop into the page (no control or
 * bidi-override characters, one line, a hard length cap applied early); `truncateWords` shortens to
 * a limit at a word boundary and marks the cut, never splitting a character.
 */

let segmenter: Intl.Segmenter | null = null;

/** The string as an array of user-perceived characters, so a slice never splits one. */
function graphemes(text: string): string[] {
    // Lazily, so merely importing the library never throws where Intl.Segmenter is missing.
    segmenter ??= new Intl.Segmenter('und', { granularity: 'grapheme' });

    return Array.from(segmenter.segment(text), (part) => part.segment);
}

/**
 * Control characters (C0 and C1), zero-width and bidi marks, the bidi embedding / override / isolate
 * formatting characters, the Arabic letter mark, soft hyphen, the CGJ, interlinear annotations and
 * the invisible tag characters: none belong in a one-line caption, and several can reorder or hide
 * the text around them on the page.
 */
function isUnsafe(codePoint: number): boolean {
    return (
        codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f) ||
        codePoint === 0x00ad ||
        codePoint === 0x034f ||
        codePoint === 0x061c ||
        (codePoint >= 0x200b && codePoint <= 0x200f) ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2060 && codePoint <= 0x2064) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069) ||
        codePoint === 0xfeff ||
        (codePoint >= 0xfff9 && codePoint <= 0xfffb) ||
        (codePoint >= 0xe0000 && codePoint <= 0xe007f)
    );
}

/** A one-line, control- and bidi-safe version of `text`, capped to `max` characters. */
export function cleanText(text: string, max: number): string {
    const limit = Math.max(0, Math.floor(max));
    // Cap the raw input first (code units, generously), so a huge string is never fully scanned.
    const raw = text.length > limit * 8 ? text.slice(0, limit * 8) : text;
    let stripped = '';

    for (const character of raw) {
        stripped += isUnsafe(character.codePointAt(0) ?? 0) ? ' ' : character;
    }

    const clean = stripped.replace(/\s+/g, ' ').trim();
    const chars = graphemes(clean);
    const cut = chars.length <= limit ? clean : chars.slice(0, limit).join('');

    // A single grapheme can still carry many combining marks; cap code units too.
    return cut.length > limit * 8 ? cut.slice(0, limit * 8) : cut;
}

/**
 * `template` with each `{name}` mark replaced by its value. Only the values' own names count (never
 * one inherited from the object prototype, such as `constructor`); any other mark is dropped.
 */
export function fillTemplate(
    template: string,
    values: Readonly<Record<string, string>>,
): string {
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        Object.hasOwn(values, name) ? values[name] : '',
    );
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
