/**
 * Chapters on the ready-made player: off unless asked; on, the wave takes the chapters plugin with
 * the player's words, the look can place the chapter's name, buttons to the previous and next
 * chapter and a button that opens the list inside the player, the chapters survive a rebuild, and
 * the change of chapter reaches the player's listeners and the tag's.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
    type PlayerOptions,
} from '../../src/player';
import { sharedTooltip } from '../../src/dom/tooltip';
import { boxOf, fakeMedia } from './helpers';
import { triggerResize, triggerVisible } from './fakes';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
    vi.unstubAllGlobals();
});

const ITEMS = [
    { start: 0, title: 'Intro' },
    { start: 25, title: 'Interview' },
    { start: 50, title: 'Songs' },
];

type Media = ReturnType<typeof fakeMedia>;

function make(options: Partial<PlayerOptions> = {}): {
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

function slider(): HTMLElement {
    return (host as HTMLElement).querySelector(
        '[role="slider"]',
    ) as HTMLElement;
}

function press(key: string, shiftKey = false): void {
    slider().dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
    );
}

function at(media: Media, time: number): void {
    media.currentTime = time;
    media.fire('timeupdate');
}

function part(name: string): HTMLElement | null {
    return (host as HTMLElement).querySelector<HTMLElement>(
        `.sonicframe-${name}`,
    );
}

const CHAPTER_LINE: PlayerOptions['look'] = {
    line: ['play', 'prevChapter', 'wave', 'nextChapter', 'chapter', 'chapters'],
};

describe('chapters on the player', () => {
    it('is off by default: no chapter parts even where the look names them, and no C key', () => {
        const { media } = make({ look: CHAPTER_LINE });
        at(media, 10);
        press('c');

        expect(media.currentTime).toBe(10);
        expect(part('chapter-now')).toBeNull();
        expect(part('prev-chapter')).toBeNull();
        expect(part('next-chapter')).toBeNull();
        expect(part('chapters-toggle')).toBeNull();
        expect(player?.chapters).toBeNull();
    });

    it("takes a list, steps with C and says the chapter in the slider's value", () => {
        const { media } = make({ chapters: ITEMS });
        at(media, 10);
        press('c');

        expect(media.currentTime).toBe(25);
        at(media, 30);
        expect(slider().getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40, Chapter 2 of 3: Interview',
        );
    });

    it("speaks the player's language", () => {
        const { media } = make({ chapters: ITEMS, a11y: { lang: 'pt' } });
        at(media, 30);

        expect(slider().getAttribute('aria-valuetext')).toBe(
            '0:30 de 1:40, Capítulo 2 de 3: Interview',
        );
    });

    it('fetches an address with the options given', async () => {
        const bytes = new TextEncoder().encode(
            '{"chapters":[{"startTime":0,"title":"A"},{"startTime":40,"title":"B"}]}',
        );
        const { player: made } = make({
            chapters: {
                src: '/player.json',
                load: {
                    shared: false,
                    fetcher: () =>
                        Promise.resolve({
                            ok: true,
                            status: 200,
                            arrayBuffer: () =>
                                Promise.resolve(bytes.slice().buffer),
                        }),
                },
            },
        });

        await vi.waitFor(() =>
            expect(made.chapters?.chapters.map((c) => c.title)).toEqual([
                'A',
                'B',
            ]),
        );
    });

    it('takes a plain address as the chapters file', async () => {
        const fetch = vi.fn((_address: string) =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: null,
                arrayBuffer: () =>
                    Promise.resolve(
                        new TextEncoder().encode(
                            '{"chapters":[{"startTime":0,"title":"Plain"}]}',
                        ).buffer,
                    ),
            }),
        );
        vi.stubGlobal('fetch', fetch);
        const { player: made } = make({ chapters: '/plain-player.json' });

        await vi.waitFor(() =>
            expect(made.chapters?.chapters.map((c) => c.title)).toEqual([
                'Plain',
            ]),
        );
        expect(fetch.mock.calls.map((call) => call[0])).toContain(
            '/plain-player.json',
        );
    });

    it('shows the chapter playing where the look places it, hidden from screen readers', () => {
        const { media } = make({ chapters: ITEMS, look: CHAPTER_LINE });
        const now = part('chapter-now') as HTMLElement;

        expect(now.textContent).toBe('Intro');
        expect(now.getAttribute('aria-hidden')).toBe('true');
        at(media, 60);
        expect(now.textContent).toBe('Songs');
    });

    it('moves to the previous and next chapter with its buttons, named in the language', () => {
        const { media } = make({ chapters: ITEMS, look: CHAPTER_LINE });
        const previous = part('prev-chapter') as HTMLButtonElement;
        const next = part('next-chapter') as HTMLButtonElement;

        expect(previous.getAttribute('aria-label')).toBe('Previous chapter');
        expect(next.getAttribute('aria-label')).toBe('Next chapter');

        at(media, 30);
        next.click();
        expect(media.currentTime).toBe(50);
        at(media, 60);
        previous.click();
        expect(media.currentTime).toBe(50);
        at(media, 50.5);
        previous.click();
        expect(media.currentTime).toBe(25);
    });

    it('opens and closes the list with its button, and goes to a chapter from it', () => {
        const { media } = make({
            chapters: { items: ITEMS, list: true },
            look: CHAPTER_LINE,
        });
        const toggle = part('chapters-toggle') as HTMLButtonElement;
        const box = part('chapter-list') as HTMLElement;

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('aria-controls')).toBe(box.id);
        expect(box.hidden).toBe(true);

        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(box.hidden).toBe(false);

        const buttons = box.querySelectorAll<HTMLButtonElement>('nav button');
        expect(buttons).toHaveLength(3);
        buttons[1].click();
        expect(media.currentTime).toBe(25);

        toggle.click();
        expect(box.hidden).toBe(true);
    });

    it('shows the list open when asked, or when no button can open it', () => {
        make({ chapters: { items: ITEMS, list: true } });
        expect((part('chapter-list') as HTMLElement).hidden).toBe(false);
        player?.destroy();
        host?.remove();

        make({
            chapters: { items: ITEMS, list: { open: true } },
            look: CHAPTER_LINE,
        });
        expect((part('chapter-list') as HTMLElement).hidden).toBe(false);
    });

    it("puts the list under the wave, on the wave's left edge, as a voice note too", () => {
        make({
            chapters: { items: ITEMS, list: true },
            look: { line: ['play', 'wave'], meta: ['time', 'chapters'] },
        });
        const list = part('chapter-list') as HTMLElement;
        // The slider is the wave's own box; its parent is the wave's column.
        const wave = slider();
        const column = wave.parentElement as HTMLElement;

        // The wave's column holds the wave, the row under it and the list, in that order.
        expect(list.parentElement).toBe(column);
        expect(column.lastElementChild).toBe(list);

        // The play button keeps to the wave's row, so opening the list never moves it.
        const play = part('play') as HTMLElement;
        expect(play.style.getPropertyValue('grid-row')).toBe('1');
        expect(wave.style.getPropertyValue('grid-row')).toBe('1');
        expect(list.style.getPropertyValue('grid-column')).toBe(
            wave.style.getPropertyValue('grid-column'),
        );

        triggerResize(
            (host as HTMLElement).querySelector(
                '.sonicframe-player',
            ) as HTMLElement,
            { width: 300, height: 48 },
        );
        expect(list.style.getPropertyValue('grid-column')).not.toBe('');
        expect(list.style.getPropertyValue('grid-column')).toBe(
            wave.style.getPropertyValue('grid-column'),
        );
    });

    it('keeps the row under the wave on one line by default, the chapter giving up its room', () => {
        make({
            chapters: ITEMS,
            look: {
                line: ['play', 'wave'],
                meta: ['time', 'chapter', 'spacer', 'nextChapter'],
            },
        });
        const name = part('chapter-now') as HTMLElement;
        const row = name.parentElement as HTMLElement;

        expect(row.style.getPropertyValue('flex-wrap')).toBe('');
        expect(part('next-chapter')?.parentElement).toBe(row);
        // It grows into the room left and shrinks to nothing rather than push the buttons out.
        expect(name.style.getPropertyValue('flex-grow')).toBe('1');
        expect(name.style.getPropertyValue('min-width')).toBe('0');
        expect(name.style.getPropertyValue('overflow')).toBe('hidden');
    });

    it('breaks the row in two when asked, the parts after the spacer together on the far side', () => {
        make({
            chapters: { items: ITEMS, list: true },
            look: {
                line: ['play', 'wave'],
                meta: [
                    'time',
                    'chapter',
                    'spacer',
                    'prevChapter',
                    'nextChapter',
                    'chapters',
                ],
                metaWrap: true,
            },
        });
        expect(
            part('chapter-now')?.parentElement?.style.getPropertyValue(
                'flex-wrap',
            ),
        ).toBe('wrap');
        const name = part('chapter-now') as HTMLElement;
        const group = part('prev-chapter')?.parentElement as HTMLElement;

        // One group that never breaks, pushed to the far side on whichever line it lands.
        expect(group).not.toBe(name.parentElement);
        expect(group.parentElement).toBe(name.parentElement);
        expect(part('next-chapter')?.parentElement).toBe(group);
        expect(part('chapters-toggle')?.parentElement).toBe(group);
        expect(group.style.getPropertyValue('flex-wrap')).toBe('nowrap');
        expect(group.style.getPropertyValue('margin-left')).toBe('auto');
    });

    it('puts the list under the controls when the wave is on top', () => {
        make({
            chapters: { items: ITEMS, list: true },
            look: { wavePlace: 'top', line: ['play', 'time', 'chapters'] },
        });
        const player = (host as HTMLElement).querySelector(
            '.sonicframe-player',
        ) as HTMLElement;

        expect(player.lastElementChild).toBe(part('chapter-list'));
    });

    it('keeps chapters set by the app through a rebuild', () => {
        const { player: made, media } = make({
            chapters: { items: ITEMS, list: true },
        });
        made.chapters?.set([
            { start: 0, title: 'Only' },
            { start: 80, title: 'End' },
        ]);
        made.setTheme('bubble');
        at(media, 90);

        expect(slider().getAttribute('aria-valuetext')).toBe(
            '1:30 / 1:40, Chapter 2 of 2: End',
        );
        expect(
            [
                ...(part('chapter-list') as HTMLElement).querySelectorAll(
                    'nav button',
                ),
            ].length,
        ).toBe(2);
    });

    it('tells its listeners when the chapter changes', () => {
        const changes: [string | null, number][] = [];
        const { player: made, media } = make({ chapters: ITEMS });
        made.on('chapterchange', (chapter, index) =>
            changes.push([chapter?.title ?? null, index]),
        );

        at(media, 30);
        at(media, 31);
        at(media, 55);

        expect(changes).toEqual([
            ['Interview', 1],
            ['Songs', 2],
        ]);
    });
});

describe('a chapter name too long for its room', () => {
    type Walk = {
        keyframes: Keyframe[];
        options: KeyframeAnimationOptions;
        cancelled: boolean;
    };

    /** Records each `element.animate`, with its keyframes and options, marked once cancelled. */
    function walks(): Walk[] {
        const started: Walk[] = [];
        vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
            (keyframes, options) => {
                const walk = {
                    keyframes: keyframes as Keyframe[],
                    options: options as KeyframeAnimationOptions,
                    cancelled: false,
                    finished: Promise.resolve(),
                    cancel(): void {
                        walk.cancelled = true;
                    },
                };
                started.push(walk);

                return walk as unknown as Animation;
            },
        );

        return started;
    }

    /**
     * A player whose chapter's name has a 100 px room and a text `text` px wide, measured when the
     * wave next resizes.
     */
    function named(look: PlayerOptions['look'], text: number): HTMLElement {
        make({
            chapters: ITEMS,
            look: {
                line: ['play', 'wave'],
                meta: ['time', 'chapter', 'spacer', 'nextChapter'],
                ...look,
            },
        });
        const name = part('chapter-now') as HTMLElement;
        boxOf(name, { left: 60, top: 40, width: 100, height: 16 });
        boxOf(name.firstElementChild as HTMLElement, {
            left: 60,
            top: 40,
            width: text,
            height: 16,
        });
        const canvas = (host as HTMLElement).querySelector(
            'canvas',
        ) as HTMLCanvasElement;
        triggerResize(canvas, { width: 300, height: 40 });
        triggerVisible(canvas, true);

        return name;
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stays still, ending in an ellipsis, unless the look asks it to walk', () => {
        const started = walks();
        const name = named({}, 160);

        expect(started).toHaveLength(0);
        expect(name.style.getPropertyValue('text-overflow')).toBe('ellipsis');
    });

    it('walks its overflow at the speed asked, waits at each end and starts over', () => {
        const started = walks();
        const name = named(
            { marquee: true, marqueeSpeed: 2, marqueePause: 1000 },
            160,
        );
        const walk = started.at(-1) as Walk;

        // 60 px over its room, at 2 rem (32 px) a second: 1875 ms, with 1000 ms at each end.
        expect(walk.keyframes[0]?.transform).toBe('translateX(0px)');
        expect(walk.keyframes.at(-1)?.transform).toBe('translateX(-60px)');
        expect(walk.options.duration).toBe(3875);
        expect(walk.options.iterations).toBe(Number.POSITIVE_INFINITY);
        expect(walk.options.direction).toBe('normal');
        // Walking, its end shows in full: no ellipsis.
        expect(name.style.getPropertyValue('text-overflow')).toBe('clip');
    });

    it('walks back instead of starting over when the look says bounce', () => {
        const started = walks();
        named({ marquee: true, marqueeType: 'bounce' }, 160);

        expect(started.at(-1)?.options.direction).toBe('alternate');
    });

    it('stays still when it fits, and stops walking once it does', () => {
        const started = walks();
        const name = named({ marquee: true }, 80);

        expect(started).toHaveLength(0);
        expect(name.style.getPropertyValue('text-overflow')).toBe('ellipsis');
    });

    it('never walks for someone who asked for less motion', () => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query.includes('reduce'),
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));
        const started = walks();
        named({ marquee: true }, 160);

        expect(started).toHaveLength(0);
    });

    it('fades out at its end when the look asks, saying there is more, but only when it overflows', () => {
        walks();
        const name = named({ nameOverflow: 'fade', nameFade: 2 }, 160);
        const mask = name.style.getPropertyValue('mask-image');

        expect(mask).toBe(
            'linear-gradient(to right, #000 calc(100% - 2rem), transparent)',
        );
        expect(name.style.getPropertyValue('text-overflow')).toBe('clip');
        player?.destroy();
        host?.remove();

        expect(
            named({ nameOverflow: 'fade' }, 80).style.getPropertyValue(
                'mask-image',
            ),
        ).toBe('');
    });

    it('walks out from under its fade: the overflow and the fade', () => {
        const started = walks();
        named({ nameOverflow: 'fade', nameFade: 2, marquee: true }, 160);

        // 60 px over its room and a 2 rem (32 px) fade.
        expect(started.at(-1)?.keyframes.at(-1)?.transform).toBe(
            'translateX(-92px)',
        );
    });

    it('is cut where its room ends when the look says clip', () => {
        walks();
        const name = named({ nameOverflow: 'clip' }, 160);

        expect(name.style.getPropertyValue('text-overflow')).toBe('clip');
        expect(name.style.getPropertyValue('mask-image')).toBe('');
    });

    it('shows in full in the tooltip under the mouse when the look asks, and only when cut', () => {
        walks();
        const hover = (name: HTMLElement, type: string): void => {
            name.dispatchEvent(
                Object.assign(new Event(type), { pointerType: 'mouse' }),
            );
        };
        const tip = sharedTooltip();
        let name = named({}, 160);
        hover(name, 'pointerenter');
        expect(tip.open).toBe(false);
        player?.destroy();
        host?.remove();

        name = named({ nameTooltip: true }, 160);
        hover(name, 'pointerenter');
        expect(tip.open).toBe(true);
        expect(tip.element.textContent).toBe('Intro');
        hover(name, 'pointerleave');
        expect(tip.open).toBe(false);
        player?.destroy();
        host?.remove();

        name = named({ nameTooltip: true }, 80);
        hover(name, 'pointerenter');
        expect(tip.open).toBe(false);
    });

    it('stops its walk when the player goes', () => {
        const started = walks();
        named({ marquee: true }, 160);
        player?.destroy();

        expect(started.every((walk) => walk.cancelled)).toBe(true);
    });
});

describe('chapters on the tag', () => {
    it('fetches the chapters attribute, takes its options and dispatches the change', async () => {
        // The peaks file gives the duration: one point of 6000 samples at 100 per second, 60 s.
        const files: Record<string, string> = {
            '/talk.json': JSON.stringify({
                version: 2,
                channels: 1,
                sample_rate: 100,
                samples_per_pixel: 6000,
                bits: 16,
                length: 1,
                data: [-16384, 16384],
            }),
            '/talk-tag.vtt':
                'WEBVTT\n\n00:00.000 --> 00:20.000\nOne\n\n00:20.000 --> 01:00.000\nTwo',
        };
        const fetch = vi.fn((address: string) =>
            Promise.resolve({
                ok: address in files,
                status: address in files ? 200 : 404,
                body: null,
                arrayBuffer: () =>
                    Promise.resolve(
                        new TextEncoder().encode(files[address] ?? '').buffer,
                    ),
            }),
        );
        vi.stubGlobal('fetch', fetch);
        defineSonicPlayer();
        const element = document.createElement('sonic-player');
        element.setAttribute('src', 'talk.ogg');
        element.setAttribute('peaks', '/talk.json');
        element.setAttribute('chapters', '/talk-tag.vtt');
        element.setAttribute('chapter-options', 'list lane');
        const changes: unknown[] = [];
        element.addEventListener('sonicframe:chapterchange', (event) =>
            changes.push((event as CustomEvent<unknown[]>).detail[1]),
        );
        host = element;
        document.body.append(element);
        const canvas = element.querySelector('canvas') as HTMLCanvasElement;
        triggerResize(canvas, { width: 200, height: 40 });
        triggerVisible(canvas, true);

        await vi.waitFor(() =>
            expect(element.querySelectorAll('nav button')).toHaveLength(2),
        );
        expect(fetch.mock.calls.map((call) => call[0])).toContain(
            '/talk-tag.vtt',
        );
        expect(
            element.querySelectorAll('.sonicframe-chapter-name').length,
        ).toBeGreaterThan(0);
        expect(changes).toEqual([0]);
    });
});
