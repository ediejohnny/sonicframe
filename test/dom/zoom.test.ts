/**
 * Zoom and scroll in the frame: off unless asked; with it on, the view moves by the API, the keys,
 * the wheel, two fingers, the playing position and a drag at an edge, each only when switched on.
 * The bars on screen come from the view, a press maps through it, the cursor shows only while the
 * position is in view, plugins get the view, and a zoom by the keys can be announced.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { PaintContext, ViewState } from '../../src/index';
import { recordingOf, triggerResize, triggerVisible } from './fakes';
import { fakeMedia, mount, nextFrame, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

/** Mounts a 200 × 40 frame with pixels, on screen. */
function shown(options: Parameters<typeof mount>[0]): Mounted {
    mounted = mount(options);
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);

    return mounted;
}

/** The bars of the last wave drawn: their x and height, in device pixels. */
function lastBars(canvas: HTMLCanvasElement): { x: number; height: number }[] {
    const paths = recordingOf(canvas).paths;

    for (let i = paths.length - 1; i >= 0; i--) {
        const bars = paths[i].calls.filter((call) => call[0] === 'roundRect');

        if (bars.length > 0) {
            return bars.map((call) => ({
                x: call[1] as number,
                height: call[4] as number,
            }));
        }
    }

    return [];
}

function press(
    type: string,
    clientX: number,
    extra: Partial<{
        pointerId: number;
        pointerType: string;
        isPrimary: boolean;
    }> = {},
): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clientX,
        clientY: 10,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        shiftKey: false,
        ...extra,
    });
}

function key(
    target: HTMLElement,
    name: string,
    modifiers: { ctrlKey?: boolean } = {},
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
        ...modifiers,
    });
    target.dispatchEvent(event);

    return event;
}

function wheel(target: HTMLElement, init: WheelEventInit): WheelEvent {
    const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
    });

    // happy-dom's WheelEvent drops the modifier keys and the pointer's x of its init; give them back.
    for (const name of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey'] as const) {
        Object.defineProperty(event, name, { value: init[name] ?? false });
    }

    Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 });

    target.dispatchEvent(event);

    return event;
}

const HALVES = [
    ...Array.from({ length: 500 }, () => 0),
    ...Array.from({ length: 500 }, () => 1),
];

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

describe('what the frame draws with a view', () => {
    it('draws the bars of the view only, from the detail of the peaks', async () => {
        // No growing bars, so every picture shows the peaks at their height.
        const { frame, canvas } = shown({
            zoom: true,
            peaks: HALVES,
            animate: false,
        });
        await nextFrame();
        const whole = lastBars(canvas);

        expect(whole.filter((bar) => bar.height === 40).length).toBe(
            whole.length / 2,
        );

        frame.setView(0.6, 0.9);
        await nextFrame();
        const zoomed = lastBars(canvas);

        expect(zoomed.length).toBeGreaterThan(0);
        expect(zoomed.every((bar) => bar.height === 40)).toBe(true);

        // New peaks: the zoomed bars come from them, not from the old ones.
        frame.setPeaks(HALVES.map((value) => 1 - value));
        await nextFrame();
        const flipped = lastBars(canvas);

        expect(flipped.length).toBeGreaterThan(0);
        expect(flipped.every((bar) => bar.height === 2)).toBe(true);
    });

    it('draws the same picture as without zoom while the whole sound is in view', async () => {
        const plain = shown({ peaks: HALVES.map((v, i) => v * ((i % 7) / 7)) });
        await nextFrame();
        const before = lastBars(plain.canvas);
        plain.frame.destroy();
        plain.unmount();

        const { canvas } = shown({
            zoom: true,
            peaks: HALVES.map((v, i) => v * ((i % 7) / 7)),
        });
        await nextFrame();

        expect(lastBars(canvas)).toEqual(before);
    });

    it('shows the cursor only while the position is in view', async () => {
        const { frame, canvas } = shown({
            zoom: { view: { start: 0.5, end: 1 } },
            peaks: HALVES,
            colors: { cursor: 'red' },
        });
        const cursors = (): number =>
            recordingOf(canvas).ops.filter((op) => op === 'fillRect').length;

        frame.setProgress(0.2);
        await nextFrame();
        const hidden = cursors();

        frame.setProgress(0.7);
        await nextFrame();

        expect(hidden).toBe(0);
        expect(cursors()).toBe(1);
    });

    it('gives plugins the view, with xAt and ratioAt through it', async () => {
        const seen: { view: ViewState; x: number; ratio: number }[] = [];
        const { frame } = shown({ zoom: true, peaks: HALVES });
        frame.use({
            name: 'probe',
            draw: (paint: PaintContext) =>
                seen.push({
                    view: paint.view,
                    x: paint.xAt(0.625),
                    ratio: paint.ratioAt(100),
                }),
        });
        frame.setView(0.5, 0.75);
        await nextFrame();

        expect(seen.at(-1)).toMatchObject({
            view: { start: 0.5, end: 0.75, level: 4 },
            x: 100,
            ratio: 0.625,
        });
        expect(frame.view).toEqual(seen.at(-1)?.view);
    });
});

describe('a press with a view', () => {
    it('seeks to the sound under the pointer through the view', () => {
        const media = fakeMedia({ duration: 100 });
        const { frame, container } = shown({ zoom: true, media });
        frame.setView(0.5, 0.75);

        container.dispatchEvent(press('pointerdown', 100));
        container.dispatchEvent(press('pointerup', 100));

        expect(media.currentTime).toBeCloseTo(62.5, 9);
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

describe('two fingers', () => {
    it('zoom with the distance between them and drag the view with their middle', () => {
        const { frame, container } = shown({
            zoom: { pinch: true },
            peaks: HALVES,
        });
        const touch = (id: number, primary: boolean) => ({
            pointerId: id,
            pointerType: 'touch',
            isPrimary: primary,
        });

        container.dispatchEvent(press('pointerdown', 50, touch(1, true)));
        container.dispatchEvent(press('pointerdown', 150, touch(2, false)));
        container.dispatchEvent(press('pointermove', 250, touch(2, false)));

        // Twice as far apart: 2×. The middle (100 px, the sound's middle) moved to 150 px.
        expect(frame.view.level).toBeCloseTo(2, 9);
        expect(frame.view.start).toBeCloseTo(0.125, 9);

        // Three times as far apart: 3×, the middle now at 200 px.
        container.dispatchEvent(press('pointermove', 350, touch(2, false)));
        expect(frame.view.level).toBeCloseTo(3, 9);
        expect(frame.view.start).toBeCloseTo(0.5 - 1 / 3, 9);

        container.dispatchEvent(press('pointerup', 350, touch(2, false)));
        container.dispatchEvent(press('pointerup', 50, touch(1, true)));
    });

    it('do nothing unless switched on', () => {
        const { frame, container } = shown({ zoom: true, peaks: HALVES });

        container.dispatchEvent(
            press('pointerdown', 50, { pointerType: 'touch', pointerId: 1 }),
        );
        container.dispatchEvent(
            press('pointerdown', 150, {
                pointerType: 'touch',
                pointerId: 2,
                isPrimary: false,
            }),
        );
        container.dispatchEvent(
            press('pointermove', 250, {
                pointerType: 'touch',
                pointerId: 2,
                isPrimary: false,
            }),
        );

        expect(frame.view.level).toBe(1);
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

describe('dragging at an edge', () => {
    it('scrolls the view, and the drag lands on the sound now under the pointer', async () => {
        const media = fakeMedia({ duration: 100 });
        const { frame, container } = shown({
            zoom: { edgeScroll: true, edgeSpeed: 10 },
            media,
            peaks: HALVES,
        });
        const sources: string[] = [];
        frame.on('viewchange', (_view, source) => sources.push(source));
        frame.setView(0.25, 0.5);

        container.dispatchEvent(press('pointerdown', 100));
        container.dispatchEvent(press('pointermove', 195));

        for (let i = 0; i < 4; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await nextFrame();
        }

        const view = frame.view;
        const dragged = frame.progress;
        container.dispatchEvent(press('pointerup', 195));

        expect(view.start).toBeGreaterThan(0.25);
        expect(sources).toContain('edge');
        // While held, the drag already shows the sound now under the pointer.
        expect(dragged).toBeCloseTo(
            view.start + (195 / 200) * (view.end - view.start),
            9,
        );
        expect(media.currentTime / 100).toBeCloseTo(
            view.start + (195 / 200) * (view.end - view.start),
            9,
        );
    });

    it('scrolls back at the left edge, and never in the middle', async () => {
        const { frame, container } = shown({
            zoom: { edgeScroll: true, edgeSpeed: 10 },
            peaks: HALVES,
        });
        frame.setView(0.5, 0.75);

        container.dispatchEvent(press('pointerdown', 100));
        container.dispatchEvent(press('pointermove', 110));

        for (let i = 0; i < 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await nextFrame();
        }

        expect(frame.view.start).toBe(0.5);

        container.dispatchEvent(press('pointermove', 4));

        for (let i = 0; i < 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            await nextFrame();
        }

        container.dispatchEvent(press('pointerup', 4));
        expect(frame.view.start).toBeLessThan(0.5);
    });

    it('stays still unless switched on', async () => {
        const { frame, container } = shown({ zoom: true, peaks: HALVES });
        frame.setView(0.25, 0.5);

        container.dispatchEvent(press('pointerdown', 100));
        container.dispatchEvent(press('pointermove', 199));
        await new Promise((resolve) => setTimeout(resolve, 40));
        await nextFrame();
        container.dispatchEvent(press('pointerup', 199));

        expect(frame.view.start).toBeCloseTo(0.25, 12);
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
