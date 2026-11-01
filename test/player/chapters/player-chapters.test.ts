/**
 * Chapters on the ready-made player: off unless asked; on, the wave takes the chapters plugin with
 * the player's words, the look can place the chapter's name, buttons to the previous and next
 * chapter and a button that opens the list inside the player, the chapters survive a rebuild, and
 * the change of chapter reaches the player's listeners and the tag's. A name too long for its
 * room is in `long-name.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineSonicPlayer } from '../../../src/player';
import { playTo } from '../../support/events';
import { triggerResize } from '../../support/fakes';
import { showTag } from '../../support/helpers';
import {
    CHAPTER_LINE,
    cleanUp,
    host,
    ITEMS,
    keep,
    make,
    part,
    player,
    press,
    slider,
} from './chapters-harness';

afterEach(cleanUp);

describe('chapters on the player', () => {
    it('is off by default: no chapter parts even where the look names them, and no C key', () => {
        const { media } = make({ look: CHAPTER_LINE });
        playTo(media, 10);
        press('c');

        expect(media.currentTime).toBe(10);
        expect(part('chapter-now')).toBeNull();
        expect(part('previous-chapter')).toBeNull();
        expect(part('next-chapter')).toBeNull();
        expect(part('chapters-toggle')).toBeNull();
        expect(player?.chapters).toBeNull();
    });

    it("takes a list, steps with C and says the chapter in the slider's value", () => {
        const { media } = make({ chapters: ITEMS });
        playTo(media, 10);
        press('c');

        expect(media.currentTime).toBe(25);
        playTo(media, 30);
        expect(slider().getAttribute('aria-valuetext')).toBe(
            '0:30 / 1:40, Chapter 2 of 3: Interview',
        );
    });

    it("speaks the player's language", () => {
        const { media } = make({ chapters: ITEMS, a11y: { lang: 'pt' } });
        playTo(media, 30);

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
        playTo(media, 60);
        expect(now.textContent).toBe('Songs');
    });

    it('moves to the previous and next chapter with its buttons, named in the language', () => {
        const { media } = make({ chapters: ITEMS, look: CHAPTER_LINE });
        const previous = part('previous-chapter') as HTMLButtonElement;
        const next = part('next-chapter') as HTMLButtonElement;

        // The button keeps its old class beside the new one until 2.0.
        expect(previous.classList.contains('sonicframe-prev-chapter')).toBe(
            true,
        );

        expect(previous.getAttribute('aria-label')).toBe('Previous chapter');
        expect(next.getAttribute('aria-label')).toBe('Next chapter');

        playTo(media, 30);
        next.click();
        expect(media.currentTime).toBe(50);
        playTo(media, 60);
        previous.click();
        expect(media.currentTime).toBe(50);
        playTo(media, 50.5);
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

    it("names the list and the button that opens it in the player's language", () => {
        const name = (selector: string): string | null | undefined =>
            host?.querySelector(selector)?.getAttribute('aria-label');

        make({ chapters: { items: ITEMS, list: true }, look: CHAPTER_LINE });

        expect(name('.sonicframe-chapters-toggle')).toBe('Chapters');
        expect(name('.sonicframe-chapter-list nav')).toBe('Chapters');

        player?.destroy();
        host?.remove();
        make({
            chapters: { items: ITEMS, list: true },
            look: CHAPTER_LINE,
            a11y: { lang: 'pt' },
        });

        expect(name('.sonicframe-chapters-toggle')).toBe('Capítulos');
        expect(name('.sonicframe-chapter-list nav')).toBe('Capítulos');
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
        playTo(media, 90);

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

        playTo(media, 30);
        playTo(media, 31);
        playTo(media, 55);

        expect(changes).toEqual([
            ['Interview', 1],
            ['Songs', 2],
        ]);
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
        keep(element);
        showTag(element);

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
