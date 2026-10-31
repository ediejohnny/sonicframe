import { describe, expect, it } from 'vite-plus/test';
import type { Chapter } from '../../../src/core/chapters/chapters';
import {
    sessionMetadata,
    sessionPosition,
} from '../../../src/core/session/media-session';
import { skipRatio } from '../../../src/core/shared/steps';

function chapter(
    start: number,
    title: string,
    more: Partial<Chapter> = {},
): Chapter {
    return {
        start,
        end: null,
        title,
        image: null,
        url: null,
        toc: true,
        ...more,
    };
}

describe('sessionMetadata', () => {
    it('keeps the words to one clean line of at most 120 characters', () => {
        const metadata = sessionMetadata({
            title: 'Night\u202e drive\nlive',
            artist: 'a'.repeat(200),
            album: 7 as unknown as string,
        });

        expect(metadata.title).toBe('Night drive live');
        expect(metadata.artist).toBe('a'.repeat(120));
        expect(metadata.album).toBe('');
    });

    it('takes one picture from an address, and only a web, relative or blob one', () => {
        expect(sessionMetadata({ artwork: 'covers/dusk.png' }).artwork).toEqual(
            [{ src: 'covers/dusk.png' }],
        );
        expect(
            sessionMetadata({ artwork: 'blob:https://example.com/1d2e' })
                .artwork,
        ).toEqual([{ src: 'blob:https://example.com/1d2e' }]);
        expect(
            sessionMetadata({ artwork: 'javascript:alert(1)' }).artwork,
        ).toEqual([]);
        expect(
            sessionMetadata({ artwork: 'data:image/png;base64,AA' }).artwork,
        ).toEqual([]);
        expect(
            sessionMetadata({ artwork: '//other.example/a.png' }).artwork,
        ).toEqual([]);
    });

    it('keeps sizes and a type only when they are well formed', () => {
        const { artwork } = sessionMetadata({
            artwork: [
                { src: 'a.png', sizes: '96x96 128x128', type: 'image/png' },
                { src: 'b.png', sizes: 'big', type: 'text/html' },
                { src: 'c.svg', sizes: 'any', type: 'image/svg+xml' },
            ],
        });

        expect(artwork).toEqual([
            { src: 'a.png', sizes: '96x96 128x128', type: 'image/png' },
            { src: 'b.png' },
            { src: 'c.svg', sizes: 'any', type: 'image/svg+xml' },
        ]);
    });

    it('keeps at most eight pictures, after leaving out the unsafe ones', () => {
        const list = [
            { src: 'javascript:void 0' },
            ...Array.from({ length: 10 }, (_, index) => ({
                src: `${index}.png`,
            })),
        ];

        expect(
            sessionMetadata({ artwork: list }).artwork.map((one) => one.src),
        ).toEqual([
            '0.png',
            '1.png',
            '2.png',
            '3.png',
            '4.png',
            '5.png',
            '6.png',
            '7.png',
        ]);
    });

    it('gives the chapters of the contents, with their start and picture', () => {
        const metadata = sessionMetadata({
            chapters: [
                chapter(0, 'Intro', { image: 'intro.jpg' }),
                chapter(12.5, 'Only a picture', { toc: false }),
                chapter(30, 'Talk\u0007 time'),
            ],
        });

        expect(metadata.chapterInfo).toEqual([
            { title: 'Intro', startTime: 0, artwork: [{ src: 'intro.jpg' }] },
            { title: 'Talk time', startTime: 30, artwork: [] },
        ]);
    });

    it('leaves out a chapter whose start is not a time', () => {
        const metadata = sessionMetadata({
            chapters: [
                chapter(Number.NaN, 'Lost'),
                chapter(-3, 'Before'),
                chapter(4, 'Kept'),
            ],
        });

        expect(metadata.chapterInfo.map((one) => one.title)).toEqual(['Kept']);
    });

    it('gives empty words, no pictures and no chapters when given nothing', () => {
        expect(sessionMetadata({})).toEqual({
            title: '',
            artist: '',
            album: '',
            artwork: [],
            chapterInfo: [],
        });
    });
});

describe('sessionPosition', () => {
    it('gives the duration, the position and the speed when all three can be sent', () => {
        expect(sessionPosition(90, 12, 1.5)).toEqual({
            duration: 90,
            position: 12,
            playbackRate: 1.5,
        });
    });

    it('keeps the position inside the sound', () => {
        expect(sessionPosition(90, 90.2, 1)?.position).toBe(90);
        expect(sessionPosition(90, -1, 1)?.position).toBe(0);
        expect(sessionPosition(90, Number.NaN, 1)?.position).toBe(0);
    });

    it('sends nothing without a known duration', () => {
        expect(sessionPosition(Number.POSITIVE_INFINITY, 3, 1)).toBeNull();
        expect(sessionPosition(Number.NaN, 3, 1)).toBeNull();
        expect(sessionPosition(0, 0, 1)).toBeNull();
        expect(sessionPosition(null, 0, 1)).toBeNull();
    });

    it('sends nothing for a speed the session cannot take', () => {
        expect(sessionPosition(90, 3, 0)).toBeNull();
        expect(sessionPosition(90, 3, -1)).toBeNull();
        expect(sessionPosition(90, 3, Number.NaN)).toBeNull();
    });
});

describe('skipRatio', () => {
    it('gives where a skip lands, as a share of the sound', () => {
        expect(skipRatio(30, 10, 100)).toBe(0.4);
        expect(skipRatio(30, -10, 100)).toBe(0.2);
    });

    it('stops at the start and at the end', () => {
        expect(skipRatio(4, -10, 100)).toBe(0);
        expect(skipRatio(95, 10, 100)).toBe(1);
    });
});
