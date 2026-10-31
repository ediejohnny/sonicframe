/**
 * The player's chapters list in its other forms: a popover over the page with an arrow at its
 * button, kept inside the edges, and a drawer along a side of the page; both close by Escape, a
 * press outside, focus leaving or a choice, and give the focus back. Off the wave, a finger's swipe
 * opens and closes the list when asked.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    FONT_STACKS,
    PALETTES,
    type Player,
    type PlayerChapterList,
    type PlayerOptions,
} from '../../src/player';
import { boxOf, fakeMedia } from './helpers';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const ITEMS = [
    { start: 0, title: 'Intro' },
    { start: 25, title: 'Interview' },
    { start: 50, title: 'Songs' },
];

const LOOK: PlayerOptions['look'] = {
    line: ['play', 'wave'],
    meta: ['time', 'chapter', 'spacer', 'chapters'],
};

type Media = ReturnType<typeof fakeMedia>;

function make(
    list: boolean | PlayerChapterList,
    options: Partial<PlayerOptions> = {},
): { player: Player; media: Media } {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 480, height: 48 });
    const media = fakeMedia({ duration: 100 });
    player = createPlayer({
        container: host,
        peaks: [0.5, 0.5, 0.5, 0.5],
        media,
        chapters: { items: ITEMS, list },
        look: LOOK,
        ...options,
    });

    return { player, media };
}

function toggle(): HTMLButtonElement {
    return (host as HTMLElement).querySelector(
        '.sonicframe-chapters-toggle',
    ) as HTMLButtonElement;
}

function list(): HTMLElement {
    return document.querySelector('.sonicframe-chapter-list') as HTMLElement;
}

/** Gives the button and the list their on-screen boxes (happy-dom has no layout): a 240 × 200 list. */
function sizes(button: { left: number; top: number }): void {
    boxOf(toggle(), { ...button, width: 24, height: 24 });
    boxOf(list(), { left: 0, top: 0, width: 240, height: 200 });
}

function px(element: HTMLElement, name: string): number {
    return parseFloat(element.style.getPropertyValue(name));
}

function key(name: string): void {
    document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true }),
    );
}

function touch(
    target: Element,
    type: string,
    x: number,
    y: number,
    pointerType = 'touch',
): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
            clientX: x,
            clientY: y,
            pointerId: 7,
            pointerType,
            isPrimary: true,
            button: 0,
        }),
    );
}

function swipe(
    target: Element,
    dx: number,
    dy: number,
    pointerType = 'touch',
): void {
    touch(target, 'pointerdown', 100, 100, pointerType);
    touch(target, 'pointerup', 100 + dx, 100 + dy, pointerType);
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
        expect(px(arrow, 'left') + 6).toBe(224);
        expect(arrow.style.getPropertyValue('top')).not.toBe('');
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

        expect(document.activeElement?.textContent).toBe('0:25Interview');

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

describe("the list's own look", () => {
    it("takes its own palette over the player's, by name or as colors", () => {
        make({ type: 'popover', palette: 'berry' }, { palette: 'ocean' });
        sizes({ left: 100, top: 100 });
        toggle().click();
        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.berry.surface,
        );
        player?.destroy();
        host?.remove();

        make({
            type: 'drawer',
            palette: { ...PALETTES.light, surface: '#101820', text: '#f0f0f0' },
        });
        toggle().click();
        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            '#101820',
        );
        expect(list().style.getPropertyValue('--sonicframe-text')).toBe(
            '#f0f0f0',
        );
    });

    it('dresses the list in the player too', () => {
        make({ palette: 'berry', style: { corner: 1 } });

        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe(
            PALETTES.berry.surface,
        );
        expect(list().style.getPropertyValue('border-radius')).toBe('1rem');
    });

    it('takes its own font, and its own corners, border, shadow, padding and text size', () => {
        make({
            type: 'popover',
            font: 'mono',
            style: {
                corner: 1,
                border: 0,
                shadow: 'none',
                padding: 1.5,
                fontSize: 1,
            },
        });
        sizes({ left: 100, top: 100 });
        toggle().click();
        const style = list().style;

        // The page may write the stack's quotes its own way.
        expect(style.getPropertyValue('font-family').replace(/["']/g, '')).toBe(
            FONT_STACKS.mono.replace(/["']/g, ''),
        );
        expect(style.getPropertyValue('border-radius')).toBe('1rem');
        expect(style.getPropertyValue('border-width')).toBe('0px');
        expect(style.getPropertyValue('box-shadow')).toBe('none');
        expect(style.getPropertyValue('padding')).toBe('1.5rem');
        expect(style.getPropertyValue('font-size')).toBe('1rem');
    });

    it('keeps sizes in range, and an unknown palette or shadow leaves the defaults', () => {
        make({
            type: 'popover',
            palette: 'nope' as never,
            style: { corner: 99, shadow: 'loud' as never },
        });
        sizes({ left: 100, top: 100 });
        toggle().click();

        expect(list().style.getPropertyValue('border-radius')).toBe('4rem');
        expect(list().style.getPropertyValue('box-shadow')).not.toBe('loud');
        expect(list().style.getPropertyValue('--sonicframe-surface')).toBe('');
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
            vi.stubGlobal('matchMedia', (query: string) => ({
                matches: reduce && query.includes('reduce'),
                media: query,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }));

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

describe('the swipe', () => {
    function meta(): HTMLElement {
        return (host as HTMLElement).querySelector('.sonicframe-chapter-now')
            ?.parentElement as HTMLElement;
    }

    it('opens the list with a finger swiping up off the wave, and closes it the other way', () => {
        make({ type: 'popover', swipe: true });
        sizes({ left: 100, top: 100 });

        swipe(meta(), 0, -80);
        expect(list().hidden).toBe(false);

        swipe(meta(), 0, 80);
        expect(list().hidden).toBe(true);
    });

    it('leaves the wave, the mouse, short moves and the other axis alone', () => {
        make({ type: 'popover', swipe: true });
        sizes({ left: 100, top: 100 });
        const wave = (host as HTMLElement).querySelector(
            '[role="slider"]',
        ) as HTMLElement;

        // One at a time: a press outside an open list would close it and hide a wrong opening.
        swipe(wave, 0, -80);
        expect(list().hidden).toBe(true);
        swipe(meta(), 0, -80, 'mouse');
        expect(list().hidden).toBe(true);
        swipe(meta(), 0, -20);
        expect(list().hidden).toBe(true);
        // Long enough up, but more sideways than up.
        swipe(meta(), -90, -60);
        expect(list().hidden).toBe(true);
    });

    it('takes its own direction, and keeps the page scrolling the other way', () => {
        make({ type: 'popover', swipe: true, swipeDirection: 'left' });
        sizes({ left: 100, top: 100 });

        expect(meta().style.getPropertyValue('touch-action')).toBe('pan-y');
        swipe(meta(), 0, -80);
        expect(list().hidden).toBe(true);
        swipe(meta(), -80, 0);
        expect(list().hidden).toBe(false);
    });

    it('is off by default, and touches nothing', () => {
        make({ type: 'popover' });
        sizes({ left: 100, top: 100 });

        swipe(meta(), 0, -80);
        expect(list().hidden).toBe(true);
        expect(meta().style.getPropertyValue('touch-action')).toBe('');
    });
});

describe('on the tag', () => {
    it('reads the list form, its side and the swipe from chapter-options', () => {
        defineSonicPlayer();
        const element = document.createElement('sonic-player');
        element.setAttribute('src', 'talk.ogg');
        element.setAttribute('chapters', '/talk-panels.vtt');
        element.setAttribute(
            'chapter-options',
            'list drawer left backdrop swipe',
        );
        vi.stubGlobal('fetch', () => new Promise(() => undefined));
        host = element;
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
        expect(document.querySelector('.sonicframe-chapter-list')).toBeNull();
    });
});
