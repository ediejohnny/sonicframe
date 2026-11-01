/**
 * `uploadRecording` sends a recording to the app's own address: as a form or the file alone, with
 * the app's fields and headers, telling how far it got, answering with the server's status and text,
 * and failing on a refused address, a status outside 200–299, the network or an abort.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    type Recording,
    UploadError,
    uploadRecording,
} from '../../../src/record';
import { FakeRequest, stubRequests } from '../../support/upload';

const recording: Recording = {
    blob: new Blob(['voice'], { type: 'audio/webm' }),
    type: 'audio/webm;codecs=opus',
    duration: 2,
    peaks: [0.5],
    size: 5,
};

/** The one request made so far. */
function request(): FakeRequest {
    expect(FakeRequest.made).toHaveLength(1);

    return FakeRequest.made[0];
}

describe('uploadRecording', () => {
    it("posts a form with the file and the app's fields and headers, and answers with the server's", async () => {
        stubRequests();
        const turn = new AbortController();
        const sent = uploadRecording(
            recording,
            {
                url: '/voice',
                fields: { chat: '42' },
                headers: { Authorization: 'Bearer abc' },
                withCredentials: true,
            },
            { signal: turn.signal },
        );
        const asked = request();

        expect(asked.method).toBe('POST');
        expect(asked.url).toBe('/voice');
        expect(asked.headers).toEqual([['Authorization', 'Bearer abc']]);
        expect(asked.withCredentials).toBe(true);
        const form = asked.body as FormData;
        expect(form.get('chat')).toBe('42');
        const file = form.get('file') as File;
        expect(file.name).toBe('recording.webm');
        expect(await file.text()).toBe('voice');

        asked.answer(201, 'saved');
        await expect(sent).resolves.toEqual({ status: 201, body: 'saved' });

        // Once answered, its signal stops nothing.
        turn.abort();
        expect(asked.aborted).toBe(false);
    });

    it('sends the file alone as the body, with its type, when asked', async () => {
        stubRequests();
        const sent = uploadRecording(recording, {
            url: 'https://example.com/v',
            method: 'PUT',
            body: 'raw',
        });
        const asked = request();

        expect(asked.method).toBe('PUT');
        expect(asked.body).toBe(recording.blob);
        expect(asked.headers).toEqual([
            ['Content-Type', 'audio/webm;codecs=opus'],
        ]);
        asked.answer(200);
        await sent;

        // A recording of no known type is sent with no type of its own.
        FakeRequest.made = [];
        const untyped = uploadRecording(
            { ...recording, type: '' },
            { url: '/v', body: 'raw' },
        );
        expect(request().headers).toEqual([]);
        request().answer(200);
        await untyped;
    });

    it('tells how far it got', async () => {
        stubRequests();
        const done: number[] = [];
        const sent = uploadRecording(
            recording,
            { url: '/v' },
            { progress: (fraction) => done.push(fraction) },
        );
        // No size known yet: nothing to tell.
        request().progress(0, 0);
        request().progress(2, 8);
        request().progress(8, 8);
        request().answer(204);
        await sent;

        expect(done).toEqual([0.25, 1]);
    });

    it("keeps the server's text to 64 KiB", async () => {
        stubRequests();
        const sent = uploadRecording(recording, { url: '/v' });
        request().answer(200, 'x'.repeat(70_000));

        expect((await sent).body).toHaveLength(65_536);
    });

    it("fails with the server's status and text outside 200–299, and with status 0 when the network fails", async () => {
        stubRequests();
        const refused = uploadRecording(recording, { url: '/v' });
        request().answer(413, 'too big');
        const error = await refused.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).status).toBe(413);
        expect((error as UploadError).body).toBe('too big');

        FakeRequest.made = [];
        const lost = uploadRecording(recording, { url: '/v' });
        request().fail();
        await expect(lost).rejects.toMatchObject({ status: 0 });
    });

    it('makes no request for a refused address', async () => {
        stubRequests();

        await expect(
            uploadRecording(recording, { url: 'javascript:alert(1)' }),
        ).rejects.toBeInstanceOf(UploadError);
        expect(FakeRequest.made).toEqual([]);
    });

    it('stops when its signal aborts, and makes no request when it already has', async () => {
        stubRequests();
        const turn = new AbortController();
        const sent = uploadRecording(
            recording,
            { url: '/v' },
            { signal: turn.signal },
        );
        turn.abort();

        expect(request().aborted).toBe(true);
        await expect(sent).rejects.toMatchObject({ name: 'AbortError' });

        FakeRequest.made = [];
        await expect(
            uploadRecording(recording, { url: '/v' }, { signal: turn.signal }),
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(FakeRequest.made).toEqual([]);
    });
});
