/**
 * Chapters on the page: lines where chapters start, C / Shift+C between them with what is said, the
 * chapter in the slider's value, the strip of titles, and the chapters kept when the plugin is set
 * up again. The list is in `chapter-list.test.ts`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { sharedTooltip } from '../../../src/dom/shared/tooltip';
import {
    chapters,
    type ChaptersFetcher,
    type Plugin,
} from '../../../src/index';
import { recordingOf } from '../../support/fakes';
import {
    fakeMedia,
    mount,
    nextFrame,
    type Mounted,
} from '../../support/helpers';
import {
    at,
    plugin,
    pointer,
    press,
    said,
    showFrame,
    type Media,
} from './chapters-harness';

let mounted: Mounted | null = null;

afterEach(() => {
    sharedTooltip().hide();
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
    document.querySelector('[role="status"]')?.replaceChildren();
});

function shown(plugins: Plugin[], media?: Media): Mounted & { media: Media } {
    const frame = showFrame(plugins, media);
    mounted = frame;

    return frame;
}

describe('chapters on the wave', () => {
    it('draws a line where each chapter in the contents starts, none at the very start', async () => {
        const { canvas, frame } = shown([plugin()]);
        await nextFrame();
        const from = recordingOf(canvas).rects.length;
        frame.invalidate();
        await nextFrame();

        // 25 s and 50 s of 100 s across 200 px: x = 50 and 100, 2 px wide.
        expect(
            recordingOf(canvas)
                .rects.slice(from)
                .filter((rect) => rect.fill === 'red')
                .map(({ x, width }) => ({ x, width })),
        ).toEqual([
            { x: 49, width: 2 },
            { x: 99, width: 2 },
        ]);
    });

    it('draws no line with lines off', async () => {
        const { canvas, frame } = shown([plugin({ lines: false })]);
        frame.invalidate();
        await nextFrame();

        expect(
            recordingOf(canvas).rects.some((rect) => rect.fill === 'red'),
        ).toBe(false);
    });

    it("goes to a chapter's start when its line is clicked, and names it on hover", () => {
        const { container, media } = shown([plugin()]);

        pointer(container, 'pointermove', 52);
        expect(sharedTooltip().element.textContent).toBe(
            '0:25 · Chapter 2 of 3: Interview',
        );

        pointer(container, 'pointerdown', 52);
        pointer(container, 'pointerup', 52);
        expect(media.currentTime).toBe(25);
    });

    it('still seeks normally away from the lines, and with snap off', () => {
        const { container, media } = shown([plugin({ snap: false })]);

        pointer(container, 'pointerdown', 52);
        pointer(container, 'pointerup', 52);
        expect(media.currentTime).toBe(26);
    });
});

describe('the keys', () => {
    it('steps to the next chapter with C and says where it landed', () => {
        const { container, media } = shown([plugin()]);
        at(media, 10);

        press(container, 'c');
        expect(media.currentTime).toBe(25);
        expect(said()).toBe('Chapter 2 of 3: Interview, 0:25');

        press(container, 'C');
        expect(media.currentTime).toBe(50);
        expect(said()).toBe('Chapter 3 of 3, 0:50');

        press(container, 'c');
        expect(media.currentTime).toBe(50);
        expect(said()).toBe('No more chapters');
    });

    it('steps from the position shown while the sound has not loaded yet (preload none)', () => {
        const changes: number[] = [];
        mounted = mount({
            media: fakeMedia({ readyState: 0 }),
            duration: 100,
            animate: false,
            plugins: [
                plugin({ onChange: (_chapter, index) => changes.push(index) }),
            ],
        });

        press(mounted.container, 'c');
        press(mounted.container, 'c');

        expect(mounted.frame.progress).toBe(0.5);
        expect(said()).toBe('Chapter 3 of 3, 0:50');
        expect(changes).toEqual([0, 1, 2]);
    });

    it('goes back with Shift+C like a previous track, by the Shift key and not the case', () => {
        const { container, media } = shown([plugin()]);

        at(media, 25.5);
        press(container, 'c', true);
        expect(media.currentTime).toBe(0);

        at(media, 40);
        press(container, 'C', true);
        expect(media.currentTime).toBe(25);
    });

    it('takes its own letter and grace, or none', () => {
        const own = shown([
            plugin({
                keys: { letter: 'N', backGrace: 0 },
                words: { none: 'Fim' },
            }),
        ]);
        at(own.media, 25.5);
        press(own.container, 'c');
        expect(own.media.currentTime).toBe(25.5);
        press(own.container, 'n', true);
        expect(own.media.currentTime).toBe(25);
        at(own.media, 60);
        press(own.container, 'n');
        expect(said()).toBe('Fim');
        own.frame.destroy();
        own.unmount();

        const off = shown([plugin({ keys: false })]);
        at(off.media, 10);
        press(off.container, 'c');
        expect(off.media.currentTime).toBe(10);
    });
});

describe('what a screen reader hears', () => {
    it("adds the chapter to the slider's value, and nothing with valueNote off", () => {
        const { container, media } = shown([plugin()]);
        at(media, 30);

        expect(container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40, Chapter 2 of 3: Interview',
        );

        mounted?.frame.destroy();
        mounted?.unmount();
        const off = shown([plugin({ valueNote: false })]);
        at(off.media, 30);
        expect(off.container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40',
        );
    });

    it('says a chapter playback enters only when asked, and tells the app every change', () => {
        const changes: [string | null, number][] = [];
        const media = fakeMedia({ duration: 100, paused: false });
        shown(
            [
                plugin({
                    announceChange: true,
                    onChange: (chapter, index) =>
                        changes.push([chapter?.title ?? null, index]),
                }),
            ],
            media,
        );

        at(media, 30);
        expect(said()).toBe('Chapter 2 of 3: Interview');
        expect(changes).toEqual([
            ['Intro', 0],
            ['Interview', 1],
        ]);

        mounted?.frame.destroy();
        mounted?.unmount();
        document.querySelector('[role="status"]')?.replaceChildren();
        const quiet = fakeMedia({ duration: 100, paused: false });
        shown([plugin()], quiet);
        at(quiet, 30);
        expect(said()).toBe('');
    });
});

describe('the strip of titles', () => {
    it('puts each title over its stretch, hidden from screen readers', () => {
        const { container } = shown([plugin({ lane: 'below' })]);
        const boxes = [
            ...container.querySelectorAll<HTMLElement>(
                '.sonicframe-chapter-name',
            ),
        ];

        expect(boxes.map((box) => box.textContent)).toEqual([
            'Intro',
            'Interview',
            'Chapter 3 of 3',
        ]);
        expect(
            boxes.map((box) => [
                box.style.getPropertyValue('left'),
                box.style.getPropertyValue('width'),
            ]),
        ).toEqual([
            ['0px', '50px'],
            ['50px', '50px'],
            ['100px', '100px'],
        ]);
        expect(boxes[0].parentElement?.getAttribute('aria-hidden')).toBe(
            'true',
        );
    });
});

describe('where the chapters come from', () => {
    function vtt(calls: { count: number }): ChaptersFetcher {
        const bytes = new TextEncoder().encode(
            'WEBVTT\n\n00:00.000 --> 00:30.000\nOne\n\n00:30.000 --> 01:40.000\nTwo',
        );

        return () => {
            calls.count++;

            return Promise.resolve({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
            });
        };
    }

    it('fetches an address once, and keeps the chapters when set up again', async () => {
        const calls = { count: 0 };
        const own = chapters({
            src: '/a.vtt',
            load: { fetcher: vtt(calls), shared: false },
        });
        shown([own]);
        await nextFrame();
        expect(own.chapters.map((chapter) => chapter.title)).toEqual([
            'One',
            'Two',
        ]);

        mounted?.frame.destroy();
        mounted?.unmount();
        const { container, media } = shown([own]);
        at(media, 40);

        expect(calls.count).toBe(1);
        expect(container.getAttribute('aria-valuetext')).toBe(
            '0:40 / 1:40, Chapter 2 of 2: Two',
        );
    });

    it("reports a file that cannot be fetched as the frame's error", async () => {
        const errors: unknown[] = [];
        const own = chapters({
            src: '/missing.vtt',
            load: {
                shared: false,
                fetcher: () =>
                    Promise.resolve({
                        ok: false,
                        status: 404,
                        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                    }),
            },
        });
        const { frame } = shown([own]);
        frame.on('error', (error) => errors.push(error));
        await nextFrame();

        expect(String(errors[0])).toContain(
            'sonicframe: chapters request failed (404)',
        );
    });

    it('replaces, clears and refuses through set()', () => {
        const own = plugin();
        const { container, media } = shown([own]);
        at(media, 30);

        // The value in words changes at once, without waiting for playback to move.
        own.set('WEBVTT\n\n00:00.000 --> 01:40.000\nAll of it');
        expect(container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40, Chapter 1 of 1: All of it',
        );

        own.set(null);
        expect(own.chapters).toEqual([]);
        expect(() => own.set('not chapters')).toThrow(TypeError);
    });

    it('goes to a chapter, the next and the previous through its API', () => {
        const own = plugin();
        const { media } = shown([own]);

        expect(own.go(1)).toBe(true);
        expect(media.currentTime).toBe(25);
        expect(own.next()).toBe(true);
        expect(media.currentTime).toBe(50);
        expect(own.next()).toBe(false);
        expect(own.previous()).toBe(true);
        expect(media.currentTime).toBe(25);
        expect(own.go(9)).toBe(false);
    });
});
