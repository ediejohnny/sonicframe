/**
 * The caption plugin on the page: the line shows text (never HTML), it shrinks the wave, the full
 * text reaches screen readers through `aria-describedby`, and the tooltip opens on hover and a tap,
 * closes on Escape, and stays while the pointer rests on it.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { caption, type CaptionPlugin } from '../../src/index';
import { mount, type Mounted } from './helpers';
import { sharedTooltip } from '../../src/dom/tooltip';

let mounted: Mounted | null = null;

afterEach(() => {
    sharedTooltip().hide();
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
    vi.useRealTimers();
});

function line(): HTMLElement | null {
    return mounted?.container.querySelector('span[dir="auto"]') ?? null;
}

function fire(target: EventTarget, type: string, pointerType = 'mouse'): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), { pointerType }),
    );
}

describe('the caption plugin', () => {
    it('shows the caption as text, never as HTML', () => {
        const plugin = caption({ text: '<b>hi</b> & bye' });
        mounted = mount({ plugins: [plugin] });

        const span = line();
        expect(span?.childElementCount).toBe(0);
        expect(span?.textContent).toBe('<b>hi</b> & bye');
    });

    it('shrinks the wave to make room for the caption lane', () => {
        const plugin = caption({ text: 'hello', size: 20 });
        mounted = mount(
            { plugins: [plugin] },
            {
                left: 0,
                top: 0,
                width: 200,
                height: 40,
            },
        );

        expect(mounted.canvas.style.getPropertyValue('height')).toBe(
            'calc(100% - 20px)',
        );
    });

    it('gives the room back when the caption is cleared', () => {
        const plugin: CaptionPlugin = caption({ text: 'hello' });
        mounted = mount({ plugins: [plugin] });

        plugin.set(null);

        expect(mounted.canvas.style.getPropertyValue('height')).toBe('100%');
        expect(line()).toBeNull();
    });

    it('exposes the full text to screen readers via aria-describedby', () => {
        const plugin = caption({ text: 'the whole sentence' });
        mounted = mount({ plugins: [plugin] });

        const id = mounted.container.getAttribute('aria-describedby');
        expect(id).not.toBeNull();
        const full = mounted.container.querySelector(`#${id}`);
        expect(full?.textContent).toBe('the whole sentence');
    });

    it('restores aria-describedby when cleared', () => {
        const plugin: CaptionPlugin = caption({ text: 'hello' });
        mounted = mount({ plugins: [plugin] });

        plugin.set(null);

        expect(mounted.container.getAttribute('aria-describedby')).toBeNull();
    });

    it('opens the tooltip on hover and is lazy until then', () => {
        const plugin = caption({ text: 'a longer caption to show' });
        mounted = mount({ plugins: [plugin] });

        expect(sharedTooltip().open).toBe(false);

        fire(line() as HTMLElement, 'pointerenter');
        expect(sharedTooltip().open).toBe(true);
    });

    it('closes the tooltip on Escape', () => {
        const plugin = caption({ text: 'a longer caption to show' });
        mounted = mount({ plugins: [plugin] });

        fire(line() as HTMLElement, 'pointerenter');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(sharedTooltip().open).toBe(false);
    });

    it('stays open while the pointer rests on the tooltip', () => {
        vi.useFakeTimers();
        const plugin = caption({ text: 'a longer caption to show' });
        mounted = mount({ plugins: [plugin] });

        fire(line() as HTMLElement, 'pointerenter');
        fire(line() as HTMLElement, 'pointerleave');
        fire(sharedTooltip().element, 'pointerenter');
        vi.advanceTimersByTime(300);

        expect(sharedTooltip().open).toBe(true);
    });

    it('closes after the pointer leaves both the caption and the tooltip', () => {
        vi.useFakeTimers();
        const plugin = caption({ text: 'a longer caption to show' });
        mounted = mount({ plugins: [plugin] });

        fire(line() as HTMLElement, 'pointerenter');
        fire(line() as HTMLElement, 'pointerleave');
        vi.advanceTimersByTime(300);

        expect(sharedTooltip().open).toBe(false);
    });

    it('toggles the tooltip on a tap', () => {
        const plugin = caption({ text: 'a longer caption to show' });
        mounted = mount({ plugins: [plugin] });

        fire(line() as HTMLElement, 'pointerup', 'touch');
        expect(sharedTooltip().open).toBe(true);

        fire(line() as HTMLElement, 'pointerup', 'touch');
        expect(sharedTooltip().open).toBe(false);
    });
});
