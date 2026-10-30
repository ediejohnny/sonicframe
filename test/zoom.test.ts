/**
 * The zoom options: off unless asked, every way of moving the view off unless switched on, strange
 * values falling back to their defaults; the zoom keys (never with Ctrl, ⌘ or Alt, which belong to
 * the browser); the wheel's zoom factor; and the words said about a new view.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    resolveZoom,
    viewWords,
    wheelFactor,
    zoomKey,
    ZOOM_WORDS,
} from '../src/core/zoom';

describe('resolveZoom', () => {
    it('is off unless asked', () => {
        expect(resolveZoom(undefined)).toBeNull();
        expect(resolveZoom(false)).toBeNull();
    });

    it('turns on only the view and the API with true: every way of moving it stays off', () => {
        expect(resolveZoom(true)).toEqual({
            view: { start: 0, end: 1 },
            max: null,
            step: 2,
            anchor: 'position',
            wheel: false,
            wheelModifier: 'ctrl',
            wheelSpeed: 1,
            scroll: false,
            pinch: false,
            keys: null,
            follow: false,
            followType: 'page',
            followHold: true,
            edgeScroll: false,
            edgeSize: 32,
            edgeSpeed: 1,
            revealKeys: true,
        });
    });

    it('takes strange values as the defaults and keeps numbers in range', () => {
        const zoom = resolveZoom({
            max: 99_999,
            step: 0.5,
            anchor: 'pointer' as 'center',
            wheelModifier: 'shift' as 'alt',
            wheelSpeed: NaN,
            followType: 'smooth' as 'page',
            edgeSize: -4,
            edgeSpeed: 500,
            view: { start: NaN, end: 0.5 },
        });

        expect(zoom).toMatchObject({
            max: 10_000,
            step: 1.01,
            anchor: 'position',
            wheelModifier: 'ctrl',
            wheelSpeed: 1,
            followType: 'page',
            edgeSize: 1,
            edgeSpeed: 10,
            view: { start: 0, end: 1 },
        });
        expect(resolveZoom({ max: 0.5 })?.max).toBe(1);
        expect(resolveZoom({ max: 'x' as unknown as number })?.max).toBeNull();
    });

    it('gives the keys their defaults, takes your own, and lets one be switched off', () => {
        expect(resolveZoom({ keys: true })?.keys).toEqual({
            in: ['+', '='],
            out: ['-'],
            reset: ['0'],
        });
        expect(
            resolveZoom({ keys: { in: 'i', out: ['o', 'O'], reset: false } })
                ?.keys,
        ).toEqual({ in: ['i'], out: ['o', 'O'], reset: [] });
        expect(resolveZoom({ keys: false })?.keys).toBeNull();
    });
});

describe('zoomKey', () => {
    const keys = { in: ['+', '='], out: ['-'], reset: ['0'] };

    it('finds the action of a key', () => {
        expect(zoomKey('+', {}, keys)).toBe('in');
        expect(zoomKey('=', {}, keys)).toBe('in');
        expect(zoomKey('-', {}, keys)).toBe('out');
        expect(zoomKey('0', {}, keys)).toBe('reset');
        expect(zoomKey('x', {}, keys)).toBeNull();
    });

    it('leaves Ctrl, ⌘ and Alt to the browser (its own page zoom)', () => {
        expect(zoomKey('+', { ctrlKey: true }, keys)).toBeNull();
        expect(zoomKey('-', { metaKey: true }, keys)).toBeNull();
        expect(zoomKey('0', { altKey: true }, keys)).toBeNull();
        expect(zoomKey('+', { shiftKey: true }, keys)).toBe('in');
    });
});

describe('wheelFactor', () => {
    it('zooms in on a wheel turned up and out on one turned down, by the same amount', () => {
        const zoomIn = wheelFactor(-100, 0, 1);
        const zoomOut = wheelFactor(100, 0, 1);

        expect(zoomIn).toBeGreaterThan(1);
        expect(zoomIn * zoomOut).toBeCloseTo(1, 12);
    });

    it('counts lines and pages as pixels, and follows the speed', () => {
        expect(wheelFactor(-1, 1, 1)).toBeCloseTo(wheelFactor(-16, 0, 1), 12);
        expect(wheelFactor(-1, 2, 1)).toBeCloseTo(wheelFactor(-400, 0, 1), 12);
        expect(Math.log(wheelFactor(-100, 0, 2))).toBeCloseTo(
            2 * Math.log(wheelFactor(-100, 0, 1)),
            12,
        );
        expect(wheelFactor(0, 0, 1)).toBe(1);
    });
});

describe('viewWords', () => {
    it('says the zoom and the times in view, or the part of the sound while its length is unknown', () => {
        expect(viewWords(ZOOM_WORDS, { start: 0.25, end: 0.5 }, 320)).toBe(
            'Zoom 4×, 1:20 to 2:40',
        );
        expect(viewWords(ZOOM_WORDS, { start: 0.25, end: 0.5 }, null)).toBe(
            'Zoom 4×, 25% to 50%',
        );
        expect(viewWords(ZOOM_WORDS, { start: 0, end: 1 / 3 }, 90)).toBe(
            'Zoom 3×, 0:00 to 0:30',
        );
        expect(viewWords(ZOOM_WORDS, { start: 0.1, end: 0.4 }, 100)).toBe(
            'Zoom 3.3×, 0:10 to 0:40',
        );
        // 29.95 s and 59.9 s are said as the nearest second.
        expect(viewWords(ZOOM_WORDS, { start: 0.5, end: 1 }, 59.9)).toBe(
            'Zoom 2×, 0:30 to 1:00',
        );
    });

    it('takes your own words', () => {
        expect(
            viewWords(
                { view: (level, from, to) => `${level} ${from} ${to}` },
                { start: 0, end: 0.5 },
                10,
            ),
        ).toBe('2 0:00 0:05');
    });
});
