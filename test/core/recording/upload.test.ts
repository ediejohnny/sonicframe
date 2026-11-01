import { describe, expect, it } from 'vite-plus/test';
import { uploadPlan } from '../../../src/core/recording/upload';

const WEBM = 'audio/webm;codecs=opus';

describe('uploadPlan', () => {
    it('posts a form with the file in "file", named for its format, by default', () => {
        expect(uploadPlan({ url: '/voice' }, WEBM)).toEqual({
            url: '/voice',
            method: 'POST',
            raw: false,
            field: 'file',
            filename: 'recording.webm',
            fields: [],
            headers: [],
            withCredentials: false,
        });
    });

    it('names the file for each format it knows, and plainly for any other', () => {
        const name = (type: string): string | undefined =>
            uploadPlan({ url: '/v' }, type)?.filename;

        expect(name('audio/mp4')).toBe('recording.m4a');
        expect(name('audio/ogg;codecs=opus')).toBe('recording.ogg');
        expect(name('audio/wav')).toBe('recording.wav');
        expect(name('audio/mpeg')).toBe('recording.mp3');
        expect(name('audio/x-unknown')).toBe('recording');
        expect(name('')).toBe('recording');
    });

    it("takes the app's method, body, field, file name, fields, headers and credentials", () => {
        expect(
            uploadPlan(
                {
                    url: 'https://example.com/notes',
                    method: 'PUT',
                    body: 'raw',
                    field: 'voice',
                    filename: 'note.webm',
                    fields: { chat: '42', from: 'me' },
                    headers: { Authorization: 'Bearer abc', 'X-Trace': '1' },
                    withCredentials: true,
                },
                WEBM,
            ),
        ).toEqual({
            url: 'https://example.com/notes',
            method: 'PUT',
            raw: true,
            field: 'voice',
            filename: 'note.webm',
            fields: [
                ['chat', '42'],
                ['from', 'me'],
            ],
            headers: [
                ['Authorization', 'Bearer abc'],
                ['X-Trace', '1'],
            ],
            withCredentials: true,
        });
    });

    it('makes no request for an address it refuses', () => {
        for (const url of ['javascript:alert(1)', '//evil.example/x', '', 42]) {
            expect(
                uploadPlan({ url: url as string }, WEBM),
                String(url),
            ).toBeNull();
        }
    });

    it('falls back on unknown words and empty names, and keeps file names to one plain name', () => {
        const plan = uploadPlan(
            {
                url: '/v',
                method: 'DELETE' as 'PUT',
                body: 'json' as 'raw',
                field: ' ',
                filename: '../../etc/pass\\wd',
                withCredentials: 'yes' as unknown as boolean,
            },
            WEBM,
        );

        expect(plan?.method).toBe('POST');
        expect(plan?.raw).toBe(false);
        expect(plan?.field).toBe('file');
        expect(plan?.filename).toBe('.._.._etc_pass_wd');
        expect(plan?.withCredentials).toBe(false);
    });

    it('leaves out headers that are not plain tokens or one line, and fields without a name', () => {
        const plan = uploadPlan(
            {
                url: '/v',
                headers: {
                    'Bad Name': 'x',
                    'X-Split': `a${String.fromCharCode(13, 10)}Set-Cookie: b`,
                    'X-Number': 7 as unknown as string,
                    'X-Fine': 'ok',
                },
                fields: {
                    ' ': 'lost',
                    kept: 'yes',
                    count: 3 as unknown as string,
                },
            },
            WEBM,
        );

        expect(plan?.headers).toEqual([['X-Fine', 'ok']]);
        expect(plan?.fields).toEqual([['kept', 'yes']]);
    });

    it('caps what it takes: 50 headers, 50 fields, and the length of each text', () => {
        const many = Object.fromEntries(
            Array.from({ length: 60 }, (_, at) => [`k${at}`, 'v']),
        );
        const plan = uploadPlan(
            {
                url: '/v',
                headers: { ...many, 'X-Long': 'v'.repeat(8193) },
                fields: { ...many, long: 'v'.repeat(20_000) },
                field: 'f'.repeat(300),
                filename: 'n'.repeat(300),
            },
            WEBM,
        );

        expect(plan?.headers).toHaveLength(50);
        expect(plan?.fields).toHaveLength(50);
        expect(plan?.field).toHaveLength(100);
        expect(plan?.filename).toHaveLength(120);

        const long = uploadPlan(
            { url: '/v', fields: { long: 'v'.repeat(20_000) } },
            WEBM,
        );
        expect(long?.fields[0][1]).toHaveLength(10_000);
        expect(
            uploadPlan(
                { url: '/v', headers: { 'X-Long': 'v'.repeat(8193) } },
                WEBM,
            )?.headers,
        ).toEqual([]);
    });
});
