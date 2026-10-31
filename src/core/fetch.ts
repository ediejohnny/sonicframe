/**
 * Loading files from outside for the loaders (waveform files, chapters, peaks, fonts): each address
 * once per page, a failed request refused with its status, and the bytes read with a ceiling.
 */

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
 * The promise `start` gives for `key`, started once per page and shared by every caller; a failure
 * is forgotten, so the next call tries again.
 */
export function oncePerPage<Value>(
    cache: Map<string, Promise<Value>>,
    key: string,
    start: () => Promise<Value>,
): Promise<Value> {
    let pending = cache.get(key);

    if (pending === undefined) {
        pending = start();
        cache.set(key, pending);
        pending.catch(() => cache.delete(key));
    }

    return pending;
}

/**
 * The response `fetcher` gives for `url`, refused unless it is ok, with `what` naming the file:
 * "sonicframe: chapters request failed (404)".
 */
export async function fetchOk<Response extends { ok: boolean; status: number }>(
    fetcher: (url: string) => Promise<Response>,
    url: string,
    what: string,
): Promise<Response> {
    const response = await fetcher(url);

    if (!response.ok) {
        throw new Error(
            `sonicframe: ${what} request failed (${response.status})`,
        );
    }

    return response;
}

/** A body's bytes, refused with `tooLarge()` as soon as they pass `maxBytes` (the rest is never read). */
export async function readBody(
    body: ReadableStream<Uint8Array>,
    maxBytes: number,
    tooLarge: () => Error,
): Promise<Uint8Array<ArrayBuffer>> {
    const reader = body.getReader();
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

/**
 * The response's bytes, refusing them with `tooLarge()` once they pass `maxBytes`: before reading
 * when the announced length is larger, and as soon as the stream grows past it otherwise.
 */
export async function readCapped(
    response: FetchedResponse,
    maxBytes: number,
    tooLarge: () => Error,
): Promise<Uint8Array<ArrayBuffer>> {
    if (Number(response.headers?.get('content-length')) > maxBytes) {
        throw tooLarge();
    }

    if (response.body) {
        return readBody(response.body, maxBytes, tooLarge);
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > maxBytes) {
        throw tooLarge();
    }

    return new Uint8Array(buffer);
}
