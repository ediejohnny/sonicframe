/**
 * Answers for the loaders' `fetcher` option, so a test serves a file without the network: a status,
 * a `content-length` when given, and the bytes streamed in two pieces.
 */

import type { FetchedResponse } from '../../src/core/shared/fetch';

export type ServeOptions = {
    /** 200 unless given. */
    status?: number;
    /** The `content-length` header; none unless given. */
    length?: number;
    /** False: no stream, the bytes only through `arrayBuffer`. */
    stream?: boolean;
    /** Where the stream's first piece ends; 5 unless given. */
    split?: number;
};

/** A fetcher that answers every address with `bytes`. */
export function serve(
    bytes: Uint8Array,
    options: ServeOptions = {},
): (url: string) => Promise<FetchedResponse> {
    const status = options.status ?? 200;
    const split = options.split ?? 5;

    return () =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
                get: (name: string) =>
                    name === 'content-length' && options.length !== undefined
                        ? String(options.length)
                        : null,
            },
            body:
                options.stream === false
                    ? null
                    : new ReadableStream<Uint8Array>({
                          start(controller) {
                              controller.enqueue(bytes.slice(0, split));
                              controller.enqueue(bytes.slice(split));
                              controller.close();
                          },
                      }),
            arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
        });
}
