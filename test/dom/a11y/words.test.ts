/**
 * What each piece says on its own, before an app gives it words: English, from the language files.
 * These are the names and announcements a screen reader hears.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { PlayButton, regions, VolumeControl } from '../../../src/index';
import { fakeMedia, mount, type Mounted } from '../../support/helpers';

let mounted: Mounted | null = null;
const cleanups: (() => void)[] = [];

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;

    for (const cleanup of cleanups.splice(0)) {
        cleanup();
    }
});

function host(): HTMLElement {
    const element = document.createElement('div');
    document.body.append(element);
    cleanups.push(() => element.remove());

    return element;
}

function press(target: HTMLElement, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** What the page's live region says now. */
function heard(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

describe('what each piece says on its own', () => {
    it('names the wave a slider of the audio position, unless the app names it', () => {
        mounted = mount({ media: fakeMedia({ duration: 10 }) });

        expect(mounted.container.getAttribute('aria-label')).toBe(
            'Audio position',
        );

        mounted.frame.destroy();
        mounted.unmount();
        mounted = mount({
            media: fakeMedia({ duration: 10 }),
            label: 'Voice note',
        });

        expect(mounted.container.getAttribute('aria-label')).toBe('Voice note');
    });

    it('names the play button by what a press does: Play, and Pause while it plays', () => {
        const paused = PlayButton.create({
            container: host(),
            media: fakeMedia({ duration: 10 }),
        });
        const playing = PlayButton.create({
            container: host(),
            media: fakeMedia({ duration: 10, paused: false }),
        });
        cleanups.push(
            () => paused.destroy(),
            () => playing.destroy(),
        );

        expect(paused.element.getAttribute('aria-label')).toBe('Play');
        expect(playing.element.getAttribute('aria-label')).toBe('Pause');
    });

    it('names the volume slider, and says muted for its value while muted', () => {
        const element = host();
        const control = VolumeControl.create({
            container: element,
            media: fakeMedia({ duration: 10 }),
        });
        cleanups.push(() => control.destroy());
        const bar = element.querySelector('[role="slider"]');

        expect(bar?.getAttribute('aria-label')).toBe('Volume');

        element.querySelector('button')?.click();

        expect(bar?.getAttribute('aria-valuetext')).toBe('muted');
    });

    it('says where a region is when R selects it, and whether L turned its loop on', () => {
        mounted = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [
                regions({
                    items: [
                        { start: 8, end: 16, label: 'Intro' },
                        { start: 20, end: 30 },
                    ],
                }),
            ],
        });

        press(mounted.container, 'r');
        expect(heard()).toBe('Intro, 0:08 to 0:16');

        press(mounted.container, 'r');
        expect(heard()).toBe('0:20 to 0:30');

        press(mounted.container, 'l');
        expect(heard()).toBe('loop on');

        press(mounted.container, 'l');
        expect(heard()).toBe('loop off');
    });
});
