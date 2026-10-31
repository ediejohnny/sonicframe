/**
 * The chapters list on the page: a `nav` of buttons, one per chapter, with its number (or, for the
 * chapter playing, a still mark of sound bars), its picture when asked (with the chapter's length on
 * it), its title in up to two lines and its stretch ("0:25 – 0:50") under it. The chapter playing
 * is tinted in the played color and fills a thin bar as it plays; a head, when asked, names the list
 * and the place of the chapter playing. Text only ever goes in as text, and every color through a
 * `--sonicframe-*` variable.
 */

import type { Chapter } from '../../core/chapters/chapters';
import { formatTime } from '../../core/shared/timing';
import { MUTED, PROGRESS, REGION } from '../../core/shared/variables';
import { css } from '../../dom/shared/css';
import {
    chapterThumb,
    playingMark,
    progressBar,
    textSpan,
} from './chapter-item';
import {
    resolveListLook,
    type ChapterListLook,
    type ListLook,
} from './chapter-list-look';

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
            const name = textSpan('sonicframe-chapters-name', options.name);
            css(name, [['font-weight', '700']]);
            const place = textSpan('sonicframe-chapters-place', '');
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
                const mark = textSpan(
                    'sonicframe-chapter-mark',
                    String(at + 1),
                );
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
                button.append(chapterThumb(chapter, end, this.look));
            }

            const text = document.createElement('span');
            css(text, [
                ['display', 'flex'],
                ['flex-direction', 'column'],
                ['gap', '0.125rem'],
                ['min-width', '0'],
            ]);
            const heading = textSpan('sonicframe-chapter-title', name);
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
                const stretch = textSpan(
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
                    ['color', PROGRESS],
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
                    on && this.look.tint ? REGION : 'transparent',
                );
                mark?.replaceChildren(
                    on && this.look.playingMark
                        ? playingMark()
                        : String(at + 1),
                );
            });

            this.fill?.parentElement?.remove();
            this.fill =
                index >= 0 && this.look.progress
                    ? progressBar(this.buttons[index])
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
}
