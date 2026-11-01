import { describe, expect, it } from 'vite-plus/test';
import {
    forgetPosition,
    keepPosition,
    readRemembered,
    resolveRemember,
    resumeAt,
    writeRemembered,
} from '../../../src/core/player/remember';

describe('resolveRemember', () => {
    it('is off unless asked for, and keeps all three when turned on', () => {
        expect(resolveRemember(undefined)).toBeNull();
        expect(resolveRemember(false)).toBeNull();
        expect(resolveRemember(true)).toEqual({
            position: true,
            volume: true,
            speed: true,
            key: 'player',
            sound: null,
            sounds: 50,
            nearEnd: 5,
        });
    });

    it('takes what to keep, its own names, and keeps its numbers in range', () => {
        expect(
            resolveRemember({
                volume: false,
                key: 'podcast',
                sound: 'episode-12',
                sounds: 9999,
                nearEnd: -3,
            }),
        ).toEqual({
            position: true,
            volume: false,
            speed: true,
            key: 'podcast',
            sound: 'episode-12',
            sounds: 500,
            nearEnd: 0,
        });
        expect(
            resolveRemember({
                key: '',
                sound: 7 as unknown as string,
                sounds: 0,
                nearEnd: Number.NaN,
            }),
        ).toMatchObject({ key: 'player', sound: null, sounds: 1, nearEnd: 5 });
    });
});

describe('what is kept', () => {
    it('reads back what it wrote', () => {
        const kept = {
            volume: 0.4,
            muted: true,
            speed: 1.5,
            positions: [
                { sound: 'b.mp3', time: 12.5 },
                { sound: 'a.mp3', time: 300 },
            ],
        };

        expect(readRemembered(writeRemembered(kept))).toEqual(kept);
    });

    it('reads nothing from nothing, from text that is no JSON, and from values out of place', () => {
        const empty = { positions: [] };

        expect(readRemembered(null)).toEqual(empty);
        expect(readRemembered('{oops')).toEqual(empty);
        expect(readRemembered('[1, 2]')).toEqual(empty);
        expect(
            readRemembered(
                JSON.stringify({
                    volume: 7,
                    muted: 'yes',
                    speed: 'fast',
                    positions: [
                        { sound: 'a.mp3', time: -3 },
                        { sound: 5, time: 10 },
                        { sound: 'b.mp3', time: 20 },
                        null,
                    ],
                }),
            ),
        ).toEqual({
            volume: 1,
            positions: [{ sound: 'b.mp3', time: 20 }],
        });
        expect(readRemembered(JSON.stringify({ speed: 9 })).speed).toBe(4);
    });

    it('keeps the newest position first, once a sound, and only the last ones', () => {
        let kept = readRemembered(null);
        kept = keepPosition(kept, 'a.mp3', 10, 3);
        kept = keepPosition(kept, 'b.mp3', 20, 3);
        kept = keepPosition(kept, 'a.mp3', 15, 3);

        expect(kept.positions).toEqual([
            { sound: 'a.mp3', time: 15 },
            { sound: 'b.mp3', time: 20 },
        ]);

        kept = keepPosition(kept, 'c.mp3', 30, 2);
        expect(kept.positions.map((saved) => saved.sound)).toEqual([
            'c.mp3',
            'a.mp3',
        ]);

        expect(forgetPosition(kept, 'c.mp3').positions).toEqual([
            { sound: 'a.mp3', time: 15 },
        ]);
    });
});

describe('resumeAt', () => {
    it('resumes where the sound was left, unless that is its start or near its end', () => {
        expect(resumeAt(30, 100, 5)).toBe(30);
        expect(resumeAt(94.9, 100, 5)).toBe(94.9);
        expect(resumeAt(95, 100, 5)).toBeNull();
        expect(resumeAt(0.5, 100, 5)).toBeNull();
        expect(resumeAt(null, 100, 5)).toBeNull();
        expect(resumeAt(120, 100, 0)).toBeNull();
        expect(resumeAt(99.5, 100, 0)).toBe(99.5);
    });
});
