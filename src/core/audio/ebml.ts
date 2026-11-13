/**
 * EBML, the coding under Matroska and WebM (RFC 8794): each element is an ID, a size and the data,
 * the ID and the size written as variable-length numbers whose first byte says how many bytes follow.
 */

/** An element's header: its ID (marker kept), its data size (null when unknown) and its length. */
export type EbmlHeader = {
    readonly id: number;
    readonly size: number | null;
    readonly length: number;
};

/** The length of the variable-length number starting with `first`, from 1 to `most`; 0 if none. */
function widthOf(first: number, most: number): number {
    for (let width = 1; width <= most; width++) {
        if ((first & (0x100 >> width)) !== 0) {
            return width;
        }
    }

    return 0;
}

/**
 * A variable-length number at `at`: its value (the marker taken off, or kept for IDs) and its width;
 * null when the bytes there are not one, or undefined when more bytes are needed.
 */
export function vint(
    bytes: Uint8Array,
    at: number,
    most: number,
    keepMarker: boolean,
): { value: number; width: number; unknown: boolean } | null | undefined {
    if (at >= bytes.length) {
        return undefined;
    }

    const width = widthOf(bytes[at], most);

    if (width === 0) {
        return null;
    }

    if (at + width > bytes.length) {
        return undefined;
    }

    let value = keepMarker ? bytes[at] : bytes[at] & (0xff >> width);
    let ones = value === 0xff >> width;

    for (let index = 1; index < width; index++) {
        value = value * 256 + bytes[at + index];
        ones &&= bytes[at + index] === 0xff;
    }

    return { value, width, unknown: !keepMarker && ones };
}

/** The element header at `at`; null when it is not one, undefined when more bytes are needed. */
export function ebmlHeader(
    bytes: Uint8Array,
    at: number,
): EbmlHeader | null | undefined {
    const id = vint(bytes, at, 4, true);

    if (id === null || id === undefined) {
        return id;
    }

    const size = vint(bytes, at + id.width, 8, false);

    if (size === null || size === undefined) {
        return size;
    }

    return {
        id: id.value,
        size: size.unknown ? null : size.value,
        length: id.width + size.width,
    };
}

/** An unsigned whole number of `size` bytes. */
export function ebmlUint(bytes: Uint8Array, at: number, size: number): number {
    let value = 0;

    for (let index = 0; index < size; index++) {
        value = value * 256 + bytes[at + index];
    }

    return value;
}

/** A float of 4 or 8 bytes (0 for any other size). */
export function ebmlFloat(bytes: Uint8Array, at: number, size: number): number {
    const view = new DataView(bytes.buffer, bytes.byteOffset + at, size);

    if (size === 4) {
        return view.getFloat32(0);
    }

    return size === 8 ? view.getFloat64(0) : 0;
}
