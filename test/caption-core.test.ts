import { describe, expect, it } from 'vite-plus/test';
import { contrastRatio, readableText } from '../src/core/color';
import { placeTooltip } from '../src/core/place';
import { cleanText, truncateWords } from '../src/core/text';

describe('caption text', () => {
    it('cuts at a word boundary and marks the cut', () => {
        const text = 'the quick brown fox jumps over the lazy dog';
        const short = truncateWords(text, 15, '(...)');

        expect(short).toBe('the quick brown(...)');
        expect(short.length).toBeLessThan(text.length);
    });

    it('returns the text unchanged when it fits', () => {
        expect(truncateWords('short', 40)).toBe('short');
    });

    it('cuts at a character when there are no spaces', () => {
        expect(truncateWords('aaaaaaaa', 3, '…')).toBe('aaa…');
    });

    it('strips a bidi override and collapses whitespace', () => {
        const clean = cleanText('hi‮evil‬   there', 100);

        expect(clean).toBe('hi evil there');
        expect(clean).not.toMatch(/[‪-‮]/);
    });

    it('caps the length, counting whole characters', () => {
        expect(cleanText('abcdef', 4)).toBe('abcd');
    });
});

describe('readable tooltip color', () => {
    it('keeps the preferred color when it has enough contrast', () => {
        // White on a dark blue clears 4.5:1.
        expect(readableText([47, 111, 219, 1], [255, 255, 255, 1])).toBe(
            'rgba(255, 255, 255, 1)',
        );
    });

    it('falls back to black on a light background', () => {
        const text = readableText([245, 245, 245, 1], [255, 255, 255, 1]);

        expect(text).toBe('rgba(0, 0, 0, 1)');
        expect(contrastRatio([245, 245, 245, 1], [0, 0, 0, 1])).toBeGreaterThan(
            4.5,
        );
    });
});

describe('placing a tooltip', () => {
    const viewport = { width: 320, height: 200 };

    it('sits above the anchor when there is room', () => {
        const place = placeTooltip(
            { left: 100, top: 120, width: 40, height: 20 },
            { width: 80, height: 30 },
            viewport,
        );

        expect(place.side).toBe('above');
        expect(place.top).toBe(120 - 8 - 30);
    });

    it('flips below when the top is too tight', () => {
        const place = placeTooltip(
            { left: 100, top: 4, width: 40, height: 20 },
            { width: 80, height: 30 },
            viewport,
        );

        expect(place.side).toBe('below');
    });

    it('never leaves the viewport', () => {
        const place = placeTooltip(
            { left: 300, top: 120, width: 40, height: 20 },
            { width: 80, height: 30 },
            viewport,
        );

        expect(place.left).toBeLessThanOrEqual(320 - 80 - 8);
        expect(place.left).toBeGreaterThanOrEqual(8);
    });
});
