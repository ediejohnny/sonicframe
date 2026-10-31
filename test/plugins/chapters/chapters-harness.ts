/**
 * The chapters plugin's tests share a sound of four chapters (one out of the contents), a frame of
 * it on screen, and what the page's live region says.
 */

import {
    chapters,
    type ChaptersOptions,
    type ChaptersPlugin,
    type Plugin,
} from '../../../src/index';
import { fakeMedia, mountShown, type Mounted } from '../../support/helpers';

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
    return { ...mountShown({ media, plugins, animate: false }), media };
}

/** What the page's live region says now. */
export function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

export function plugin(options: ChaptersOptions = {}): ChaptersPlugin {
    return chapters({ items: ITEMS, color: 'red', ...options });
}
