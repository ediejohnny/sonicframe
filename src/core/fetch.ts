/** Reading a fetched file with a ceiling, for the loaders of the core (waveform files, chapters). */

/** The part of a `fetch` response the loaders read. */
export type FetchedResponse = {
    ok: boolean;
    status: number;
    headers?: { get(name: string): string | null };
    /** Read piece by piece, so an oversized file is dropped as soon as it passes the ceiling. */
    body?: ReadableStream<Uint8Array> | null;
    /** Used when there is no body stream. */
    arrayBuffer(): Promise<ArrayBuffer>;
};

/**
 * The response's bytes, refusing them with `tooLarge()` once they pass `maxBytes`: before reading
 * when the announced length is larger, and as soon as the stream grows past it otherwise.
 */
export async function readCapped(
    response: FetchedResponse,
    maxBytes: number,
    tooLarge: () => Error,
): Promise<Uint8Array> {
    if (Number(response.headers?.get('content-length')) > maxBytes) {
        throw tooLarge();
    }

    if (!response.body) {
        const buffer = await response.arrayBuffer();

        if (buffer.byteLength > maxBytes) {
            throw tooLarge();
        }

        return new Uint8Array(buffer);
    }

    const reader = response.body.getReader();
    const pieces: Uint8Array[] = [];
    let size = 0;

    for (;;) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        size += value.byteLength;

        if (size > maxBytes) {
            void reader.cancel();
            throw tooLarge();
        }

        pieces.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const piece of pieces) {
        bytes.set(piece, offset);
        offset += piece.byteLength;
    }

    return bytes;
}
