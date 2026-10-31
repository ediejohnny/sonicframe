/**
 * The chapters plugin's tests share a sound of four chapters (one out of the contents), a frame of
 * it on screen, and the keys, the pointer and the live region a person meets.
 */

import {
    chapters,
    type ChaptersOptions,
    type ChaptersPlugin,
    type Plugin,
} from '../../../src/index';
import { triggerResize, triggerVisible } from '../../support/fakes';
import { fakeMedia, mount, type Mounted } from '../../support/helpers';

export type Media = ReturnType<typeof fakeMedia>;

export const ITEMS: { start: number; title: string; toc?: boolean }[] = [
    { start: 0, title: 'Intro' },
    { start: 25, title: 'Interview' },
    { start: 50, title: '' },
    { start: 75, title: 'Hidden', toc: false },
];

/** A 200 × 40 frame of a 100-second sound, with pixels and on screen. */
export function showFrame(
    plugins: Plugin[],
    media: Media = fakeMedia({ duration: 100 }),
): Mounted & { media: Media } {
    const mounted = mount({ media, plugins, animate: false });
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);

    return { ...mounted, media };
}

export function press(
    target: HTMLElement,
    key: string,
    shiftKey = false,
): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
    );
}

export function pointer(
    target: HTMLElement,
    type: string,
    clientX: number,
): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
            clientX,
            clientY: 10,
            pointerId: 1,
            isPrimary: true,
            button: 0,
            pointerType: 'mouse',
            shiftKey: false,
        }),
    );
}

/** What the page's live region says now. */
export function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

export function at(media: Media, time: number): void {
    media.currentTime = time;
    media.fire('timeupdate');
}

export function plugin(options: ChaptersOptions = {}): ChaptersPlugin {
    return chapters({ items: ITEMS, color: 'red', ...options });
}
