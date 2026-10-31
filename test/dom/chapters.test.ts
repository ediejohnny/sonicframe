/**
 * Chapters on the page: lines where chapters start, C / Shift+C between them with what is said, the
 * chapter in the slider's value, the list in an element of the app, the strip of titles, and the
 * chapters kept when the plugin is set up again.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    chapters,
    type ChaptersFetcher,
    type ChaptersOptions,
    type Plugin,
} from '../../src/index';
import { sharedTooltip } from '../../src/dom/tooltip';
import { recordingOf, triggerResize, triggerVisible } from './fakes';
import { fakeMedia, mount, nextFrame, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    sharedTooltip().hide();
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
    document.querySelector('[role="status"]')?.replaceChildren();
});

const ITEMS = [
    { start: 0, title: 'Intro' },
    { start: 25, title: 'Interview' },
    { start: 50, title: '' },
    { start: 75, title: 'Hidden', toc: false },
];

/** A 200 × 40 frame of a 100-second sound, with pixels and on screen. */
function shown(
    plugins: Plugin[],
    media = fakeMedia({ duration: 100 }),
): Mounted & { media: ReturnType<typeof fakeMedia> } {
    mounted = mount({ media, plugins, animate: false });
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);

    return { ...mounted, media };
}

function press(target: HTMLElement, key: string, shiftKey = false): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
    );
}

function pointer(target: HTMLElement, type: string, clientX: number): void {
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

function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

function at(media: ReturnType<typeof fakeMedia>, time: number): void {
    media.currentTime = time;
    media.fire('timeupdate');
}

function plugin(options: ChaptersOptions = {}) {
    return chapters({ items: ITEMS, color: 'red', ...options });
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

describe('the list', () => {
    it('lists the chapters as buttons in a named nav, marks the current one, and goes there on a click', () => {
        const list = document.createElement('div');
        const { media } = shown([plugin({ list })]);
        const nav = list.querySelector('nav');
        const buttons = [...list.querySelectorAll('button')];

        expect(nav?.getAttribute('aria-label')).toBe('Chapters');
        expect(buttons.map((button) => button.textContent)).toEqual([
            '0:00Intro',
            '0:25Interview',
            '0:50Chapter 3 of 3',
        ]);
        expect(buttons[0].getAttribute('aria-current')).toBe('true');

        buttons[2].click();
        expect(media.currentTime).toBe(50);
        expect(buttons[2].getAttribute('aria-current')).toBe('true');
        expect(buttons[0].hasAttribute('aria-current')).toBe(false);

        mounted?.frame.destroy();
        expect(list.childElementCount).toBe(0);
    });

    it('shows pictures and links only when asked, links opening apart', () => {
        const items = [
            {
                start: 0,
                title: 'A',
                image: 'https://example.com/a.jpg',
                url: 'https://example.com/a',
            },
            { start: 10, title: 'B', url: 'javascript:alert(1)' },
        ];
        const plain = document.createElement('div');
        shown([chapters({ items, list: plain })]);
        expect(plain.querySelector('img')).toBeNull();
        expect(plain.querySelector('a')).toBeNull();
        mounted?.frame.destroy();
        mounted?.unmount();

        const rich = document.createElement('div');
        shown([chapters({ items, list: rich, images: true, links: true })]);
        const links = rich.querySelectorAll('a');

        expect(rich.querySelector('img')?.getAttribute('src')).toBe(
            'https://example.com/a.jpg',
        );
        expect(rich.querySelector('img')?.getAttribute('alt')).toBe('');
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toBe('https://example.com/a');
        expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
        expect(links[0].getAttribute('target')).toBe('_blank');
        expect(links[0].getAttribute('aria-label')).toBe('Link: A');
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
