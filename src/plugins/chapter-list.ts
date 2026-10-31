/**
 * The chapters list on the page: a `nav` of buttons, one per chapter, with its number (or, for the
 * chapter playing, a still mark of sound bars), its picture when asked (with the chapter's length on
 * it), its title in up to two lines and its stretch ("0:25 – 0:50") under it. The chapter playing
 * is tinted in the played color and fills a thin bar as it plays; a head, when asked, names the list
 * and the place of the chapter playing. Text only ever goes in as text, and every color through a
 * `--sonicframe-*` variable.
 */

import type { Chapter } from '../core/chapters';
import { formatTime } from '../core/timing';

/** How the list's items look; each left out keeps its default. */
export type ChapterListLook = {
    /** The picture's width, in rem: 3.5 by default, from 1 to 12. */
    thumbWidth?: number;
    /** `'square'` (the default) or `'wide'` (16:9). */
    thumbShape?: 'square' | 'wide';
    /** The picture's corner radius, in rem: 0.25 by default, from 0 to 2. */
    thumbCorner?: number;
    /** The column with each chapter's number (and the playing mark). On by default. */
    numbers?: boolean;
    /** Sound bars in place of the number of the chapter playing. On by default. */
    playingMark?: boolean;
    /** The stretch under the title ("0:25 – 0:50"). On by default. */
    span?: boolean;
    /** The chapter's length on its picture. On by default. */
    length?: boolean;
    /** A thin bar under the chapter playing, filled as it plays. On by default. */
    progress?: boolean;
    /** The chapter playing tinted in the played color. On by default. */
    tint?: boolean;
    /** The most lines a title takes before it is cut: 2 by default, from 1 to 4. */
    titleLines?: number;
    /** Space inside each item, in rem: 0.375 by default, from 0 to 2. */
    itemPadding?: number;
    /** Each item's corner radius, in rem: 0.25 by default, from 0 to 2. */
    itemCorner?: number;
    /** Space between items, in rem: 0.125 by default, from 0 to 2. */
    gap?: number;
};

type ListLook = Required<ChapterListLook>;

/** A number from `min` to `max`, or `fallback` when it is not a finite number. */
function size(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
}

/** The look asked for, checked: known values only, sizes in range. */
function resolveListLook(look: ChapterListLook = {}): ListLook {
    return {
        thumbWidth: size(look.thumbWidth, 3.5, 1, 12),
        thumbShape: look.thumbShape === 'wide' ? 'wide' : 'square',
        thumbCorner: size(look.thumbCorner, 0.25, 0, 2),
        numbers: look.numbers !== false,
        playingMark: look.playingMark !== false,
        span: look.span !== false,
        length: look.length !== false,
        progress: look.progress !== false,
        tint: look.tint !== false,
        titleLines: Math.round(size(look.titleLines, 2, 1, 4)),
        itemPadding: size(look.itemPadding, 0.375, 0, 2),
        itemCorner: size(look.itemCorner, 0.25, 0, 2),
        gap: size(look.gap, 0.125, 0, 2),
    };
}

export type ChapterListOptions = {
    /** The list's name (its `aria-label`, and the head's text). */
    name: string;
    /** The text of a chapter's link. */
    link: string;
    images: boolean;
    links: boolean;
    header: boolean;
    look?: ChapterListLook;
};

const SVG = 'http://www.w3.org/2000/svg';

/** Three bars of different heights, the mark of the chapter playing (on a 12 × 12 grid). */
const PLAYING = 'M1 5h2v6H1zM5 1h2v10H5zM9 4h2v7H9z';

const TINT = 'var(--sonicframe-region, rgba(47, 111, 219, 0.18))';
const MUTED = 'var(--sonicframe-muted, currentColor)';
const PLAYED = 'var(--sonicframe-progress, #2f6fdb)';

function css(
    element: HTMLElement | SVGElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}

function span(className: string, text: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;

    return element;
}

export class ChapterListView {
    private readonly nav: HTMLElement;
    private readonly list: HTMLOListElement;
    private readonly place: HTMLElement | null = null;
    private readonly look: ListLook;
    private buttons: HTMLButtonElement[] = [];
    private marks: (HTMLElement | null)[] = [];
    private fill: HTMLElement | null = null;
    private current = -1;

    constructor(
        target: HTMLElement,
        private readonly options: ChapterListOptions,
        private readonly onChoose: (index: number) => void,
    ) {
        this.look = resolveListLook(options.look);
        this.nav = document.createElement('nav');
        this.nav.className = 'sonicframe-chapters';
        this.nav.setAttribute('aria-label', options.name);

        if (options.header) {
            // The nav's name and each button's aria-current already say this to screen readers.
            const head = document.createElement('div');
            head.className = 'sonicframe-chapters-head';
            head.setAttribute('aria-hidden', 'true');
            css(head, [
                ['display', 'flex'],
                ['align-items', 'baseline'],
                ['gap', '0.5rem'],
                ['padding', '0.25rem 0.5rem 0.5rem'],
            ]);
            const name = span('sonicframe-chapters-name', options.name);
            css(name, [['font-weight', '700']]);
            const place = span('sonicframe-chapters-place', '');
            css(place, [
                ['font-size', '0.75rem'],
                ['color', MUTED],
                ['font-variant-numeric', 'tabular-nums'],
            ]);
            head.append(name, place);
            this.nav.append(head);
            this.place = place;
        }

        this.list = document.createElement('ol');
        css(this.list, [
            ['list-style', 'none'],
            ['margin', '0'],
            ['padding', '0'],
            ['display', 'flex'],
            ['flex-direction', 'column'],
            ['gap', `${this.look.gap}rem`],
        ]);
        this.nav.append(this.list);
        target.append(this.nav);
    }

    /** Builds the list again: the chapters, where each one ends (null while unknown) and their names. */
    render(
        chapters: readonly Chapter[],
        ends: readonly (number | null)[],
        title: (index: number) => string,
    ): void {
        this.list.replaceChildren();
        this.buttons = [];
        this.marks = [];
        this.fill = null;
        const current = this.current;
        this.current = -1;

        chapters.forEach((chapter, at) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            const end = ends[at] ?? null;
            const name = title(at);
            css(item, [
                ['display', 'flex'],
                ['align-items', 'center'],
                ['gap', '0.25rem'],
            ]);
            button.type = 'button';
            button.className = 'sonicframe-chapter';
            css(button, [
                ['position', 'relative'],
                ['display', 'flex'],
                ['align-items', 'center'],
                ['gap', '0.625rem'],
                ['flex', '1 1 auto'],
                ['min-width', '0'],
                ['margin', '0'],
                ['padding', `${this.look.itemPadding}rem`],
                ['overflow', 'hidden'],
                ['border-width', '0'],
                ['border-radius', `${this.look.itemCorner}rem`],
                ['background-color', 'transparent'],
                ['color', 'inherit'],
                ['font', 'inherit'],
                ['text-align', 'start'],
                ['cursor', 'pointer'],
            ]);

            if (this.look.numbers) {
                const mark = span('sonicframe-chapter-mark', String(at + 1));
                mark.setAttribute('aria-hidden', 'true');
                css(mark, [
                    ['flex', '0 0 1.25rem'],
                    ['text-align', 'center'],
                    ['font-size', '0.75rem'],
                    ['color', MUTED],
                    ['font-variant-numeric', 'tabular-nums'],
                ]);
                button.append(mark);
                this.marks.push(mark);
            } else {
                this.marks.push(null);
            }

            if (this.options.images && chapter.image !== null) {
                button.append(this.thumb(chapter, end));
            }

            const text = document.createElement('span');
            css(text, [
                ['display', 'flex'],
                ['flex-direction', 'column'],
                ['gap', '0.125rem'],
                ['min-width', '0'],
            ]);
            const heading = span('sonicframe-chapter-title', name);
            heading.setAttribute('dir', 'auto');
            css(heading, [
                ['font-weight', '600'],
                ['line-height', '1.3'],
                ['overflow', 'hidden'],
                ['display', '-webkit-box'],
                ['-webkit-box-orient', 'vertical'],
                ['-webkit-line-clamp', String(this.look.titleLines)],
                // The cut where line-clamp is missing: that many lines of 1.3em.
                [
                    'max-height',
                    `${Math.round(this.look.titleLines * 13) / 10}em`,
                ],
                ['overflow-wrap', 'anywhere'],
            ]);
            text.append(heading);

            if (this.look.span) {
                const stretch = span(
                    'sonicframe-chapter-span',
                    end === null
                        ? formatTime(chapter.start)
                        : `${formatTime(chapter.start)} – ${formatTime(end)}`,
                );
                css(stretch, [
                    ['font-size', '0.75rem'],
                    ['color', MUTED],
                    ['font-variant-numeric', 'tabular-nums'],
                ]);
                text.append(stretch);
            }

            button.append(text);
            button.addEventListener('click', () => this.onChoose(at));
            item.append(button);

            if (this.options.links && chapter.url !== null) {
                const link = document.createElement('a');
                link.className = 'sonicframe-chapter-link';
                link.href = chapter.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = this.options.link;
                link.setAttribute(
                    'aria-label',
                    `${this.options.link}: ${name}`,
                );
                css(link, [
                    ['flex-shrink', '0'],
                    ['font-size', '0.75rem'],
                    ['color', PLAYED],
                    ['padding', '0 0.25rem'],
                ]);
                item.append(link);
            }

            this.list.append(item);
            this.buttons.push(button);
        });

        this.mark(current, null);
    }

    /**
     * Marks the chapter playing (-1 for none): `aria-current`, its tint and playing mark, the head's
     * place; `played` (0 to 1, or null) fills its bar.
     */
    mark(index: number, played: number | null): void {
        if (index !== this.current) {
            this.buttons.forEach((button, at) => {
                const on = at === index;
                const mark = this.marks[at];

                if (on) {
                    button.setAttribute('aria-current', 'true');
                } else {
                    button.removeAttribute('aria-current');
                }

                button.style.setProperty(
                    'background-color',
                    on && this.look.tint ? TINT : 'transparent',
                );
                mark?.replaceChildren(
                    on && this.look.playingMark
                        ? this.playing()
                        : String(at + 1),
                );
            });

            this.fill?.parentElement?.remove();
            this.fill =
                index >= 0 && this.look.progress
                    ? this.bar(this.buttons[index])
                    : null;
            this.current = index;

            if (this.place !== null) {
                this.place.textContent =
                    index >= 0 ? `${index + 1} / ${this.buttons.length}` : '';
            }
        }

        if (this.fill !== null) {
            const share =
                played === null ? 0 : Math.min(1, Math.max(0, played));
            this.fill.style.setProperty('width', `${Math.round(share * 100)}%`);
        }
    }

    /** Takes the list off the page. */
    destroy(): void {
        this.nav.remove();
    }

    /** The chapter's picture, square or wide, with its length on it (said already by its stretch). */
    private thumb(chapter: Chapter, end: number | null): HTMLElement {
        const { thumbWidth, thumbShape, thumbCorner } = this.look;
        const height =
            thumbShape === 'wide' ? (thumbWidth * 9) / 16 : thumbWidth;
        const box = document.createElement('span');
        box.className = 'sonicframe-chapter-thumb';
        css(box, [
            ['position', 'relative'],
            ['flex', `0 0 ${thumbWidth}rem`],
            ['width', `${thumbWidth}rem`],
            ['height', `${height}rem`],
            ['overflow', 'hidden'],
            ['border-radius', `${thumbCorner}rem`],
            ['background-color', TINT],
        ]);
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.src = chapter.image ?? '';
        css(image, [
            ['display', 'block'],
            ['width', '100%'],
            ['height', '100%'],
            ['object-fit', 'cover'],
        ]);
        box.append(image);

        if (end !== null && this.look.length) {
            const length = span(
                'sonicframe-chapter-length',
                formatTime(end - chapter.start),
            );
            const cover = document.createElement('span');
            cover.setAttribute('aria-hidden', 'true');
            cover.append(length);
            css(length, [
                ['position', 'absolute'],
                ['right', '0.1875rem'],
                ['bottom', '0.1875rem'],
                ['padding', '0 0.25rem'],
                ['border-radius', '0.125rem'],
                ['background-color', 'rgba(0, 0, 0, 0.72)'],
                ['color', '#ffffff'],
                ['font-size', '0.6875rem'],
                ['line-height', '1.4'],
                ['font-variant-numeric', 'tabular-nums'],
            ]);
            box.append(cover);
        }

        return box;
    }

    /** The still mark of the chapter playing: three sound bars in the played color. */
    private playing(): SVGSVGElement {
        const icon = document.createElementNS(SVG, 'svg');
        const path = document.createElementNS(SVG, 'path');
        icon.setAttribute('class', 'sonicframe-chapter-playing');
        icon.setAttribute('viewBox', '0 0 12 12');
        icon.setAttribute('focusable', 'false');
        path.setAttribute('d', PLAYING);
        path.setAttribute('fill', 'currentColor');
        icon.append(path);
        css(icon, [
            ['width', '0.75rem'],
            ['height', '0.75rem'],
            ['color', PLAYED],
            ['vertical-align', 'middle'],
        ]);

        return icon;
    }

    /** The thin bar along the bottom of the chapter playing, filled as it plays. */
    private bar(button: HTMLButtonElement | undefined): HTMLElement | null {
        if (button === undefined) {
            return null;
        }

        const track = document.createElement('span');
        const fill = document.createElement('span');
        track.setAttribute('aria-hidden', 'true');
        fill.className = 'sonicframe-chapter-progress';
        css(track, [
            ['position', 'absolute'],
            ['left', '0'],
            ['right', '0'],
            ['bottom', '0'],
            ['height', '0.125rem'],
        ]);
        css(fill, [
            ['display', 'block'],
            ['height', '100%'],
            ['width', '0%'],
            ['background-color', PLAYED],
        ]);
        track.append(fill);
        button.append(track);

        return fill;
    }
}
