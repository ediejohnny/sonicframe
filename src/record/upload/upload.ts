/**
 * Sends a recording to the app's own address, as `uploadPlan` checks it: through `XMLHttpRequest`, so
 * it can tell how far it got. It answers with the server's status and text (the first 64 KiB), and
 * fails with an `UploadError` on a refused address, a status outside 200–299 or a network failure
 * (status 0), and with an `AbortError` when its signal aborts.
 */

import { type RecorderUpload, uploadPlan } from '../../core/recording/upload';
import type { Recording } from '../recorder/recorder';

/** The longest server text kept, in characters (64 KiB). */
const MAX_ANSWER = 65_536;

/** The server's answer to an upload. */
export type UploadResponse = {
    status: number;
    /** Its text, up to 64 KiB. */
    body: string;
};

/** A way to stop a send, and to hear how far it got (from 0 to 1). */
export type SendControl = {
    signal?: AbortSignal;
    progress?: (fraction: number) => void;
};

/** An upload that failed: the server's status (0 when it was never reached) and its text. */
export class UploadError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly body: string,
    ) {
        super(message);
        this.name = 'UploadError';
    }
}

/** Sends `recording` as `upload` describes it. */
export function uploadRecording(
    recording: Recording,
    upload: RecorderUpload,
    control: SendControl = {},
): Promise<UploadResponse> {
    // A recording an app made in the shape of 0.6 names its type only as `type`.
    const type = recording.mimeType ?? recording.type;
    const plan = uploadPlan(upload, type);
    const { signal, progress } = control;

    if (plan === null) {
        return Promise.reject(
            new UploadError(
                'sonicframe: the upload address was refused',
                0,
                '',
            ),
        );
    }

    if (signal?.aborted === true) {
        return Promise.reject(aborted());
    }

    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const stop = (): void => request.abort();
        const done = (): void => signal?.removeEventListener('abort', stop);

        request.open(plan.method, plan.url);
        request.withCredentials = plan.withCredentials;

        for (const [name, value] of plan.headers) {
            request.setRequestHeader(name, value);
        }

        request.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
                progress?.(event.loaded / event.total);
            }
        };
        request.onload = () => {
            done();
            const answer = {
                status: request.status,
                body: request.responseText.slice(0, MAX_ANSWER),
            };

            if (answer.status >= 200 && answer.status < 300) {
                resolve(answer);
            } else {
                reject(
                    new UploadError(
                        `sonicframe: the upload failed with status ${answer.status}`,
                        answer.status,
                        answer.body,
                    ),
                );
            }
        };
        request.onerror = () => {
            done();
            reject(new UploadError('sonicframe: the upload failed', 0, ''));
        };
        request.onabort = () => {
            done();
            reject(aborted());
        };
        signal?.addEventListener('abort', stop);

        if (plan.raw) {
            if (type !== '') {
                request.setRequestHeader('Content-Type', type);
            }

            request.send(recording.blob);
        } else {
            const form = new FormData();

            for (const [name, value] of plan.fields) {
                form.append(name, value);
            }

            form.append(
                plan.field,
                new File([recording.blob], plan.filename, {
                    type: recording.blob.type,
                }),
            );
            request.send(form);
        }
    });
}

/** The error of a send stopped by its signal. */
function aborted(): DOMException {
    return new DOMException('sonicframe: the upload was stopped', 'AbortError');
}
