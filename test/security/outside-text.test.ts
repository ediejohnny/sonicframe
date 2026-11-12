/**
 * Text from outside, as a CMS's author or a hostile file would write it, never becomes a page element:
 * the classes of the audio players' known flaws (a title read from a file shown as HTML, a tag's
 * attribute or a list's name written into the page unescaped) checked through every view that shows
 * a name. Each payload must show as the text it is, and nothing in the view may run.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { sharedTooltip } from '../../src/dom/shared/tooltip';
import { markers, regions } from '../../src/index';
import { createPlayer } from '../../src/player';
import { defineSonicPlaylist, nowPlaying } from '../../src/playlist';
import { firePointer, playTo } from '../support/events';
import { triggerResize, triggerVisible } from '../support/fakes';
import {
    afterTest,
    boxOf,
    fakeMedia,
    mount,
    pageHost,
} from '../support/helpers';
import { playableMedia, stubSession } from '../support/media-session';
import { expectNothingInjected, PAYLOADS } from '../support/xss';
import {
    cleanUp,
    keep,
    make,
    said,
    settle,
    titles,
} from '../playlist/playlist/playlist-harness';

afterEach(() => {
    cleanUp();
    sharedTooltip().hide();
});

const [FIRST, SECOND, THIRD, FOURTH, FIFTH] = PAYLOADS;

describe('text from outside, through every view', () => {
    it("shows a player's name and its chapters' titles as text, in the line, the list and the live region", () => {
        const host = pageHost({ left: 0, top: 0, width: 480, height: 48 });
        const media = fakeMedia({ duration: 100, paused: false });
        const player = afterTest(
            createPlayer({
                container: host,
                media,
                peaks: [0.5, 0.5, 0.5, 0.5],
                label: FIRST,
                chapters: {
                    items: PAYLOADS.map((title, at) => ({
                        start: at * 10,
                        title,
                        url:
                            at === 0
                                ? 'javascript:alert(5)'
                                : `https://site.test/${at}`,
                    })),
                    lane: true,
                    links: true,
                    list: { type: 'inline' },
                    a11y: { announce: true },
                },
                look: { line: ['play', 'wave', 'chapter', 'chapters'] },
            }),
        );

        // The lane lays its names out on the wave's size.
        const canvas = host.querySelector('canvas') as HTMLCanvasElement;
        boxOf(canvas, { left: 0, top: 0, width: 480, height: 48 });
        triggerResize(canvas, { width: 480, height: 48 });
        triggerVisible(canvas, true);

        expect(player.element.getAttribute('aria-label')).toBe(FIRST);
        expect(
            [...host.querySelectorAll('.sonicframe-chapter-name')].map(
                (name) => name.textContent,
            ),
        ).toEqual(PAYLOADS);
        expect(host.querySelectorAll('a.sonicframe-chapter-link')).toHaveLength(
            4,
        );

        for (const payload of PAYLOADS) {
            expect(host.textContent).toContain(payload);
        }

        playTo(media, 15);
        expect(said()).toContain(SECOND);
        expectNothingInjected(host);
    });

    it("gives the system's media controls the names as text", async () => {
        const session = stubSession();
        const media = playableMedia(100);
        afterTest(
            createPlayer({
                container: pageHost({
                    left: 0,
                    top: 0,
                    width: 320,
                    height: 48,
                }),
                media,
                mediaSession: { title: FIRST, artist: SECOND, album: THIRD },
            }),
        );
        await media.play();

        expect(session.metadata).toMatchObject({
            title: FIRST,
            artist: SECOND,
            album: THIRD,
        });
    });

    it("shows a marker's label as text in the tooltip", () => {
        const { container } = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [markers({ marks: [{ time: 10, label: FIRST }] })],
        });

        // 10 s of 40 s across 200 px is x = 50.
        firePointer(container, 'pointermove', 50);
        const tooltip = sharedTooltip().element;

        expect(tooltip.textContent).toContain(FIRST);
        expectNothingInjected(tooltip);
        expectNothingInjected(container);
    });

    it("shows regions' labels as text on the wave", () => {
        const { container } = mount({
            media: fakeMedia({ duration: 40 }),
            plugins: [
                regions({
                    items: PAYLOADS.map((label, at) => ({
                        start: at * 8,
                        end: at * 8 + 4,
                        label,
                    })),
                }),
            ],
        });

        for (const payload of PAYLOADS) {
            expect(container.textContent).toContain(payload);
        }

        expectNothingInjected(container);
    });

    it('shows the names of an M3U list as text, in the list and the live region', async () => {
        const { playlist } = make({
            tracks:
                '#EXTM3U\n' +
                PAYLOADS.map(
                    (name, at) =>
                        `#EXTINF:61,${name}\nhttps://site.test/${at}.mp3`,
                ).join('\n'),
            a11y: { label: SECOND },
        });

        expect(titles()).toEqual(PAYLOADS);
        expect(playlist.element.getAttribute('aria-label')).toBe(SECOND);

        playlist.select(2);
        await settle();

        expect(said()).toContain(THIRD);
        expectNothingInjected(playlist.element);
    });

    it('turns the control and direction characters a name could hide behind into spaces', () => {
        make({
            tracks: [
                {
                    src: 'https://site.test/a.mp3',
                    title: 'Ev‮il\u0007 name',
                },
            ],
        });

        expect(titles()).toEqual(['Ev il name']);
    });

    it("shows a playlist tag's links and attributes as text, as a CMS's author would write them", () => {
        defineSonicPlaylist();
        const host = pageHost({ left: 0, top: 0, width: 320, height: 200 });
        keep(host);
        const tag = document.createElement('sonic-playlist');
        tag.setAttribute('a11y-label', THIRD);
        const link = document.createElement('a');
        link.href = 'https://site.test/one.mp3';
        link.textContent = FIRST;
        link.setAttribute('data-artist', FOURTH);
        link.setAttribute('data-album', FIFTH);
        tag.append(link);
        host.append(tag);

        expect(titles()).toEqual([FIRST]);
        expect(tag.playlist?.element.getAttribute('aria-label')).toBe(THIRD);
        expect(tag.playlist?.element.textContent).toContain(FOURTH);
        expect(tag.playlist?.tracks[0].album).toBe(FIFTH);
        expectNothingInjected(tag.playlist?.element as HTMLElement);
    });

    it('shows the playing sound’s name and the bar’s name as text in the now-playing bar', async () => {
        const bar = afterTest(nowPlaying({ a11y: { label: FOURTH } }));
        const media = playableMedia(100);
        const player = afterTest(
            createPlayer({
                container: pageHost({
                    left: 0,
                    top: 0,
                    width: 320,
                    height: 48,
                }),
                media,
                a11y: { label: FIRST },
            }),
        );
        await media.play();
        triggerVisible(player.element, false);
        const shown = bar.element;

        expect(shown.getAttribute('aria-label')).toBe(FOURTH);
        expect(shown.textContent).toContain(FIRST);
        expectNothingInjected(shown);
    });
});
