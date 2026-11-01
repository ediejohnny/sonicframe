/**
 * One player with chapters at a time, on a 480 × 48 host with fake media: made, driven by the
 * keys and the clock, and taken off the page after each test (`cleanUp`). `player` and `host` are
 * the current ones. Shared by the tests of the player's chapters.
 */

import { vi } from 'vite-plus/test';
import {
    createPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { pressKey } from '../../support/events';
import { boxOf, fakeMedia } from '../../support/helpers';

export let player: Player | null = null;
export let host: HTMLElement | null = null;

/** Takes the player and its host off the page, and gives back the globals and methods a test replaced. */
export function cleanUp(): void {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
}

/** Makes `element` (a tag on the page, say) the host taken off after the test. */
export function keep(element: HTMLElement): void {
    host = element;
}

export const ITEMS: { start: number; title: string }[] = [
    { start: 0, title: 'Intro' },
    { start: 25, title: 'Interview' },
    { start: 50, title: 'Songs' },
];

export type Media = ReturnType<typeof fakeMedia>;

export function make(options: Partial<PlayerOptions> = {}): {
    player: Player;
    media: Media;
} {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 480, height: 48 });
    const media =
        (options.media as Media | undefined) ?? fakeMedia({ duration: 100 });
    player = createPlayer({
        container: host,
        peaks: [0.5, 0.5, 0.5, 0.5],
        ...options,
        media,
    });

    return { player, media };
}

export function slider(): HTMLElement {
    return (host as HTMLElement).querySelector(
        '[role="slider"]',
    ) as HTMLElement;
}

/** Presses `key` on the player's slider. */
export function press(key: string, shiftKey = false): void {
    pressKey(slider(), key, { shiftKey });
}

export function part(name: string): HTMLElement | null {
    return (host as HTMLElement).querySelector<HTMLElement>(
        `.sonicframe-${name}`,
    );
}

export const CHAPTER_LINE: PlayerOptions['look'] = {
    line: ['play', 'prevChapter', 'wave', 'nextChapter', 'chapter', 'chapters'],
};
