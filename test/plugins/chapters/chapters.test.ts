/**
 * Chapters on the page: lines where chapters start, C / Shift+C between them with what is said, the
 * chapter in the slider's value, the strip of titles, and the chapters kept when the plugin is set
 * up again. The list is in `chapter-list.test.ts`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { sharedTooltip } from '../../../src/dom/shared/tooltip';
import {
    chapters,
    type ChaptersOptions,
    type Fetcher,
} from '../../../src/index';
import { firePointer, playTo, pressKey } from '../../support/events';
import { recordingOf } from '../../support/fakes';
import {
    fakeMedia,
    mount,
    mountShown,
    nextFrame,
    repainted,
    takeOff,
    tooltipTextOnPale,
} from '../../support/helpers';
import { plugin, said, showFrame } from './chapters-harness';

afterEach(() => {
    sharedTooltip().hide();
    document.querySelector('[role="status"]')?.replaceChildren();
});

/** The lines a chapters plugin of `options` draws on a fresh picture: their x and width. */
function linesOf(
    options: Parameters<typeof plugin>[0] = {},
): Promise<{ x: number; width: number }[]> {
    return repainted(showFrame([plugin(options)]), 'red');
}

describe('chapters on the wave', () => {
    it('draws a line where each chapter in the contents starts, none at the very start', async () => {
        // 25 s and 50 s of 100 s across 200 px: x = 50 and 100, 2 px wide.
        expect(await linesOf()).toEqual([
            { x: 49, width: 2 },
            { x: 99, width: 2 },
        ]);
    });

    it('draws the lines the usual 2 pixels wide when the width is not a number', async () => {
        for (const width of [Number.NaN, '6' as unknown as number]) {
            expect(await linesOf({ width })).toEqual([
                { x: 49, width: 2 },
                { x: 99, width: 2 },
            ]);
        }
    });

    it('draws no line with lines off', async () => {
        const { canvas, frame } = showFrame([plugin({ lines: false })]);
        frame.invalidate();
        await nextFrame();

        expect(
            recordingOf(canvas).rects.some((rect) => rect.fill === 'red'),
        ).toBe(false);
    });

    it("goes to a chapter's start when its line is clicked, and names it on hover", () => {
        const { container, media } = showFrame([plugin()]);

        firePointer(container, 'pointermove', 52);
        expect(sharedTooltip().element.textContent).toBe(
            '0:25 · Chapter 2 of 3: Interview',
        );

        firePointer(container, 'pointerdown', 52);
        firePointer(container, 'pointerup', 52);
        expect(media.currentTime).toBe(25);
    });

    it("writes the tooltip in the page's color for text on the played color, or in black or white that reads when asked", () => {
        const hovered = (readable?: boolean): string => {
            const { container } = showFrame([
                plugin({ a11y: { tooltip: { readable } } }),
            ]);

            return tooltipTextOnPale(container, () =>
                firePointer(container, 'pointermove', 52),
            );
        };

        expect(hovered()).toBe('#ffffff');
        expect(hovered(true)).toBe('rgba(0, 0, 0, 1)');
    });

    it('still seeks normally away from the lines, and with snap off', () => {
        const { container, media } = showFrame([plugin({ snap: false })]);

        firePointer(container, 'pointerdown', 52);
        firePointer(container, 'pointerup', 52);
        expect(media.currentTime).toBe(26);
    });
});

describe('the keys', () => {
    it('steps to the next chapter with C and says where it landed', () => {
        const { container, media } = showFrame([plugin()]);
        playTo(media, 10);

        pressKey(container, 'c');
        expect(media.currentTime).toBe(25);
        expect(said()).toBe('Chapter 2 of 3: Interview, 0:25');

        pressKey(container, 'C');
        expect(media.currentTime).toBe(50);
        expect(said()).toBe('Chapter 3 of 3, 0:50');

        pressKey(container, 'c');
        expect(media.currentTime).toBe(50);
        expect(said()).toBe('No more chapters');
    });

    it('steps from the position shown while the sound has not loaded yet (preload none)', () => {
        const changes: number[] = [];
        const mounted = mount({
            media: fakeMedia({ readyState: 0 }),
            duration: 100,
            animate: false,
            plugins: [
                plugin({ onChange: (_chapter, index) => changes.push(index) }),
            ],
        });

        pressKey(mounted.container, 'c');
        pressKey(mounted.container, 'c');

        expect(mounted.frame.progress).toBe(0.5);
        expect(said()).toBe('Chapter 3 of 3, 0:50');
        expect(changes).toEqual([0, 1, 2]);
    });

    it('goes back with Shift+C like a previous track, by the Shift key and not the case', () => {
        const { container, media } = showFrame([plugin()]);

        playTo(media, 25.5);
        pressKey(container, 'c', { shiftKey: true });
        expect(media.currentTime).toBe(0);

        playTo(media, 40);
        pressKey(container, 'C', { shiftKey: true });
        expect(media.currentTime).toBe(25);
    });

    it('takes its own letter and grace, or none', () => {
        const own = showFrame([
            plugin({
                keys: { letter: 'N', backGrace: 0 },
                words: { none: 'Fim' },
            }),
        ]);
        playTo(own.media, 25.5);
        pressKey(own.container, 'c');
        expect(own.media.currentTime).toBe(25.5);
        pressKey(own.container, 'n', { shiftKey: true });
        expect(own.media.currentTime).toBe(25);
        playTo(own.media, 60);
        pressKey(own.container, 'n');
        expect(said()).toBe('Fim');
        own.frame.destroy();
        own.unmount();

        const off = showFrame([plugin({ keys: false })]);
        playTo(off.media, 10);
        pressKey(off.container, 'c');
        expect(off.media.currentTime).toBe(10);
    });
});

describe('what a screen reader hears', () => {
    it("adds the chapter to the slider's value, and nothing with valueNote off", () => {
        const on = showFrame([plugin()]);
        playTo(on.media, 30);

        expect(on.container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40, Chapter 2 of 3: Interview',
        );

        takeOff(on);
        const off = showFrame([plugin({ valueNote: false })]);
        playTo(off.media, 30);
        expect(off.container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40',
        );
    });

    it('takes the note, the announcement and the words from its a11y group, over the old names', () => {
        const quiet = showFrame([
            plugin({ valueNote: true, a11y: { valueNote: false } }),
        ]);
        playTo(quiet.media, 30);
        expect(quiet.container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40',
        );
        takeOff(quiet);

        const media = fakeMedia({ duration: 100, paused: false });
        const told = showFrame(
            [
                plugin({
                    words: { chapter: 'old' },
                    a11y: {
                        announce: true,
                        words: { chapter: 'Parte {index}' },
                    },
                }),
            ],
            media,
        );
        playTo(media, 30);
        expect(said()).toBe('Parte 2: Interview');
        takeOff(told);
    });

    it("says the chapters in the frame's language", () => {
        const media = fakeMedia({ duration: 100 });
        const { container } = mountShown({
            media,
            plugins: [plugin()],
            a11y: { lang: 'fr' },
        });
        playTo(media, 30);

        expect(container.getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40, Chapitre 2 sur 3: Interview',
        );

        pressKey(container, 'c');
        expect(said()).toBe('Chapitre 3 sur 3, 0:50');

        pressKey(container, 'c');
        expect(said()).toBe('Plus aucun chapitre');
    });

    it('says a chapter playback enters only when asked, and tells the app every change', () => {
        const changes: [string | null, number][] = [];
        const media = fakeMedia({ duration: 100, paused: false });
        const told = showFrame(
            [
                plugin({
                    announceChange: true,
                    onChange: (chapter, index) =>
                        changes.push([chapter?.title ?? null, index]),
                }),
            ],
            media,
        );

        playTo(media, 30);
        expect(said()).toBe('Chapter 2 of 3: Interview');
        expect(changes).toEqual([
            ['Intro', 0],
            ['Interview', 1],
        ]);

        takeOff(told);
        document.querySelector('[role="status"]')?.replaceChildren();
        const quiet = fakeMedia({ duration: 100, paused: false });
        showFrame([plugin()], quiet);
        playTo(quiet, 30);
        expect(said()).toBe('');
    });
});

describe('the strip of titles', () => {
    it('puts each title over its stretch, hidden from screen readers', () => {
        const { container } = showFrame([plugin({ lane: 'below' })]);
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
    function vtt(calls: { count: number }): Fetcher {
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

    it('keeps to load.maxChapters for chapters given as a list, a text or by set', () => {
        const own = chapters({
            items: [{ start: 0 }, { start: 5 }, { start: 9 }],
            load: { maxChapters: 2 },
        });
        showFrame([own]);

        expect(own.chapters.map((chapter) => chapter.start)).toEqual([0, 5]);

        own.set(
            'WEBVTT\n\n00:01.000 --> 00:02.000\nA\n\n00:03.000 --> 00:04.000\nB\n\n00:05.000 --> 00:06.000\nC\n',
        );

        expect(own.chapters.map((chapter) => chapter.title)).toEqual([
            'A',
            'B',
        ]);
    });

    it('fetches an address once, and keeps the chapters when set up again', async () => {
        const calls = { count: 0 };
        const own = chapters({
            src: '/a.vtt',
            load: { fetcher: vtt(calls), shared: false },
        });
        const first = showFrame([own]);
        await nextFrame();
        expect(own.chapters.map((chapter) => chapter.title)).toEqual([
            'One',
            'Two',
        ]);

        takeOff(first);
        const { container, media } = showFrame([own]);
        playTo(media, 40);

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
        const { frame } = showFrame([own]);
        frame.on('error', (error) => errors.push(error));
        await nextFrame();

        expect(String(errors[0])).toContain(
            'sonicframe: chapters request failed (404)',
        );
    });

    it('replaces, clears and refuses through set()', () => {
        const own = plugin();
        const { container, media } = showFrame([own]);
        playTo(media, 30);

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
        const { media } = showFrame([own]);

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

describe('the names of 0.7, with the old ones kept until 2.0', () => {
    it('tells onChapterChange every change, and only it when the old onChange is given too', () => {
        const fresh: number[] = [];
        const old: number[] = [];
        const media = fakeMedia({ duration: 100, paused: false });
        showFrame(
            [
                plugin({
                    onChapterChange: (_chapter, index) => fresh.push(index),
                    onChange: (_chapter, index) => old.push(index),
                }),
            ],
            media,
        );
        playTo(media, 30);

        expect(fresh).toEqual([0, 1]);
        expect(old).toEqual([]);
    });

    it('gives the chapters shown as items, and the same list as chapters', () => {
        const own = plugin();
        showFrame([own]);

        expect(own.items.map((chapter) => chapter.start)).toEqual([0, 25, 50]);
        expect(own.chapters).toBe(own.items);
    });

    it('puts the strip under the wave with lane on, over it by lanePlacement, and reads the old strings', () => {
        // The canvas's top and height in a 200 × 120 frame beside a 20 px strip (1.25 rem of 16 px).
        const under = ['0px', 'calc(100% - 20px)'];
        const over = ['20px', 'calc(100% - 20px)'];
        const none = ['0px', '100%'];
        const cases: [ChaptersOptions, string[]][] = [
            [{ lane: true }, under],
            [{ lane: true, lanePlacement: 'above' }, over],
            [{ lane: true, lanePlacement: 'left' as 'above' }, under],
            [{ lane: 'above' }, over],
            [{ lane: 'below' }, under],
            [{ lane: 'above', lanePlacement: 'below' }, under],
            [{ lane: false, lanePlacement: 'above' }, none],
        ];

        for (const [options, [top, height]] of cases) {
            const shown = mountShown(
                {
                    media: fakeMedia({ duration: 100 }),
                    plugins: [plugin(options)],
                    animate: false,
                },
                { left: 0, top: 0, width: 200, height: 120 },
            );

            expect([
                shown.canvas.style.getPropertyValue('top'),
                shown.canvas.style.getPropertyValue('height'),
            ]).toEqual([top, height]);
            takeOff(shown);
        }
    });

    it("takes the strip's height in rem as a number, or written in rem or px, kept from 0.5 to 4 rem", () => {
        const cases: [ChaptersOptions['laneHeight'], number][] = [
            [2, 32],
            ['2rem', 32],
            ['24px', 24],
            ['99px', 64],
            ['0.1rem', 8],
            ['wide' as '1rem', 20],
        ];

        for (const [laneHeight, pixels] of cases) {
            const shown = mountShown(
                {
                    media: fakeMedia({ duration: 100 }),
                    plugins: [plugin({ lane: true, laneHeight })],
                    animate: false,
                },
                { left: 0, top: 0, width: 200, height: 120 },
            );

            expect(shown.canvas.style.getPropertyValue('height')).toBe(
                `calc(100% - ${pixels}px)`,
            );
            takeOff(shown);
        }
    });
});
