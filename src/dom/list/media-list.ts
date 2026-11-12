/**
 * A media list on the page (a chapters list, a playlist): a `nav` of buttons, one per item, with its
 * number (or, for the item playing, a still mark of sound bars), its picture when it has one (with
 * its length on it), its title in up to two lines and a line under it. The item playing is tinted in
 * the played color and fills a thin bar as it plays; a head, when asked, names the list and the place
 * of the item playing. Class names start with the list's prefix, text only ever goes in as text, and
 * every color through a `--sonicframe-*` variable.
 */

import { MUTED, PROGRESS, REGION } from '../../core/shared/variables';
import { css } from '../shared/css';
import {
    resolveListLook,
    type ListLook,
    type MediaListLook,
} from './list-look';
import { itemThumb, playingMark, progressBar, textSpan } from './media-item';

/** One item of the list, ready to show: its words and addresses already cleaned and checked. */
export type MediaListItem = {
    readonly title: string;
    /** The line under the title (a chapter's stretch, a track's artist), or null. */
    readonly span: string | null;
    /** A picture's checked address, or null. */
    readonly image: string | null;
    /** The length shown on the picture, as text, or null. */
    readonly length: string | null;
    /** A link beside the item (a chapter's page), with a checked address, or null. */
    readonly link: { readonly href: string; readonly text: string } | null;
};

export type MediaListOptions = {
    /** The start of every class name: `sonicframe-chapter`, `sonicframe-track`. */
    prefix: string;
    /** The list's name (its `aria-label`, and the head's text). */
    name: string;
    header: boolean;
    look?: MediaListLook;
};

export class MediaListView {
    private readonly nav: HTMLElement;
    private readonly list: HTMLOListElement;
    private readonly place: HTMLElement | null = null;
    private readonly look: ListLook;
    private readonly prefix: string;
    private buttons: HTMLButtonElement[] = [];
    private marks: (HTMLElement | null)[] = [];
    private fill: HTMLElement | null = null;
    private current = -1;

    constructor(
        target: HTMLElement,
        options: MediaListOptions,
        private readonly onChoose: (index: number) => void,
    ) {
        this.prefix = options.prefix;
        this.look = resolveListLook(options.look);
        this.nav = document.createElement('nav');
        this.nav.className = `${this.prefix}s`;
        this.nav.setAttribute('aria-label', options.name);

        if (options.header) {
            // The nav's name and each button's aria-current already say this to screen readers.
            const head = document.createElement('div');
            head.className = `${this.prefix}s-head`;
            head.setAttribute('aria-hidden', 'true');
            css(head, [
                ['display', 'flex'],
                ['align-items', 'baseline'],
                ['gap', '0.5rem'],
                ['padding', '0.25rem 0.5rem 0.5rem'],
            ]);
            const name = textSpan(`${this.prefix}s-name`, options.name);
            css(name, [['font-weight', '700']]);
            const place = textSpan(`${this.prefix}s-place`, '');
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

    /** The list's buttons, one per item, in order. */
    get items(): readonly HTMLButtonElement[] {
        return this.buttons;
    }

    /** Builds the list again from `items`, keeping the item playing marked. */
    render(items: readonly MediaListItem[]): void {
        this.list.replaceChildren();
        this.buttons = [];
        this.marks = [];
        this.fill = null;
        const current = this.current;
        this.current = -1;

        items.forEach((entry, at) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            css(item, [
                ['display', 'flex'],
                ['align-items', 'center'],
                ['gap', '0.25rem'],
            ]);
            button.type = 'button';
            button.className = this.prefix;
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

            this.marks.push(this.look.numbers ? this.number(button, at) : null);

            if (entry.image !== null) {
                button.append(
                    itemThumb(
                        this.prefix,
                        entry.image,
                        entry.length,
                        this.look,
                    ),
                );
            }

            button.append(this.words(entry));
            button.addEventListener('click', () => this.onChoose(at));
            item.append(button);

            if (entry.link !== null) {
                item.append(this.linkOf(entry.link, entry.title));
            }

            this.list.append(item);
            this.buttons.push(button);
        });

        this.mark(current, null);
    }

    /**
     * Marks the item playing (-1 for none): `aria-current`, its tint and playing mark, the head's
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
                        ? playingMark(this.prefix)
                        : String(at + 1),
                );
            });

            this.fill?.parentElement?.remove();
            this.fill =
                index >= 0 && this.look.progress
                    ? progressBar(this.prefix, this.buttons[index])
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

    /** The column with the item's number, put in `button`. */
    private number(button: HTMLButtonElement, at: number): HTMLElement {
        const mark = textSpan(`${this.prefix}-mark`, String(at + 1));
        mark.setAttribute('aria-hidden', 'true');
        css(mark, [
            ['flex', '0 0 1.25rem'],
            ['text-align', 'center'],
            ['font-size', '0.75rem'],
            ['color', MUTED],
            ['font-variant-numeric', 'tabular-nums'],
        ]);
        button.append(mark);

        return mark;
    }

    /** The title, cut after the look's lines, and the line under it. */
    private words(entry: MediaListItem): HTMLElement {
        const text = document.createElement('span');
        css(text, [
            ['display', 'flex'],
            ['flex-direction', 'column'],
            ['gap', '0.125rem'],
            ['min-width', '0'],
        ]);
        const heading = textSpan(`${this.prefix}-title`, entry.title);
        heading.setAttribute('dir', 'auto');
        css(heading, [
            ['font-weight', '600'],
            ['line-height', '1.3'],
            ['overflow', 'hidden'],
            ['display', '-webkit-box'],
            ['-webkit-box-orient', 'vertical'],
            ['-webkit-line-clamp', String(this.look.titleLines)],
            // The cut where line-clamp is missing: that many lines of 1.3em.
            ['max-height', `${Math.round(this.look.titleLines * 13) / 10}em`],
            ['overflow-wrap', 'anywhere'],
        ]);
        text.append(heading);

        if (this.look.span && entry.span !== null) {
            const line = textSpan(`${this.prefix}-span`, entry.span);
            line.setAttribute('dir', 'auto');
            css(line, [
                ['font-size', '0.75rem'],
                ['color', MUTED],
                ['font-variant-numeric', 'tabular-nums'],
            ]);
            text.append(line);
        }

        return text;
    }

    /** A link beside the item, opening in a new tab without reaching back to this page. */
    private linkOf(
        link: { readonly href: string; readonly text: string },
        title: string,
    ): HTMLAnchorElement {
        const anchor = document.createElement('a');
        anchor.className = `${this.prefix}-link`;
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = link.text;
        anchor.setAttribute('aria-label', `${link.text}: ${title}`);
        css(anchor, [
            ['flex-shrink', '0'],
            ['font-size', '0.75rem'],
            ['color', PROGRESS],
            ['padding', '0 0.25rem'],
        ]);

        return anchor;
    }
}
