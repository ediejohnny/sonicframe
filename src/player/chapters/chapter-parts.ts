/**
 * The chapters inside a player: the chapters plugin, made once so the chapters outlive every rebuild;
 * the parts that name the chapter playing; the buttons to the previous and next chapter; and the list
 * (`ChapterListPart`), in the player or floating over the page.
 */

import type { Chapter, ChapterInput } from '../../core/chapters/chapters';
import type { Part } from '../../core/player/look';
import { readableColors } from '../../dom/shared/tooltip';
import { chapters } from '../../plugins/chapters/chapters';
import type { ChaptersPlugin } from '../../plugins/chapters/chapters-options';
import { iconButton } from '../parts/part-buttons';
import type { PlayerLayout } from '../player/player-layout';
import type { PlayerChapters, PlayerOptions } from '../player/player-options';
import { ChapterListPart, type ListHost } from './chapter-list-part';
import { LongName } from './long-name';

/** What the chapters need from their player, besides what the list needs. */
export type ChapterHost = ListHost & {
    /** Hears that the chapter playing changed. */
    changed(chapter: Chapter | null, index: number): void;
    /** Hears the chapters shown, whenever they change. */
    listed(chapters: readonly Chapter[]): void;
};

/** The parts that show only when the player has chapters. */
export const CHAPTER_PARTS: readonly Part[] = [
    'chapter',
    'previousChapter',
    'nextChapter',
    'chapters',
];

/** Previous and next chapter: a bar and a triangle each. */
const CHAPTER_ICONS = {
    previousChapter: 'M6 6h2v12H6zm3.5 6L18 6v12z',
    nextChapter: 'M16 6h2v12h-2zM6 6l8.5 6L6 18z',
} as const;

/** The player's `chapters` option as the plugin's options, or null while chapters are off. */
function chaptersOf(asked: PlayerOptions['chapters']): PlayerChapters | null {
    if (!asked) {
        return null;
    }

    return typeof asked === 'string'
        ? { src: asked }
        : Array.isArray(asked)
          ? { items: asked as readonly ChapterInput[] }
          : (asked as PlayerChapters);
}

export class ChapterParts {
    /** The chapters plugin with the player's words and list, or null while chapters are off. */
    readonly plugin: ChaptersPlugin | null;
    /** The list of chapters, or null without one. */
    private readonly list: ChapterListPart | null;
    /** The built parts that show the chapter playing. */
    private names: LongName[] = [];

    constructor(
        asked: PlayerOptions['chapters'],
        private readonly host: ChapterHost,
    ) {
        const settings = chaptersOf(asked);
        const list = settings?.list;

        this.list =
            list === true || (typeof list === 'object' && list !== null)
                ? new ChapterListPart(list, host)
                : null;
        this.plugin = settings === null ? null : this.makePlugin(settings);
    }

    /** Whether the options allow a chapter part: the list's button only with the list, the rest with chapters. */
    allows(part: Part): boolean {
        return part === 'chapters' ? this.list !== null : this.plugin !== null;
    }

    /** Whether the list floats over the page, so it opens only from its button. */
    get floats(): boolean {
        return this.list?.floats ?? false;
    }

    /** Whether the list sits in the player. */
    get listInPlayer(): boolean {
        return this.list !== null && !this.list.floats;
    }

    /** Puts the list in the player, in `target`, dressed in its own look. */
    placeList(target: HTMLElement): void {
        this.list?.place(target);
    }

    /** The chapter playing, by name, in a room that may be too short for it (see `LongName`). */
    namePart(): HTMLElement {
        const name = new LongName(this.host.look(), () =>
            readableColors(this.host.frame()),
        );
        this.names.push(name);

        return name.element;
    }

    /** A button to the previous chapter (like a previous track) or the next one; says when there is none. */
    stepButton(part: 'previousChapter' | 'nextChapter'): HTMLButtonElement {
        const labels = this.host.words.labels;
        const button = iconButton(
            this.host.look(),
            // The previous chapter's button keeps its old class beside the new one until 2.0.
            part === 'previousChapter'
                ? 'sonicframe-previous-chapter sonicframe-prev-chapter'
                : 'sonicframe-next-chapter',
            CHAPTER_ICONS[part],
            labels[part],
        );

        button.addEventListener('click', () => {
            const plugin = this.plugin;
            const moved =
                part === 'previousChapter'
                    ? plugin?.previous()
                    : plugin?.next();

            if (moved === false) {
                this.host.frame()?.announce(labels.noChapter);
            }
        });

        return button;
    }

    /** The button that opens and closes the list, or null without a list. */
    listButton(): HTMLButtonElement | null {
        return this.list?.button() ?? null;
    }

    /** Shows the chapter playing in the parts that name it: its title, or its place when untitled. */
    showChapter(): void {
        const plugin = this.plugin;
        const chapter = plugin?.current ?? null;
        const text =
            plugin === null || chapter === null
                ? ''
                : chapter.title ||
                  this.host.words.say('chapter', {
                      index: String(plugin.index + 1),
                      count: String(plugin.chapters.length),
                  });

        for (const name of this.names) {
            name.text = text;
        }

        this.fitNames();
    }

    /** Fits each chapter's name to its room: its end, its walk (see `LongName`). */
    fitNames(): void {
        for (const name of this.names) {
            name.fit();
        }
    }

    /** Shows the list when it is open (see `ChapterListPart.show`). */
    showList(): void {
        this.list?.show();
    }

    /** Lets the parts off the wave start the list's swipe, when the list asks for one. */
    swipeZones(layout: PlayerLayout): void {
        this.list?.swipeZones(layout);
    }

    /** Forgets the parts built, when the player builds again; their names stop walking. */
    clearParts(): void {
        for (const name of this.names) {
            name.destroy();
        }

        this.names = [];
        this.list?.clearButtons();
    }

    /** Takes a floating list off the page, when the player is destroyed. */
    destroy(): void {
        this.list?.destroy();
    }

    /** The chapters plugin, filling the list when there is one. */
    private makePlugin(settings: PlayerChapters): ChaptersPlugin {
        const { list, ...own } = settings;
        const labels = this.host.words.labels;

        return chapters({
            ...own,
            list: this.list?.content ?? null,
            header: this.list?.settings.header === true,
            listLook: typeof list === 'object' ? list.look : undefined,
            a11y: {
                ...own.a11y,
                words: {
                    chapter: labels.chapter,
                    list: labels.chapters,
                    none: labels.noChapter,
                    link: labels.chapterLink,
                },
            },
            onChange: (chapter, index) => {
                this.showChapter();
                this.host.changed(chapter, index);
            },
            onChapters: (list) => {
                this.showChapter();
                this.host.listed(list);
            },
        });
    }
}
