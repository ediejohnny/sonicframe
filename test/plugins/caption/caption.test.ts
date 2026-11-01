/**
 * The caption plugin on the page: the line shows text (never HTML), it shrinks the wave, the full
 * text reaches screen readers through `aria-describedby`, and the tooltip opens on hover and a tap,
 * closes on Escape, and stays while the pointer rests on it.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { sharedTooltip } from '../../../src/dom/shared/tooltip';
import {
    caption,
    type CaptionOptions,
    type CaptionPlugin,
} from '../../../src/index';
import { mount, tooltipTextOnPale, type Mounted } from '../../support/helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    sharedTooltip().hide();
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

/** The line of a frame with a caption longer than it shows. */
function longLine(): HTMLElement {
    mounted = mount({
        plugins: [caption({ text: 'a longer caption to show' })],
    });

    return line() as HTMLElement;
}

/** The pointer comes over `target` and leaves it. */
function passOver(target: HTMLElement): void {
    fire(target, 'pointerenter');
    fire(target, 'pointerleave');
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

    it('keeps the usual 20 px lane when the size is not a number', () => {
        for (const size of [Number.NaN, '30' as unknown as number]) {
            mounted = mount({ plugins: [caption({ text: 'hello', size })] });

            expect(mounted.canvas.style.getPropertyValue('height')).toBe(
                'calc(100% - 20px)',
            );
        }
    });

    it('cuts the tooltip at the usual 280 characters when a limit is not a number', () => {
        for (const limit of [Number.NaN, '3' as unknown as number]) {
            // The section's own limit first, then the plugin's, once the tooltip is plain text.
            const plugin = caption({
                text: 'hello there',
                tooltip: [{ text: 'hello there', limit }],
                tooltipLimit: limit,
            });
            mounted = mount({ plugins: [plugin] });
            fire(line() as HTMLElement, 'pointerenter');
            expect(sharedTooltip().element.textContent).toBe('hello there');

            plugin.setTooltip('hello there');
            fire(line() as HTMLElement, 'pointerenter');
            expect(sharedTooltip().element.textContent).toBe('hello there');
        }
    });

    it('takes its height in pixels or written with its unit, over the old size', () => {
        // A rem is 16 px.
        const cases: [CaptionOptions, string][] = [
            [{ height: 24 }, 'calc(100% - 24px)'],
            [{ height: '1.5rem' }, 'calc(100% - 24px)'],
            [{ height: '18px', size: 30 }, 'calc(100% - 18px)'],
            [{ size: 30 }, 'calc(100% - 30px)'],
        ];

        for (const [options, height] of cases) {
            mounted = mount(
                { plugins: [caption({ text: 'hello', ...options })] },
                { left: 0, top: 0, width: 200, height: 60 },
            );

            expect(mounted.canvas.style.getPropertyValue('height')).toBe(
                height,
            );
        }
    });

    it('cuts the tooltip at tooltipMax and a section at its max, over the old names', () => {
        // Cut at the last whole word that fits: 7 keeps "one two", 14 "one two three", 3 "one";
        // the mark after a cut is a thin space and "(...)".
        const more = `${String.fromCharCode(0x2009)}(...)`;
        const plugin = caption({
            text: 'one two three four',
            tooltipMax: 7,
            tooltipLimit: 14,
        });
        mounted = mount({ plugins: [plugin] });
        fire(line() as HTMLElement, 'pointerenter');
        expect(sharedTooltip().element.textContent).toBe(`one two${more}`);

        plugin.setTooltip([
            { text: 'one two three four', max: 3, limit: 14 },
            { text: 'one two three four', limit: 14 },
        ]);
        fire(line() as HTMLElement, 'pointerenter');
        expect(sharedTooltip().element.textContent).toBe(
            `one${more}one two three${more}`,
        );
    });

    it("writes the tooltip in black or white that reads by default, and in the page's color with readable off", () => {
        const hovered = (readable?: boolean): string => {
            mounted = mount({
                plugins: [
                    caption({ text: 'hello', a11y: { tooltip: { readable } } }),
                ],
            });

            return tooltipTextOnPale(mounted.container, () =>
                fire(line() as HTMLElement, 'pointerenter'),
            );
        };

        expect(hovered()).toBe('rgba(0, 0, 0, 1)');
        expect(hovered(false)).toBe('#ffffff');
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

    it('leaves the page own aria-describedby alone when a caption that never showed is cleared', () => {
        mounted = mount();
        mounted.container.setAttribute('aria-describedby', 'page-help');
        const plugin: CaptionPlugin = caption();
        mounted.frame.use(plugin);

        plugin.set(null);

        expect(mounted.container.getAttribute('aria-describedby')).toBe(
            'page-help',
        );
    });

    it('takes out only its own id, keeping what the page added meanwhile', () => {
        mounted = mount();
        mounted.container.setAttribute('aria-describedby', 'page-help');
        const plugin: CaptionPlugin = caption({ text: 'hello' });
        mounted.frame.use(plugin);
        const shown = mounted.container.getAttribute('aria-describedby');
        mounted.container.setAttribute(
            'aria-describedby',
            `${shown} page-more`,
        );

        plugin.set(null);
        plugin.set(null);

        expect(mounted.container.getAttribute('aria-describedby')).toBe(
            'page-help page-more',
        );
    });

    it('gives the page its own ids back when the frame is destroyed', () => {
        mounted = mount();
        mounted.container.setAttribute('aria-describedby', 'page-help');
        mounted.frame.use(caption({ text: 'hello' }));
        const shown = mounted.container.getAttribute('aria-describedby');
        mounted.container.setAttribute(
            'aria-describedby',
            `${shown} page-more`,
        );

        mounted.frame.destroy();

        expect(mounted.container.getAttribute('aria-describedby')).toBe(
            'page-help page-more',
        );
    });

    it('opens the tooltip on hover and is lazy until then', () => {
        const shown = longLine();

        expect(sharedTooltip().open).toBe(false);

        fire(shown, 'pointerenter');
        expect(sharedTooltip().open).toBe(true);
    });

    it('closes the tooltip on Escape', () => {
        fire(longLine(), 'pointerenter');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(sharedTooltip().open).toBe(false);
    });

    it('stays open while the pointer rests on the tooltip', () => {
        vi.useFakeTimers();
        passOver(longLine());
        fire(sharedTooltip().element, 'pointerenter');
        vi.advanceTimersByTime(300);

        expect(sharedTooltip().open).toBe(true);
    });

    it('closes after the pointer leaves both the caption and the tooltip', () => {
        vi.useFakeTimers();
        passOver(longLine());
        vi.advanceTimersByTime(300);

        expect(sharedTooltip().open).toBe(false);
    });

    it('toggles the tooltip on a tap', () => {
        const shown = longLine();

        fire(shown, 'pointerup', 'touch');
        expect(sharedTooltip().open).toBe(true);

        fire(shown, 'pointerup', 'touch');
        expect(sharedTooltip().open).toBe(false);
    });
});
