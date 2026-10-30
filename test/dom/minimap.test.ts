/**
 * The minimap: a strip with the whole sound and a box over the part in view. It is hidden from
 * screen readers unless `a11y.keys` turns it into a keyboard slider; dragging the box, clicking
 * beside it and the wheel move the view, each with its own switch; it can hide itself at the whole
 * sound, and it paints the played part only when asked.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { minimap, type MinimapOptions } from '../../src/index';
import { recordingOf, triggerResize, triggerVisible } from './fakes';
import { boxOf, fakeMedia, mount, nextFrame, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

/** A 200 px wide frame of a 100-second sound with a minimap, zoom on. */
function shown(options: MinimapOptions = {}): {
    mounted: Mounted;
    strip: HTMLElement;
    map: HTMLCanvasElement;
} {
    mounted = mount(
        {
            zoom: true,
            media: fakeMedia({ duration: 100 }),
            peaks: Array.from({ length: 400 }, (_, i) => (i % 10) / 10),
            plugins: [minimap(options)],
            animate: false,
        },
        { left: 0, top: 0, width: 200, height: 64 },
    );
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);

    const strip = mounted.container.querySelector<HTMLElement>(
        '.sonicframe-minimap',
    );
    const map = strip?.querySelector('canvas');

    if (strip === null || map === null || map === undefined) {
        throw new Error('test: no minimap');
    }

    boxOf(strip, { left: 0, top: 40, width: 200, height: 24 });

    return { mounted, strip, map };
}

function pointer(type: string, clientX: number): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clientX,
        clientY: 50,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
    });
}

function key(target: HTMLElement, name: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
    });
    target.dispatchEvent(event);

    return event;
}

describe('the minimap strip', () => {
    it('sits below the wave, hidden from screen readers and out of the tab order by default', () => {
        const { strip } = shown();

        expect(strip.getAttribute('aria-hidden')).toBe('true');
        expect(strip.hasAttribute('tabindex')).toBe(false);
        expect(strip.hasAttribute('role')).toBe(false);
    });

    it('draws a box over the part in view, in the colors given', async () => {
        const { mounted: frame, map } = shown({
            colors: { view: 'red', edge: 'blue' },
        });
        frame.frame.setView(0.25, 0.5);
        await nextFrame();
        const rects = recordingOf(map).rects;

        expect(
            rects.filter((rect) => rect.fill === 'red').at(-1),
        ).toMatchObject({
            x: 50,
            width: 50,
        });
        expect(
            rects.filter((rect) => rect.fill === 'blue').map((rect) => rect.x),
        ).toContain(50);
    });

    it('draws no box while the whole sound is in view', async () => {
        const { map } = shown({ colors: { view: 'red' } });
        await nextFrame();

        expect(recordingOf(map).rects.some((rect) => rect.fill === 'red')).toBe(
            false,
        );
    });

    it('paints the played part, unless told not to', async () => {
        const played = shown({ colors: { progress: 'lime' } });
        played.mounted.frame.seekTo(0.5);
        await nextFrame();

        expect(recordingOf(played.map).fills).toContain('lime');

        played.mounted.frame.destroy();
        played.mounted.unmount();
        const plain = shown({ colors: { progress: 'lime' }, progress: false });
        plain.mounted.frame.seekTo(0.5);
        await nextFrame();

        expect(recordingOf(plain.map).fills).not.toContain('lime');
    });
});

describe('moving the view from the minimap', () => {
    it('drags the box to scroll the view', () => {
        const { mounted: frame, strip } = shown();
        const sources: string[] = [];
        frame.frame.on('viewchange', (_view, source) => sources.push(source));
        frame.frame.setView(0.25, 0.5);

        strip.dispatchEvent(pointer('pointerdown', 75));
        strip.dispatchEvent(pointer('pointermove', 125));
        strip.dispatchEvent(pointer('pointerup', 125));

        expect(frame.frame.view.start).toBeCloseTo(0.5, 12);
        expect(frame.frame.view.end).toBeCloseTo(0.75, 12);
        expect(sources.at(-1)).toBe('minimap');
    });

    it('centers the view where a click lands beside the box', () => {
        const { mounted: frame, strip } = shown();
        frame.frame.setView(0, 0.25);

        strip.dispatchEvent(pointer('pointerdown', 100));
        strip.dispatchEvent(pointer('pointerup', 100));

        expect(frame.frame.view.start).toBeCloseTo(0.375, 12);
        expect(frame.frame.view.end).toBeCloseTo(0.625, 12);
    });

    it('never seeks the sound', () => {
        const { mounted: frame, strip } = shown();
        frame.frame.setView(0, 0.25);

        strip.dispatchEvent(pointer('pointerdown', 100));
        strip.dispatchEvent(pointer('pointerup', 100));

        expect(frame.frame.progress).toBe(0);
    });

    it('drags the box but ignores a click beside it when clicks are off', () => {
        const { mounted: frame, strip } = shown({ controls: { click: false } });
        frame.frame.setView(0, 0.25);

        strip.dispatchEvent(pointer('pointerdown', 100));
        strip.dispatchEvent(pointer('pointermove', 150));
        strip.dispatchEvent(pointer('pointerup', 150));

        expect(frame.frame.view.start).toBe(0);
        expect(strip.style.getPropertyValue('pointer-events')).toBe('auto');
    });

    it('does neither when its controls are off, and lets the pointer through', () => {
        const { mounted: frame, strip } = shown({
            controls: { drag: false, click: false },
        });
        frame.frame.setView(0.25, 0.5);

        strip.dispatchEvent(pointer('pointerdown', 75));
        strip.dispatchEvent(pointer('pointermove', 125));
        strip.dispatchEvent(pointer('pointerdown', 180));

        expect(frame.frame.view.start).toBeCloseTo(0.25, 12);
        expect(strip.style.getPropertyValue('pointer-events')).toBe('none');
    });

    it('zooms with the wheel around the pointer only when switched on', () => {
        const wheel = (strip: HTMLElement): WheelEvent => {
            const event = new WheelEvent('wheel', {
                deltaY: -100,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(event, 'clientX', { value: 50 });
            strip.dispatchEvent(event);

            return event;
        };
        const off = shown();

        expect(wheel(off.strip).defaultPrevented).toBe(false);
        expect(off.mounted.frame.view.level).toBe(1);

        off.mounted.frame.destroy();
        off.mounted.unmount();
        const on = shown({ controls: { wheel: true } });

        expect(wheel(on.strip).defaultPrevented).toBe(true);
        expect(on.mounted.frame.view.level).toBeGreaterThan(1);
        // 25% of the sound stays under the pointer.
        const { start, end } = on.mounted.frame.view;
        expect(start + 0.25 * (end - start)).toBeCloseTo(0.25, 9);
    });
});

describe('hiding at the whole sound', () => {
    it('takes no room while the whole sound is in view, when asked', () => {
        const { mounted: frame, strip } = shown({ autoHide: true });

        expect(strip.style.getPropertyValue('display')).toBe('none');

        frame.frame.setView(0.25, 0.5);

        expect(strip.style.getPropertyValue('display')).toBe('block');
    });
});

describe('the minimap as a keyboard slider', () => {
    it('is a named slider that says the part in view, and keys move it', () => {
        const { mounted: frame, strip } = shown({ a11y: { keys: true } });
        frame.frame.setView(0.25, 0.5);

        expect(strip.getAttribute('role')).toBe('slider');
        expect(strip.getAttribute('tabindex')).toBe('0');
        expect(strip.getAttribute('aria-label')).toBe('Visible part');
        expect(strip.hasAttribute('aria-hidden')).toBe(false);
        expect(strip.getAttribute('aria-valuetext')).toBe(
            '0:25 to 0:50 of 1:40',
        );
        expect(strip.getAttribute('aria-valuenow')).toBe('33');

        expect(key(strip, 'ArrowRight').defaultPrevented).toBe(true);
        expect(frame.frame.view.start).toBeCloseTo(0.3125, 12);

        key(strip, 'PageDown');
        expect(frame.frame.view.start).toBeCloseTo(0.5625, 12);

        key(strip, 'Home');
        expect(frame.frame.view.start).toBe(0);

        key(strip, 'End');
        expect(frame.frame.view.end).toBe(1);
        expect(strip.getAttribute('aria-valuenow')).toBe('100');

        // Its keys move the view only, never the sound.
        expect(frame.frame.progress).toBe(0);
    });

    it('takes your own name and words', () => {
        const { mounted: frame, strip } = shown({
            a11y: {
                keys: true,
                label: 'Parte visível',
                words: { value: (from, to, total) => `${from}-${to}/${total}` },
            },
        });
        frame.frame.setView(0, 0.5);

        expect(strip.getAttribute('aria-label')).toBe('Parte visível');
        expect(strip.getAttribute('aria-valuetext')).toBe('0:00-0:50/1:40');
    });
});
