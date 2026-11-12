/**
 * A small XML reader for feeds, without the page: elements, their attributes and their text, nothing
 * else. Comments, processing instructions and a doctype are skipped; CDATA is text; the five named
 * entities and numeric ones are read. A doctype that declares entities is refused, so no text grows
 * without end. It scans the text once with `indexOf` (no regular expression over the text), refuses
 * what is not well formed (an unclosed tag, a closing tag that does not match), and keeps to the
 * ceilings of `xml-limits.ts`: nesting, elements, attributes and name lengths.
 */

import { characterReference } from '../shared/character-reference';
import { pastLimit, xmlLimits, type ReadXmlOptions } from './xml-limits';

/** An element: its name as written (`itunes:image`), its attributes and its children. */
export type XmlElement = {
    readonly name: string;
    readonly attributes: ReadonlyMap<string, string>;
    readonly children: XmlElement[];
    /** Its own text, its children's left out (a feed reads the text of the innermost elements). */
    text: string;
};

const NAMED: Readonly<Record<string, string>> = {
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: "'",
};

function malformed(what: string): SyntaxError {
    return new SyntaxError(`sonicframe: the XML is not well formed (${what})`);
}

/** `text` with its entities read; an unknown one stays as written. */
function decode(text: string): string {
    let out = '';
    // `copied` is where the text not yet in `out` starts; `at` is where the next `&` is looked for.
    let copied = 0;
    let at = 0;
    // The first `;` at or after `at`, found again only once passed, so the text is searched once.
    let semi = -1;

    for (;;) {
        const amp = text.indexOf('&', at);

        if (amp < 0) {
            return out + text.slice(copied);
        }

        if (semi !== Infinity && semi <= amp) {
            const next = text.indexOf(';', amp + 1);
            semi = next < 0 ? Infinity : next;
        }

        // A reference's name is at most 10 characters.
        const char =
            semi - amp > 11
                ? undefined
                : characterReference(text.slice(amp + 1, semi), NAMED);

        at = amp + 1;

        if (char !== undefined) {
            out += text.slice(copied, amp) + char;
            at = semi + 1;
            copied = at;
        }
    }
}

const SPACE = ' \t\r\n';

/** The attributes of every element that has none, shared. */
const NO_ATTRIBUTES: ReadonlyMap<string, string> = new Map();

/** The attributes written in a start tag's inside (after its name). */
function attributesOf(
    inside: string,
    limits: Required<ReadXmlOptions>,
): ReadonlyMap<string, string> {
    if (!inside.includes('=')) {
        return NO_ATTRIBUTES;
    }

    const attributes = new Map<string, string>();
    let written = 0;
    let at = 0;

    while (at < inside.length) {
        while (at < inside.length && SPACE.includes(inside[at])) {
            at += 1;
        }

        const equals = inside.indexOf('=', at);

        if (equals < 0) {
            break;
        }

        const name = inside.slice(at, equals).trim();
        let open = equals + 1;

        while (open < inside.length && SPACE.includes(inside[open])) {
            open += 1;
        }

        const quote = inside[open];

        if (quote !== '"' && quote !== "'") {
            throw malformed('an attribute without quotes');
        }

        const close = inside.indexOf(quote, open + 1);

        if (close < 0) {
            throw malformed('an unclosed attribute');
        }

        written += 1;

        if (written > limits.maxAttributes) {
            throw pastLimit('maxAttributes', limits.maxAttributes);
        }

        if (name.length > limits.maxNameLength) {
            throw pastLimit('maxNameLength', limits.maxNameLength);
        }

        if (name !== '' && !attributes.has(name)) {
            attributes.set(name, decode(inside.slice(open + 1, close)));
        }

        at = close + 1;
    }

    return attributes;
}

/** `!` and `?`, after a `<`. */
const BANG = 0x21;
const QUESTION = 0x3f;

/** `[`, which opens a doctype's internal subset. */
const BRACKET = 0x5b;

/**
 * Where the declaration at `lt` (`<!DOCTYPE …>`, or one with an internal subset ending at `]>`)
 * ends; refused when it is unclosed or declares entities.
 */
function declarationEnd(text: string, lt: number): number {
    const gt = text.indexOf('>', lt);
    let bracket = lt;

    while (bracket < gt && text.charCodeAt(bracket) !== BRACKET) {
        bracket += 1;
    }

    const subset = bracket < gt;
    const end = subset ? text.indexOf(']>', bracket) + 1 : gt;

    if (end <= 0) {
        throw malformed('an unclosed doctype');
    }

    // Entities are declared in a doctype's subset, or (not well formed) on their own.
    const declares = subset
        ? text.slice(lt, end).toUpperCase().includes('<!ENTITY')
        : text.startsWith('<!ENTITY', lt);

    if (declares) {
        throw new TypeError('sonicframe: a feed may not declare entities');
    }

    return end;
}

/** The element a start tag's inside (between `<` and `>`, without a closing `/`) opens. */
function elementOf(body: string, limits: Required<ReadXmlOptions>): XmlElement {
    let nameEnd = 0;

    while (nameEnd < body.length && !SPACE.includes(body[nameEnd])) {
        nameEnd += 1;
    }

    if (nameEnd === 0) {
        throw malformed('a tag without a name');
    }

    if (nameEnd > limits.maxNameLength) {
        throw pastLimit('maxNameLength', limits.maxNameLength);
    }

    return {
        name: body.slice(0, nameEnd),
        attributes: attributesOf(body.slice(nameEnd), limits),
        children: [],
        text: '',
    };
}

/**
 * The root element of `text`; refused when it is not well formed (`SyntaxError`), declares entities
 * (`TypeError`) or goes past a ceiling (`RangeError`).
 */
export function readXml(
    text: string,
    options: ReadXmlOptions = {},
): XmlElement {
    const limits = xmlLimits(options);
    const stack: XmlElement[] = [];
    let root: XmlElement | null = null;
    let elements = 0;
    let at = 0;

    const addText = (piece: string): void => {
        const open = stack.at(-1);

        if (open !== undefined) {
            open.text += piece;
        }
    };

    while (at < text.length) {
        const lt = text.indexOf('<', at);

        if (lt < 0) {
            addText(decode(text.slice(at)));
            break;
        }

        if (lt > at) {
            addText(decode(text.slice(at, lt)));
        }

        // The character after `<` tells a tag from the rest, without comparing whole words each time.
        const kind = text.charCodeAt(lt + 1);

        if (kind === QUESTION) {
            const end = text.indexOf('?>', lt + 2);
            at = end < 0 ? text.length : end + 2;
        } else if (kind === BANG && text.startsWith('<!--', lt)) {
            const end = text.indexOf('-->', lt + 4);
            at = end < 0 ? text.length : end + 3;
        } else if (kind === BANG && text.startsWith('<![CDATA[', lt)) {
            const end = text.indexOf(']]>', lt + 9);

            if (end < 0) {
                throw malformed('an unclosed CDATA');
            }

            addText(text.slice(lt + 9, end));
            at = end + 3;
        } else if (kind === BANG) {
            at = declarationEnd(text, lt) + 1;
        } else {
            const gt = text.indexOf('>', lt);

            if (gt < 0) {
                throw malformed('an unclosed tag');
            }

            const inside = text.slice(lt + 1, gt);

            if (inside.startsWith('/')) {
                const open = stack.pop();
                const closing = inside.slice(1).trim();

                if (open?.name !== closing) {
                    throw malformed('a closing tag that does not match');
                }
            } else {
                elements += 1;

                if (elements > limits.maxElements) {
                    throw pastLimit('maxElements', limits.maxElements);
                }

                const selfClosing = inside.endsWith('/');
                const element = elementOf(
                    selfClosing ? inside.slice(0, -1) : inside,
                    limits,
                );
                const parent = stack.at(-1);

                if (parent !== undefined) {
                    parent.children.push(element);
                } else if (root === null) {
                    root = element;
                } else {
                    throw malformed('more than one root');
                }

                if (!selfClosing) {
                    if (stack.length >= limits.maxDepth) {
                        throw pastLimit('maxDepth', limits.maxDepth);
                    }

                    stack.push(element);
                }
            }

            at = gt + 1;
        }
    }

    if (root === null || stack.length > 0) {
        throw malformed(root === null ? 'no element' : 'an unclosed element');
    }

    return root;
}
