import { describe, expect, it } from 'vite-plus/test';
import { clipPlan, DEFAULT_CLIP_TYPES, pickMimeType } from '../src/core/clip';

describe('pickMimeType', () => {
    it('returns the first supported candidate', () => {
        const supported = (type: string): boolean =>
            type === 'video/webm;codecs=vp9';

        expect(pickMimeType(DEFAULT_CLIP_TYPES, supported)).toBe(
            'video/webm;codecs=vp9',
        );
    });

    it('prefers MP4 when everything is supported', () => {
        expect(pickMimeType(DEFAULT_CLIP_TYPES, () => true)).toBe(
            'video/mp4;codecs=avc1',
        );
    });

    it('returns null when nothing is supported', () => {
        expect(pickMimeType(DEFAULT_CLIP_TYPES, () => false)).toBeNull();
    });
});

describe('clipPlan', () => {
    it('orders the ends and clamps to the sound', () => {
        expect(clipPlan(5, 2, 100)).toEqual({ start: 2, end: 5, seconds: 3 });
    });

    it('caps the length', () => {
        expect(clipPlan(0, 9999, 1000).seconds).toBe(120);
    });

    it('clamps to the duration', () => {
        expect(clipPlan(0, 500, 100).end).toBe(100);
    });

    it('takes a missing start or end as the sound own start or end', () => {
        expect(clipPlan(Number.NaN, 10, 30)).toEqual({
            start: 0,
            end: 10,
            seconds: 10,
        });
        expect(clipPlan(5, Number.NaN, 30)).toEqual({
            start: 5,
            end: 30,
            seconds: 25,
        });
    });
});
