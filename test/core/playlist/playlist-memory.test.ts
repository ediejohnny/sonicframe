/**
 * What a playlist keeps between visits: the track it was on (by its id), the shuffle and the repeat,
 * read back from a storage that any script of the page can write, so each value is checked on its own
 * and anything strange is left out.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    readPlaylistMemory,
    writePlaylistMemory,
} from '../../../src/core/playlist/playlist-memory';

const NOTHING = { track: null, shuffle: null, repeat: null };

describe('readPlaylistMemory', () => {
    it('reads back what was written', () => {
        expect(
            readPlaylistMemory(
                writePlaylistMemory({
                    track: 'ep-2',
                    shuffle: true,
                    repeat: 'one',
                }),
            ),
        ).toEqual({ track: 'ep-2', shuffle: true, repeat: 'one' });
    });

    it('keeps each good value and leaves out each strange one', () => {
        expect(
            readPlaylistMemory(
                '{"track":"a.mp3","shuffle":"yes","repeat":"forever"}',
            ),
        ).toEqual({ track: 'a.mp3', shuffle: null, repeat: null });
        expect(
            readPlaylistMemory('{"track":7,"shuffle":false,"repeat":"all"}'),
        ).toEqual({ track: null, shuffle: false, repeat: 'all' });
        expect(readPlaylistMemory('{"track":""}')).toEqual(NOTHING);
        expect(
            readPlaylistMemory(JSON.stringify({ track: 'x'.repeat(2001) })),
        ).toEqual(NOTHING);
    });

    it('gives nothing for no storage, broken text or a value that is not an object', () => {
        for (const text of [null, '', '{', 'null', '[1,2]', '"ep"', '42']) {
            expect(readPlaylistMemory(text), String(text)).toEqual(NOTHING);
        }
    });

    it('never takes a value from the prototype a stored key names', () => {
        expect(
            readPlaylistMemory(
                '{"__proto__":{"track":"evil","shuffle":true,"repeat":"one"}}',
            ),
        ).toEqual(NOTHING);
        expect(({} as Record<string, unknown>).track).toBeUndefined();
    });

    it('reads any text without throwing, and only ever gives checked values', () => {
        fc.assert(
            fc.property(fc.oneof(fc.string(), fc.json()), (text) => {
                const kept = readPlaylistMemory(text);

                expect(
                    kept.track === null ||
                        (typeof kept.track === 'string' &&
                            kept.track !== '' &&
                            kept.track.length <= 2000),
                ).toBe(true);
                expect([null, true, false]).toContain(kept.shuffle);
                expect([null, 'none', 'all', 'one']).toContain(kept.repeat);
            }),
        );
    });
});
