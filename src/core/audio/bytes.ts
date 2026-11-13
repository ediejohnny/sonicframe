/** Reading names and big-endian numbers out of a file's bytes; past the end, a name does not match. */

/** Whether the ASCII `text` is written at `at`. */
export function textAt(bytes: Uint8Array, at: number, text: string): boolean {
    for (let index = 0; index < text.length; index++) {
        if (bytes[at + index] !== text.charCodeAt(index)) {
            return false;
        }
    }

    return true;
}

/** A big-endian unsigned 32-bit number at `at`. */
export function uint32(bytes: Uint8Array, at: number): number {
    return (
        bytes[at] * 0x1000000 +
        ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3])
    );
}
