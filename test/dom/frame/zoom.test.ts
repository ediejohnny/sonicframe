/**
 * Zoom and scroll in the frame: off unless asked; with it on, the view moves by the API, the keys,
 * the wheel and the playing position, each only when switched on, and a zoom by the keys can be
 * announced. What is drawn with a view and the pointer are in `zoom-drawing` and `zoom-pointer`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { ViewState } from '../../../src/index';
import { fakeMedia, nextFrame, type Mounted } from '../../support/helpers';
import { HALVES, key, showFrame, wheel } from './zoom-harness';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

function shown(options: Parameters<typeof showFrame>[0]): Mounted {
    mounted = showFrame(options);

    return mounted;
}

describe('zoom switched off (the default)', () => {
    it('keeps the whole sound in view, ignores the API, the keys and the wheel', () => {
        const { frame, container } = shown({ peaks: HALVES });
        const heard: unknown[] = [];
        frame.on('viewchange', (view) => heard.push(view));

        frame.zoomTo(4, 0.5);
        frame.setView(0.2, 0.3);

        expect(frame.view).toEqual({ start: 0, end: 1, level: 1, maxLevel: 1 });
        expect(key(container, '+').defaultPrevented).toBe(false);
        expect(
            wheel(container, { deltaY: -100, ctrlKey: true }).defaultPrevented,
        ).toBe(false);
        expect(heard).toEqual([]);
    });
});

describe('zoom by the API', () => {
    it('zooms around a point, tells listeners, and stops at one peak per bar', () => {
        const { frame } = shown({ zoom: true, peaks: HALVES });
        const heard: [ViewState, string][] = [];
        frame.on('viewchange', (view, source) => heard.push([view, source]));

        frame.zoomTo(4, 0.5);

        expect(frame.view.start).toBeCloseTo(0.375, 12);
        expect(frame.view.end).toBeCloseTo(0.625, 12);
        expect(heard.map(([view, source]) => [view.level, source])).toEqual([
            [4, 'api'],
        ]);

        // 200 px of 3 px bars with 2 px gaps: 40 bars; 1000 peaks give one per bar at 25×.
        expect(frame.view.maxLevel).toBe(25);
        frame.zoomTo(1000);
        expect(frame.view.level).toBeCloseTo(25, 9);
    });

    it('starts at the view it is given, and takes your own largest zoom', () => {
        const { frame } = shown({
            zoom: { view: { start: 0.5, end: 0.75 }, max: 8 },
            peaks: HALVES,
        });

        expect(frame.view).toMatchObject({
            start: 0.5,
            end: 0.75,
            maxLevel: 8,
        });

        frame.zoomBy(10);
        expect(frame.view.level).toBeCloseTo(8, 9);

        frame.scrollTo(0.9);
        expect(frame.view.start).toBeCloseTo(0.875, 12);
        expect(frame.view.end).toBe(1);
    });
});

describe('zoom keys', () => {
    it('zoom in and out around the playing position, and back to the whole sound', () => {
        const { frame, container } = shown({
            zoom: { keys: true },
            peaks: HALVES,
        });
        frame.setProgress(0.8);

        expect(key(container, '+').defaultPrevented).toBe(true);
        expect(frame.view.start).toBeCloseTo(0.4, 12);
        expect(frame.view.end).toBeCloseTo(0.9, 12);

        key(container, '=');
        expect(frame.view.level).toBeCloseTo(4, 9);

        key(container, '-');
        expect(frame.view.level).toBeCloseTo(2, 9);

        key(container, '0');
        expect(frame.view.level).toBe(1);
    });

    it('leave Ctrl + key to the browser, and are off unless asked', () => {
        const { frame, container } = shown({ zoom: true, peaks: HALVES });

        expect(key(container, '+').defaultPrevented).toBe(false);
        expect(frame.view.level).toBe(1);

        frame.destroy();
        mounted?.unmount();
        const other = shown({ zoom: { keys: true }, peaks: HALVES });

        expect(
            key(other.container, '+', { ctrlKey: true }).defaultPrevented,
        ).toBe(false);
        expect(other.frame.view.level).toBe(1);
    });

    it('zoom around the middle when the anchor says so, or when the position is out of view', () => {
        const { frame, container } = shown({
            zoom: {
                keys: true,
                anchor: 'center',
                view: { start: 0, end: 0.5 },
            },
            peaks: HALVES,
        });
        frame.setProgress(0.1);

        key(container, '+');

        expect(frame.view.start).toBeCloseTo(0.125, 12);
        expect(frame.view.end).toBeCloseTo(0.375, 12);
    });

    it('bring a keyboard seek outside the view into it, unless switched off', () => {
        const media = fakeMedia({ duration: 100 });
        const { frame, container } = shown({ zoom: true, media });
        frame.setView(0, 0.25);

        key(container, 'End');

        expect(frame.view.start).toBeCloseTo(0.75, 12);
        expect(frame.view.end).toBe(1);

        frame.destroy();
        mounted?.unmount();
        const other = shown({ zoom: { revealKeys: false }, media });
        other.frame.setView(0, 0.25);

        key(other.container, 'End');

        expect(other.frame.view.end).toBeCloseTo(0.25, 12);
    });
});

describe('the wheel', () => {
    it('zooms around the pointer with Ctrl held, and leaves a plain wheel to the page', () => {
        const { frame, container } = shown({
            zoom: { wheel: true },
            peaks: HALVES,
        });

        expect(
            wheel(container, { deltaY: -100, clientX: 50 }).defaultPrevented,
        ).toBe(false);
        expect(frame.view.level).toBe(1);

        const event = wheel(container, {
            deltaY: -200,
            clientX: 50,
            ctrlKey: true,
        });

        expect(event.defaultPrevented).toBe(true);
        expect(frame.view.level).toBeGreaterThan(1);
        // The sound under the pointer (25%) stays under it.
        expect(
            frame.view.start + 0.25 * (frame.view.end - frame.view.start),
        ).toBeCloseTo(0.25, 9);
    });

    it('takes the modifier you choose', () => {
        const { frame, container } = shown({
            zoom: { wheel: true, wheelModifier: 'none' },
            peaks: HALVES,
        });

        wheel(container, { deltaY: -100, clientX: 100 });

        expect(frame.view.level).toBeGreaterThan(1);
    });

    it('scrolls the view sideways when scrolling is on, and leaves the wheel alone at the whole sound', () => {
        const { frame, container } = shown({
            zoom: { scroll: true },
            peaks: HALVES,
        });

        expect(wheel(container, { deltaX: 100 }).defaultPrevented).toBe(false);

        frame.setView(0.25, 0.5);
        expect(wheel(container, { deltaX: 100 }).defaultPrevented).toBe(true);
        expect(frame.view.start).toBeCloseTo(0.375, 12);

        wheel(container, { deltaY: -100, shiftKey: true });
        expect(frame.view.start).toBeCloseTo(0.25, 12);
    });
});

describe('following the position', () => {
    it('turns pages while playing, held by a scroll of the person until the next play', async () => {
        const media = fakeMedia({ duration: 100, paused: false });
        const { frame, container } = shown({
            zoom: { follow: true, scroll: true },
            media,
            peaks: HALVES,
        });
        frame.setView(0, 0.25);

        media.currentTime = 30;
        await nextFrame();
        expect(frame.view.start).toBeCloseTo(0.25, 12);

        wheel(container, { deltaX: 100 });
        const held = frame.view.start;
        media.currentTime = 80;
        await nextFrame();
        expect(frame.view.start).toBe(held);

        // Released, it turns one page from 0.375: 0.625 to 0.875 holds 0.8.
        media.fire('play');
        await nextFrame();
        expect(frame.view.start).toBeCloseTo(0.625, 12);
    });

    it('keeps the position in the middle when centering', async () => {
        const media = fakeMedia({ duration: 100, paused: false });
        const { frame } = shown({
            zoom: { follow: true, followType: 'center' },
            media,
            peaks: HALVES,
        });
        frame.setView(0, 0.25);

        media.currentTime = 50;
        await nextFrame();

        expect(frame.view.start).toBeCloseTo(0.375, 12);
        expect(frame.view.end).toBeCloseTo(0.625, 12);
    });

    it('is released by a seek too', async () => {
        const media = fakeMedia({ duration: 100, paused: false });
        const { frame, container } = shown({
            zoom: { follow: true, scroll: true },
            media,
            peaks: HALVES,
        });
        frame.setView(0, 0.25);
        wheel(container, { deltaX: 100 });

        frame.seekTo(0.9);
        media.currentTime = 90;
        await nextFrame();

        expect(frame.view.end).toBe(1);
    });

    it('stays still while paused, and unless switched on', async () => {
        const paused = fakeMedia({ duration: 100, paused: true });
        const one = shown({
            zoom: { follow: true },
            media: paused,
            peaks: HALVES,
        });
        one.frame.setView(0, 0.25);
        paused.currentTime = 60;
        paused.fire('timeupdate');
        await nextFrame();

        expect(one.frame.view.start).toBe(0);

        one.frame.destroy();
        one.unmount();
        const media = fakeMedia({ duration: 100, paused: false });
        const { frame } = shown({ zoom: true, media, peaks: HALVES });
        frame.setView(0, 0.25);

        media.currentTime = 60;
        await nextFrame();

        expect(frame.view.start).toBe(0);
    });
});

describe('announcing a zoom', () => {
    const region = (): string =>
        document.querySelector('[aria-live="polite"]')?.textContent ?? '';

    it('says the new view after a zoom by the keys, in your own words when given', () => {
        const media = fakeMedia({ duration: 320 });
        const { container } = shown({
            zoom: { keys: true, anchor: 'center' },
            media,
            peaks: HALVES,
            a11y: { zoom: { announce: true } },
        });

        key(container, '+');
        key(container, '+');

        // Twice 2× around the middle: 4×, from 120 s to 200 s of 320 s.
        expect(region()).toBe('Zoom 4×, 2:00 to 3:20');

        mounted?.frame.destroy();
        mounted?.unmount();
        const other = shown({
            zoom: { keys: true },
            media,
            peaks: HALVES,
            a11y: {
                zoom: {
                    announce: true,
                    words: {
                        view: (level, from, to) => `${level}|${from}|${to}`,
                    },
                },
            },
        });

        key(other.container, '0');
        key(other.container, '+');

        expect(region()).toBe('2|0:00|2:40');
    });

    it('says nothing unless asked', () => {
        const { container } = shown({
            zoom: { keys: true },
            peaks: HALVES,
        });
        const before = region();

        key(container, '+');

        expect(region()).toBe(before);
    });
});
