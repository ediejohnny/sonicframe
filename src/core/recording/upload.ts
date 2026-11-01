/**
 * Sending a recording to the app's own address, without the page: the request the app's options
 * describe, checked. The address must be a web or relative one (anything else means no request),
 * the method POST or PUT, header names plain tokens and their values one line, and every text is
 * capped; a header or a field that does not pass is left out, and an unknown word falls back.
 */

import { cleanText } from '../shared/text';
import { safeUrl } from '../shared/url';

/** Where and how the recorder sends a recording. */
export type RecorderUpload = {
    /** The address: a web (http, https) or relative one. */
    url: string;
    /** `'POST'` (the default) or `'PUT'`. */
    method?: 'POST' | 'PUT';
    /** A form with the file in `field` and the `fields` (`'form'`, the default), or the file alone as the body (`'raw'`). */
    body?: 'form' | 'raw';
    /** The form field that holds the file: `'file'` by default, up to 100 characters. */
    field?: string;
    /** The file's name: `recording` and its format's extension by default, up to 120 characters. */
    filename?: string;
    /** More form fields, up to 50, each value up to 10 000 characters. */
    fields?: Readonly<Record<string, string>>;
    /** Request headers (an authorization token, say), up to 50, each value up to 8192 characters. */
    headers?: Readonly<Record<string, string>>;
    /** Sends cookies to another host too. Off by default. */
    withCredentials?: boolean;
};

/** A checked request: everything `RecorderUpload` asks, with each default filled in. */
export type UploadPlan = {
    url: string;
    method: 'POST' | 'PUT';
    raw: boolean;
    field: string;
    filename: string;
    fields: readonly (readonly [string, string])[];
    headers: readonly (readonly [string, string])[];
    withCredentials: boolean;
};

/** The most headers, and fields, taken. */
const MAX_ENTRIES = 50;

/** The longest form field value taken, in characters. */
const MAX_FIELD_VALUE = 10_000;

/** The longest header value taken, in characters. */
const MAX_HEADER_VALUE = 8192;

/** A header name: an HTTP token. */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;

/** A header value: one line, no control characters but tab. */
// oxlint-disable-next-line no-control-regex -- control characters are exactly what is refused
const HEADER_VALUE = /^[^\u0000-\u0008\u000a-\u001f\u007f]*$/;

/** The file extension of each audio format the recorder may record. */
const EXTENSIONS: Readonly<Record<string, string>> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
};

/** The checked request for a recording of `type`, or null when the address is refused. */
export function uploadPlan(
    upload: RecorderUpload,
    type: string,
): UploadPlan | null {
    const url = typeof upload.url === 'string' ? safeUrl(upload.url) : null;

    if (url === null) {
        return null;
    }

    const extension = EXTENSIONS[type.split(';')[0].trim()];

    return {
        url,
        method: upload.method === 'PUT' ? 'PUT' : 'POST',
        raw: upload.body === 'raw',
        field: textOr(upload.field, 100, 'file'),
        filename: textOr(
            upload.filename,
            120,
            extension === undefined ? 'recording' : `recording.${extension}`,
        ).replace(/[/\\]/g, '_'),
        fields: entries(upload.fields).flatMap(([name, value]) => {
            const key = textOr(name, 100, '');

            return key === '' || typeof value !== 'string'
                ? []
                : [[key, value.slice(0, MAX_FIELD_VALUE)] as const];
        }),
        headers: entries(upload.headers).filter(
            ([name, value]) =>
                HEADER_NAME.test(name) &&
                typeof value === 'string' &&
                value.length <= MAX_HEADER_VALUE &&
                HEADER_VALUE.test(value),
        ),
        withCredentials: upload.withCredentials === true,
    };
}

/** `given` cleaned to one line of at most `max` characters, or `fallback` when that leaves nothing. */
function textOr(given: unknown, max: number, fallback: string): string {
    const text = typeof given === 'string' ? cleanText(given, max) : '';

    return text === '' ? fallback : text;
}

/** The first 50 own entries of `record`, or none. */
function entries(
    record: Readonly<Record<string, unknown>> | undefined,
): [string, string][] {
    return typeof record === 'object' && record !== null
        ? (Object.entries(record).slice(0, MAX_ENTRIES) as [string, string][])
        : [];
}
