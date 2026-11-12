/**
 * The chapters list on the page: the media list (`MediaListView`) with one item per chapter, its
 * picture when asked (with the chapter's length on it), its title and its stretch ("0:25 – 0:50")
 * under it, and its link when asked. Every class name starts with `sonicframe-chapter`.
 */

import type { Chapter } from '../../core/chapters/chapters';
import { formatTime } from '../../core/shared/timing';
import type { ChapterListLook } from '../../dom/list/list-look';
import { MediaListView, type MediaListItem } from '../../dom/list/media-list';

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
    private readonly view: MediaListView;

    constructor(
        target: HTMLElement,
        private readonly options: ChapterListOptions,
        onChoose: (index: number) => void,
    ) {
        this.view = new MediaListView(
            target,
            {
                prefix: 'sonicframe-chapter',
                name: options.name,
                header: options.header,
                look: options.look,
            },
            onChoose,
        );
    }

    /** Builds the list again: the chapters, where each one ends (null while unknown) and their names. */
    render(
        chapters: readonly Chapter[],
        ends: readonly (number | null)[],
        title: (index: number) => string,
    ): void {
        this.view.render(
            chapters.map((chapter, at): MediaListItem => {
                const end = ends[at] ?? null;

                return {
                    title: title(at),
                    span:
                        end === null
                            ? formatTime(chapter.start)
                            : `${formatTime(chapter.start)} – ${formatTime(end)}`,
                    image: this.options.images ? chapter.image : null,
                    length:
                        end === null ? null : formatTime(end - chapter.start),
                    link:
                        this.options.links && chapter.url !== null
                            ? { href: chapter.url, text: this.options.link }
                            : null,
                };
            }),
        );
    }

    /**
     * Marks the chapter playing (-1 for none): `aria-current`, its tint and playing mark, the head's
     * place; `played` (0 to 1, or null) fills its bar.
     */
    mark(index: number, played: number | null): void {
        this.view.mark(index, played);
    }

    /** Takes the list off the page. */
    destroy(): void {
        this.view.destroy();
    }
}
