/**
 * The player's chapters list in its other forms: a popover over the page with an arrow at its
 * button, kept inside the edges, and a drawer along a side of the page; both close by Escape, a
 * press outside, focus leaving or a choice, and give the focus back.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineSonicPlayer, type PlayerChapterList } from '../../../src/player';
import { boxOf, stubMedia } from '../../support/helpers';
import { cleanUp, host, keep, player } from './chapters-harness';
import { key, list, make, px, sizes, toggle, touch } from './panels-harness';

afterEach(cleanUp);

/**
 * A player whose list is the drawer `form`, laid out before it opens: the drawer runs from 160 to
 * 480 inside a 1 px border (from 1 to 479 within it); the list in it runs from 17 to 463, past 16
 * px of padding; the close button is 28 px square. Returns the drawer and its close button.
 */
function drawer(form: PlayerChapterList): {
    box: HTMLElement;
    close: HTMLElement;
} {
    make(form);
    const box = list();
    const close = box.querySelector('.sonicframe-chapter-close') as HTMLElement;
    const scroll = box.querySelector(
        '.sonicframe-chapter-scroll',
    ) as HTMLElement;
    boxOf(box, { left: 160, top: 0, width: 320, height: 600 });
    boxOf(scroll, { left: 177, top: 17, width: 286, height: 566 });
    boxOf(close, { left: 0, top: 0, width: 28, height: 28 });

    return { box, close };
}

describe('the popover', () => {
    it('opens over the page under its button, inside the edges, with the arrow at the button', () => {
        make({ type: 'popover' });
        sizes({ left: 1000, top: 100 });
        toggle().click();
        const box = list();
        const arrow = box.querySelector(
            '.sonicframe-chapter-arrow',
        ) as HTMLElement;

        expect(box.parentElement).toBe(document.body);
        expect(box.hidden).toBe(false);
        expect(box.style.getPropertyValue('position')).toBe('fixed');
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        // 1024 px wide window, 8 px margin: the list's right edge stops at 1016.
        expect(px(box, 'left')).toBe(776);
        // Under the 24 px button at 100, with a 10 px gap.
        expect(px(box, 'top')).toBe(134);
        // The button's middle (1012) is past the list's reach: the arrow stops 16 px from its end.
        // The arrow (12 px) is placed inside the list's 1 px border.
        expect(px(arrow, 'left') + 6 + 1).toBe(224);
        expect(arrow.style.getPropertyValue('top')).not.toBe('');
    });

    it("points the arrow's middle at the button's middle through a border of any width", () => {
        make({ type: 'popover', style: { border: 3 } });
        sizes({ left: 300, top: 100 });
        toggle().click();
        const box = list();
        const arrow = box.querySelector(
            '.sonicframe-chapter-arrow',
        ) as HTMLElement;

        // The button's middle is at 312. The arrow (12 px) sits inside the list's 3 px border,
        // its middle on the list's outer edge, its two outer sides as thick as the list's border.
        expect(px(box, 'left') + 3 + px(arrow, 'left') + 6).toBe(312);
        expect(px(arrow, 'top')).toBe(-9);
        expect(arrow.style.getPropertyValue('border-width')).toBe(
            '3px 0px 0px 3px',
        );
    });

    it("keeps clear of the page's scrollbar", () => {
        // A 16 px scrollbar: the page shows 1008 of the window's 1024 pixels.
        vi.spyOn(
            document.documentElement,
            'clientWidth',
            'get',
        ).mockReturnValue(1008);
        make({ type: 'popover' });
        sizes({ left: 1000, top: 100 });
        toggle().click();

        expect(px(list(), 'left')).toBe(760);
        // Never wider than the page between its margins.
        expect(list().style.getPropertyValue('max-width')).toBe('992px');
    });

    it('opens above its button when there is no room below, or when asked', () => {
        make({ type: 'popover' });
        sizes({ left: 100, top: 700 });
        toggle().click();

        expect(px(list(), 'top')).toBe(490);
        expect(
            (
                list().querySelector('.sonicframe-chapter-arrow') as HTMLElement
            ).style.getPropertyValue('bottom'),
        ).not.toBe('');
        player?.destroy();
        host?.remove();

        make({ type: 'popover', placement: 'above' });
        sizes({ left: 100, top: 300 });
        toggle().click();
        // Over the button at 300: 300 - 10 - 200.
        expect(px(list(), 'top')).toBe(90);
    });

    it('takes the focus to the chapter playing, and gives it back on Escape', () => {
        const { media } = make({ type: 'popover' });
        media.currentTime = 30;
        media.fire('timeupdate');
        sizes({ left: 100, top: 100 });
        toggle().focus();
        toggle().click();

        expect(
            document.activeElement?.querySelector('.sonicframe-chapter-title')
                ?.textContent,
        ).toBe('Interview');

        key('Escape');
        expect(list().hidden).toBe(true);
        expect(document.activeElement).toBe(toggle());
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on a press outside, and after a choice unless it stays open', () => {
        const { media } = make({ type: 'popover' });
        sizes({ left: 100, top: 100 });
        toggle().click();
        touch(document.body, 'pointerdown', 5, 5, 'mouse');
        expect(list().hidden).toBe(true);

        toggle().click();
        (list().querySelectorAll('nav button')[2] as HTMLButtonElement).click();
        expect(media.currentTime).toBe(50);
        expect(list().hidden).toBe(true);
        player?.destroy();
        host?.remove();

        make({ type: 'popover', stayOpen: true });
        sizes({ left: 100, top: 100 });
        toggle().click();
        (list().querySelectorAll('nav button')[1] as HTMLButtonElement).click();
        expect(list().hidden).toBe(false);
    });

    it('heads a floating list with its name and place, and the list in the player only when asked', () => {
        make({ type: 'popover' });
        expect(
            list().querySelector('.sonicframe-chapters-head'),
        ).not.toBeNull();
        player?.destroy();
        host?.remove();

        make(true);
        expect(list().querySelector('.sonicframe-chapters-head')).toBeNull();
        player?.destroy();
        host?.remove();

        make({ header: true });
        expect(
            list().querySelector('.sonicframe-chapters-head'),
        ).not.toBeNull();
    });

    it("hands the list's own item look to the list", () => {
        make({ look: { gap: 1 } });

        expect(
            (list().querySelector('ol') as HTMLElement).style.getPropertyValue(
                'gap',
            ),
        ).toBe('1rem');
    });

    it("wears the player's colors", () => {
        make({ type: 'popover' }, { palette: 'ocean' });
        sizes({ left: 100, top: 100 });
        toggle().click();
        const root = (host as HTMLElement).querySelector(
            '.sonicframe-player',
        ) as HTMLElement;

        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            root.style.getPropertyValue('--sonicframe-surface'),
        );
        expect(list().style.getPropertyValue('--sonicframe-surface')).not.toBe(
            '',
        );
    });
});

describe('the drawer', () => {
    it('takes no room on the page while closed, its own display included', () => {
        make({ type: 'drawer' });

        // `hidden` alone loses to a display set on the element.
        expect(list().style.getPropertyValue('display')).toBe('none');
        toggle().click();
        expect(list().style.getPropertyValue('display')).not.toBe('none');
        (
            list().querySelector('.sonicframe-chapter-close') as HTMLElement
        ).click();
        expect(list().style.getPropertyValue('display')).toBe('none');
    });

    it("lines the drawer's close button up with the list's head and the list's right edge", () => {
        const { box, close } = drawer({ type: 'drawer' });
        const name = box.querySelector('.sonicframe-chapters-head')
            ?.firstElementChild as HTMLElement;
        // The head's name runs from 21 to 43, its middle at 32.
        boxOf(name, { left: 185, top: 21, width: 60, height: 22 });
        toggle().click();

        // Middle at 32 → top edge at 18, which is 17 under the border's inside; right edge at
        // 463, which is 16 from the border's inside at 479.
        expect(px(close, 'top')).toBe(17);
        expect(px(close, 'right')).toBe(16);
    });

    it('keeps the close button in the corner of the list itself when the drawer has no head', () => {
        const { close } = drawer({ type: 'drawer', header: false });
        toggle().click();

        expect(px(close, 'top')).toBe(16);
        expect(px(close, 'right')).toBe(16);
    });

    it('opens along the right side by default, or the left, with a named close button', () => {
        make({ type: 'drawer' });
        toggle().click();

        expect(list().parentElement).toBe(document.body);
        expect(list().style.getPropertyValue('right')).toBe('0px');
        expect(list().style.getPropertyValue('width')).toBe('20rem');
        expect(list().style.getPropertyValue('max-width')).toBe('85vw');
        const close = list().querySelector(
            '.sonicframe-chapter-close',
        ) as HTMLButtonElement;
        expect(close.getAttribute('aria-label')).toBe('Close the chapters');
        close.click();
        expect(list().hidden).toBe(true);
        player?.destroy();
        host?.remove();

        make({ type: 'drawer', side: 'left', width: 30 });
        toggle().click();
        expect(list().style.getPropertyValue('left')).toBe('0px');
        expect(list().style.getPropertyValue('width')).toBe('30rem');
    });

    it('scrolls a long popover inside, with the arrow still outside it', () => {
        make({ type: 'popover', maxHeight: 12 });
        const scroll = list().querySelector(
            '.sonicframe-chapter-scroll',
        ) as HTMLElement;

        expect(scroll.querySelector('nav')).not.toBeNull();
        expect(scroll.style.getPropertyValue('max-height')).toBe('12rem');
        expect(scroll.style.getPropertyValue('overflow-y')).toBe('auto');
        expect(list().style.getPropertyValue('overflow')).toBe('visible');
        expect(
            list().querySelector('.sonicframe-chapter-arrow')?.parentElement,
        ).toBe(list());
    });

    it('dims the page behind it only when asked, and a press there closes it', () => {
        make({ type: 'drawer' });
        toggle().click();
        expect(
            document.querySelector('.sonicframe-chapter-backdrop'),
        ).toBeNull();
        player?.destroy();
        host?.remove();

        make({ type: 'drawer', backdrop: true });
        toggle().click();
        const backdrop = document.querySelector(
            '.sonicframe-chapter-backdrop',
        ) as HTMLElement;
        expect(backdrop.hidden).toBe(false);
        touch(backdrop, 'pointerdown', 5, 5, 'mouse');
        expect(list().hidden).toBe(true);
        expect(backdrop.hidden).toBe(true);
    });

    it('leaves the page when the player goes', () => {
        make({ type: 'drawer', backdrop: true });
        toggle().click();
        player?.destroy();

        expect(document.querySelector('.sonicframe-chapter-list')).toBeNull();
        expect(
            document.querySelector('.sonicframe-chapter-backdrop'),
        ).toBeNull();
    });
});

describe('every form', () => {
    it('adds its button at the end of the line when the look places none, so it can always open', () => {
        make({ type: 'popover' }, { look: { line: ['play', 'wave', 'time'] } });
        const line = toggle().parentElement as HTMLElement;

        expect(line.lastElementChild).toBe(toggle());
        expect(list().hidden).toBe(true);
        player?.destroy();
        host?.remove();

        // The list in the player keeps its old way: without a button, it always shows.
        make(true, { look: { line: ['play', 'wave', 'time'] } });
        expect(toggle()).toBeNull();
        expect(list().hidden).toBe(false);
    });

    it('moves only when asked, and never for people who asked for less motion', () => {
        const animate = vi.fn(() => ({ finished: Promise.resolve() }));
        const still = (reduce: boolean) =>
            stubMedia((query) => reduce && query.includes('reduce'));

        still(false);
        make({ type: 'popover' });
        list().animate = animate as never;
        sizes({ left: 100, top: 100 });
        toggle().click();
        expect(animate).not.toHaveBeenCalled();
        player?.destroy();
        host?.remove();

        make({ type: 'popover', animation: true });
        list().animate = animate as never;
        sizes({ left: 100, top: 100 });
        toggle().click();
        expect(animate).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(animate.mock.calls[0])).toContain('opacity');
        player?.destroy();
        host?.remove();

        still(true);
        make({ type: 'drawer', animation: true, animationType: 'slide' });
        list().animate = animate as never;
        toggle().click();
        expect(animate).toHaveBeenCalledTimes(1);
    });
});

describe('on the tag', () => {
    it('reads the list form, its side and the swipe from chapter-options', async () => {
        defineSonicPlayer();
        const element = document.createElement('sonic-player');
        element.setAttribute('src', 'talk.ogg');
        element.setAttribute('chapters', '/talk-panels.vtt');
        element.setAttribute(
            'chapter-options',
            'list drawer left backdrop swipe',
        );
        vi.stubGlobal('fetch', () => new Promise(() => undefined));
        keep(element);
        document.body.append(element);

        const button = element.querySelector(
            '.sonicframe-chapters-toggle',
        ) as HTMLButtonElement;
        button.click();
        const box = document.querySelector(
            '.sonicframe-chapter-list',
        ) as HTMLElement;

        expect(box.parentElement).toBe(document.body);
        expect(box.style.getPropertyValue('left')).toBe('0px');
        expect(
            document.querySelector('.sonicframe-chapter-backdrop'),
        ).not.toBeNull();
        element.remove();
        await Promise.resolve();
        expect(document.querySelector('.sonicframe-chapter-list')).toBeNull();
    });
});
