/**
 * Character references, shared by the text readers: `#x41` and `#65` give their character (U+FFFD when
 * the number is no character), a name gives the reader's own table's character, and anything else is
 * undefined, for the reader to leave as written. A name is looked up in the table itself only, never
 * in what every object inherits (`constructor`, `__proto__`).
 */

const HEX = /^#x([0-9a-f]{1,6})$/i;
const DECIMAL = /^#(\d{1,7})$/;

/** A code point as text, or the replacement character when it is not a character. */
function characterFor(code: number): string {
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code)
        : '�';
}

/** The character the reference `name` (between `&` and `;`) stands for, or undefined. */
export function characterReference(
    name: string,
    named: Readonly<Record<string, string>>,
): string | undefined {
    const hex = HEX.exec(name);

    if (hex !== null) {
        return characterFor(Number.parseInt(hex[1], 16));
    }

    const decimal = DECIMAL.exec(name);

    if (decimal !== null) {
        return characterFor(Number(decimal[1]));
    }

    return Object.hasOwn(named, name) ? named[name] : undefined;
}
