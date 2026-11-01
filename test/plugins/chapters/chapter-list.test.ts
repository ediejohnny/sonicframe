/**
 * The chapters list in an element of the app: a `nav` of buttons, the chapter playing marked,
 * and the pictures, links, head and look it is asked for.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { chapters } from '../../../src/index';
import { playTo } from '../../support/events';
import { mount, takeOff } from '../../support/helpers';
import { plugin, showFrame } from './chapters-harness';

afterEach(() => {
    document.querySelector('[role="status"]')?.replaceChildren();
});

describe('the list', () => {
    it('lists the chapters as buttons in a named nav, marks the current one, and goes there on a click', () => {
        const list = document.createElement('div');
        const shown = showFrame([plugin({ list })]);
        const { media } = shown;
        const nav = list.querySelector('nav');
        const buttons = [...list.querySelectorAll('button')];

        expect(nav?.getAttribute('aria-label')).toBe('Chapters');
        expect(
            buttons.map(
                (button) =>
                    button.querySelector('.sonicframe-chapter-title')
                        ?.textContent,
            ),
        ).toEqual(['Intro', 'Interview', 'Chapter 3 of 3']);
        expect(buttons[0].getAttribute('aria-current')).toBe('true');

        buttons[2].click();
        expect(media.currentTime).toBe(50);
        expect(buttons[2].getAttribute('aria-current')).toBe('true');
        expect(buttons[0].hasAttribute('aria-current')).toBe(false);

        shown.frame.destroy();
        expect(list.childElementCount).toBe(0);
    });

    it("says each chapter's stretch, and marks the one playing instead of its number", () => {
        const list = document.createElement('div');
        showFrame([plugin({ list })]);
        const buttons = [...list.querySelectorAll('button')];
        const text = (button: Element, name: string) =>
            button.querySelector(`.sonicframe-chapter-${name}`)?.textContent;

        expect(buttons.map((button) => text(button, 'span'))).toEqual([
            '0:00 – 0:25',
            '0:25 – 0:50',
            '0:50 – 1:40',
        ]);
        expect(
            buttons[0].querySelector('.sonicframe-chapter-playing'),
        ).not.toBeNull();
        expect(buttons.slice(1).map((button) => text(button, 'mark'))).toEqual([
            '2',
            '3',
        ]);
        expect(
            buttons[0]
                .querySelector('.sonicframe-chapter-mark')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('gives the last stretch its end once the duration arrives', () => {
        const list = document.createElement('div');
        const mounted = mount({ plugins: [plugin({ list })], animate: false });
        const last = () =>
            [...list.querySelectorAll('.sonicframe-chapter-span')].at(-1)
                ?.textContent;

        expect(last()).toBe('0:50');
        mounted.frame.setDuration(100);
        expect(last()).toBe('0:50 – 1:40');
    });

    it('tints the chapter playing and fills its bar as it plays', () => {
        const list = document.createElement('div');
        const { media } = showFrame([plugin({ list })]);
        playTo(media, 30);
        const buttons = [...list.querySelectorAll('button')];
        const fill = buttons[1].querySelector(
            '.sonicframe-chapter-progress',
        ) as HTMLElement;

        expect(buttons[1].style.getPropertyValue('background-color')).toContain(
            '--sonicframe-region',
        );
        expect(buttons[0].style.getPropertyValue('background-color')).toBe(
            'transparent',
        );
        // 30 s into the stretch from 25 s to 50 s: a fifth of it.
        expect(fill.style.getPropertyValue('width')).toBe('20%');
        expect(
            buttons[0].querySelector('.sonicframe-chapter-progress'),
        ).toBeNull();
    });

    it('heads the list with its name and the place of the chapter playing, when asked', () => {
        const plain = document.createElement('div');
        const first = showFrame([plugin({ list: plain })]);
        expect(plain.querySelector('.sonicframe-chapters-head')).toBeNull();
        takeOff(first);

        const list = document.createElement('div');
        const { media } = showFrame([plugin({ list, header: true })]);
        const head = list.querySelector(
            '.sonicframe-chapters-head',
        ) as HTMLElement;

        expect(
            head.querySelector('.sonicframe-chapters-name')?.textContent,
        ).toBe('Chapters');
        expect(
            head.querySelector('.sonicframe-chapters-place')?.textContent,
        ).toBe('1 / 3');
        playTo(media, 30);
        expect(
            head.querySelector('.sonicframe-chapters-place')?.textContent,
        ).toBe('2 / 3');
    });

    it('takes its own look: picture size and shape, which pieces show, title lines and spacing', () => {
        const list = document.createElement('div');
        const { media } = showFrame([
            chapters({
                items: [
                    { start: 0, title: 'A', image: '/a.png' },
                    { start: 10, title: 'B', image: '/b.png' },
                ],
                list,
                images: true,
                listLook: {
                    thumbWidth: 6,
                    thumbShape: 'wide',
                    thumbCorner: 0,
                    numbers: false,
                    span: false,
                    length: false,
                    progress: false,
                    tint: false,
                    titleLines: 1,
                    itemPadding: 1,
                    itemCorner: 0.5,
                    gap: 0.5,
                },
            }),
        ]);
        playTo(media, 5);
        const button = list.querySelector('button') as HTMLElement;
        const thumb = list.querySelector(
            '.sonicframe-chapter-thumb',
        ) as HTMLElement;

        expect(thumb.style.getPropertyValue('width')).toBe('6rem');
        // A wide picture keeps 16:9.
        expect(thumb.style.getPropertyValue('height')).toBe('3.375rem');
        expect(thumb.style.getPropertyValue('border-radius')).toBe('0rem');
        expect(list.querySelector('.sonicframe-chapter-mark')).toBeNull();
        expect(list.querySelector('.sonicframe-chapter-span')).toBeNull();
        expect(list.querySelector('.sonicframe-chapter-length')).toBeNull();
        expect(list.querySelector('.sonicframe-chapter-progress')).toBeNull();
        expect(button.style.getPropertyValue('background-color')).toBe(
            'transparent',
        );
        expect(button.getAttribute('aria-current')).toBe('true');
        expect(
            (
                list.querySelector('.sonicframe-chapter-title') as HTMLElement
            ).style.getPropertyValue('max-height'),
        ).toBe('1.3em');
        expect(button.style.getPropertyValue('padding')).toBe('1rem');
        expect(button.style.getPropertyValue('border-radius')).toBe('0.5rem');
        expect(
            (list.querySelector('ol') as HTMLElement).style.getPropertyValue(
                'gap',
            ),
        ).toBe('0.5rem');
    });

    it('keeps the number but not the playing mark, and keeps sizes in range', () => {
        const list = document.createElement('div');
        showFrame([
            chapters({
                items: [{ start: 0, title: 'A', image: '/a.png' }],
                list,
                images: true,
                listLook: { playingMark: false, thumbWidth: 99, titleLines: 0 },
            }),
        ]);

        expect(
            list.querySelector('.sonicframe-chapter-mark')?.textContent,
        ).toBe('1');
        expect(list.querySelector('.sonicframe-chapter-playing')).toBeNull();
        expect(
            (
                list.querySelector('.sonicframe-chapter-thumb') as HTMLElement
            ).style.getPropertyValue('width'),
        ).toBe('12rem');
        expect(
            (
                list.querySelector('.sonicframe-chapter-title') as HTMLElement
            ).style.getPropertyValue('max-height'),
        ).toBe('1.3em');
    });

    it('shows pictures and links only when asked, links opening apart', () => {
        const items = [
            {
                start: 0,
                title: 'A',
                image: 'https://example.com/a.jpg',
                url: 'https://example.com/a',
            },
            {
                start: 10,
                title: 'B',
                image: 'https://example.com/b.jpg',
                url: 'javascript:alert(1)',
            },
        ];
        const plain = document.createElement('div');
        const first = showFrame([chapters({ items, list: plain })]);
        expect(plain.querySelector('img')).toBeNull();
        expect(plain.querySelector('a')).toBeNull();
        takeOff(first);

        const rich = document.createElement('div');
        showFrame([chapters({ items, list: rich, images: true, links: true })]);
        const links = rich.querySelectorAll('a');

        expect(rich.querySelector('img')?.getAttribute('src')).toBe(
            'https://example.com/a.jpg',
        );
        expect(rich.querySelector('img')?.getAttribute('alt')).toBe('');
        // Each picture carries its chapter's length (0 to 10 s, 10 to 100 s), already said by its stretch.
        const lengths = [
            ...rich.querySelectorAll('.sonicframe-chapter-length'),
        ];
        expect(lengths.map((length) => length.textContent)).toEqual([
            '0:10',
            '1:30',
        ]);
        expect(lengths[0].closest('[aria-hidden="true"]')).not.toBeNull();
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toBe('https://example.com/a');
        expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
        expect(links[0].getAttribute('target')).toBe('_blank');
        expect(links[0].getAttribute('aria-label')).toBe('Link: A');
    });
});
