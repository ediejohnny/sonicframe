/**
 * A stand-in for `XMLHttpRequest`, since tests never reach the network: it keeps what was asked
 * (method, address, headers, credentials, body) and answers, fails or tells its progress only when
 * the test says so. Taken off after the test.
 */

import { vi } from 'vite-plus/test';
import { afterTest } from './helpers';

type Listener = (event: {
    loaded: number;
    total: number;
    lengthComputable: boolean;
}) => void;

export class FakeRequest {
    static made: FakeRequest[] = [];

    method = '';
    url = '';
    headers: [string, string][] = [];
    withCredentials = false;
    body: unknown = undefined;
    sent = false;
    aborted = false;
    status = 0;
    responseText = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    readonly upload: { onprogress: Listener | null } = { onprogress: null };

    constructor() {
        FakeRequest.made.push(this);
    }

    open(method: string, url: string): void {
        this.method = method;
        this.url = url;
    }

    setRequestHeader(name: string, value: string): void {
        this.headers.push([name, value]);
    }

    send(body: unknown): void {
        this.body = body;
        this.sent = true;
    }

    abort(): void {
        this.aborted = true;
        this.onabort?.();
    }

    /** The server answers with `status` and `text`. */
    answer(status: number, text = ''): void {
        this.status = status;
        this.responseText = text;
        this.onload?.();
    }

    /** The network fails. */
    fail(): void {
        this.onerror?.();
    }

    /** `loaded` of `total` bytes went up. */
    progress(loaded: number, total: number): void {
        this.upload.onprogress?.({ loaded, total, lengthComputable: true });
    }
}

/** Puts the stand-in in place of `XMLHttpRequest` for the test; the requests made are in `FakeRequest.made`. */
export function stubRequests(): void {
    FakeRequest.made = [];
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    afterTest({ destroy: () => vi.unstubAllGlobals() });
}
