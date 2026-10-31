/**
 * The chapters inside a player: the chapters plugin, made once so the chapters outlive every rebuild;
 * the parts that name the chapter playing; the buttons to the previous and next chapter; and the list,
 * in the player or floating over the page (a popover or a drawer), with its button and, when asked,
 * a finger's swipe that opens it.
 */

import type { Chapter, ChapterInput } from '../core/chapters';
import { oneOf, unknownName, within } from '../core/checked';
import type { Part } from '../core/look';
import { unknownPalette, type Palette } from '../core/palettes';
import { readableColors } from '../dom/tooltip';
import { remPixels } from '../dom/units';
import { chapters, type ChaptersPlugin } from '../plugins/chapters';
import { FloatingList, type ListSettings } from './chapter-panel';
import { LongName } from './long-name';
import { iconButton, type PartHost } from './part-buttons';
import type { PlayerLayout } from './player-layout';
import type {
    PlayerChapterList,
    PlayerChapters,
    PlayerOptions,
} from './player-options';
import { dressBox, type OwnLook } from './player-paint';

/** What the chapters need from their player, besides what every part needs. */
export type ChapterHost = PartHost & {
    /** The player's root element: a floating list takes its colors and font from it. */
    readonly element: HTMLElement;
    /** Fires when the player is destroyed. */
    readonly signal: AbortSignal;
    /** The colors the player wears, as numbers for a shadow. */
    colors(): Palette;
    /** The player's main line, as built now. */
    layout(): PlayerLayout | null;
    /** Reports an error once the app's listeners can hear it. */
    later(error: Error): void;
    /** Reports an error of the player's own work (a font that fails to load). */
    readonly reportError: (error: unknown) => void;
    /** Hears that the chapter playing changed. */
    changed(chapter: Chapter | null, index: number): void;
};

/** The parts that show only when the player has chapters. */
export const CHAPTER_PARTS: readonly Part[] = [
    'chapter',
    'prevChapter',
    'nextChapter',
    'chapters',
];

/** Previous and next chapter (a bar and a triangle each), and the list of chapters. */
const CHAPTER_ICONS = {
    prevChapter: 'M6 6h2v12H6zm3.5 6L18 6v12z',
    nextChapter: 'M16 6h2v12h-2zM6 6l8.5 6L6 18z',
    chapters:
        'M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zM4 16h2v2H4zm4 0h12v2H8z',
} as const;

/** The swipes that open the list: along which axis, and which way (-1 up or left, 1 down or right). */
const SWIPES = {
    up: { axis: 'y', sign: -1 },
    down: { axis: 'y', sign: 1 },
    left: { axis: 'x', sign: -1 },
    right: { axis: 'x', sign: 1 },
} as const;

/** The shortest swipe that counts, in rem. */
const SWIPE_REM = 3;

let chapterLists = 0;

/** The list's options checked: unknown names fall back, sizes stay in range. */
function listSettings(list: true | PlayerChapterList): ListSettings {
    const own: PlayerChapterList = list === true ? {} : list;
    const type = oneOf(own.type, ['inline', 'popover', 'drawer'], 'inline');

    return {
        type,
        open: own.open === true,
        placement: oneOf(own.placement, ['auto', 'above', 'below'], 'auto'),
        side: oneOf(own.side, ['left', 'right'], 'right'),
        width: within(own.width, type === 'drawer' ? 20 : 18, 10, 40),
        maxHeight: within(own.maxHeight, 20, 6, 60),
        header:
            typeof own.header === 'boolean' ? own.header : type !== 'inline',
        stayOpen: own.stayOpen === true,
        backdrop: own.backdrop === true,
        animation: own.animation === true,
        animationType: oneOf(own.animationType, ['fade', 'slide'], 'fade'),
        swipe: own.swipe === true,
        swipeDirection: oneOf(
            own.swipeDirection,
            ['up', 'down', 'left', 'right'],
            'up',
        ),
    };
}

export class ChapterParts {
    /** The chapters plugin with the player's words and list, or null while chapters are off. */
    readonly plugin: ChaptersPlugin | null;
    /** The list of chapters, or null without one. */
    private box: HTMLElement | null = null;
    private list: ListSettings | null = null;
    /** The list's own palette, font and box, as the app gave them (an unknown palette dropped). */
    private listOwn: OwnLook = {};
    /** The list floating over the page (a popover or a drawer), or null for the list in the player. */
    private readonly floating: FloatingList | null;
    private open = false;
    /** The list's button pressed last: a floating list points at it. */
    private pressed: HTMLButtonElement | null = null;
    /** Where a finger came down off the wave, for the swipe that opens the list. */
    private swipeStart: { id: number; x: number; y: number } | null = null;
    /** The built parts that show the chapter playing, and the buttons that open the list. */
    private names: LongName[] = [];
    private buttons: HTMLButtonElement[] = [];

    constructor(
        asked: PlayerOptions['chapters'],
        private readonly host: ChapterHost,
    ) {
        this.plugin = this.makePlugin(asked);
        this.floating = this.makeFloating();
        this.listenSwipe();
    }

    /** Whether the options allow a chapter part: the list's button only with the list, the rest with chapters. */
    allows(part: Part): boolean {
        return part === 'chapters' ? this.box !== null : this.plugin !== null;
    }

    /** Whether the list floats over the page, so it opens only from its button. */
    get floats(): boolean {
        return this.floating !== null;
    }

    /** Whether the list sits in the player. */
    get listInPlayer(): boolean {
        return this.box !== null && this.floating === null;
    }

    /** Puts the list in the player, in `target`, dressed in its own look. */
    placeList(target: HTMLElement): void {
        if (this.box !== null && this.floating === null) {
            target.append(this.box);
            this.dressList(this.box);
        }
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
    stepButton(part: 'prevChapter' | 'nextChapter'): HTMLButtonElement {
        const labels = this.host.words.labels;
        const button = iconButton(
            this.host.look(),
            part === 'prevChapter'
                ? 'sonicframe-prev-chapter'
                : 'sonicframe-next-chapter',
            CHAPTER_ICONS[part],
            labels[part === 'prevChapter' ? 'previousChapter' : 'nextChapter'],
        );

        button.addEventListener('click', () => {
            const plugin = this.plugin;
            const moved =
                part === 'prevChapter' ? plugin?.previous() : plugin?.next();

            if (moved === false) {
                this.host.frame()?.announce(labels.noChapter);
            }
        });

        return button;
    }

    /** The button that opens and closes the list of chapters, in the player or over the page. */
    listButton(): HTMLButtonElement {
        const button = iconButton(
            this.host.look(),
            'sonicframe-chapters-toggle',
            CHAPTER_ICONS.chapters,
            this.host.words.labels.chapters,
        );

        if (this.box !== null) {
            button.setAttribute('aria-controls', this.box.id);
        }

        button.addEventListener('click', () => {
            this.pressed = button;
            this.setOpen(!this.open);
        });
        this.buttons.push(button);

        return button;
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

    /**
     * Shows the list when it is open: over the page against its button when it floats; in the player,
     * also always when no button can open it.
     */
    showList(): void {
        const list = this.box;

        if (list === null) {
            return;
        }

        const floating = this.floating;
        const anchor = this.anchor();
        const shown =
            floating === null
                ? this.buttons.length === 0 || this.open
                : this.open && anchor !== null;

        if (floating === null) {
            list.hidden = !shown;
        } else if (shown && anchor !== null) {
            floating.open(anchor);
        } else {
            floating.close();
        }

        for (const button of this.buttons) {
            button.setAttribute('aria-expanded', String(shown));
        }
    }

    /**
     * The parts off the wave, where a swipe starts: the line's other parts and the rows under the
     * wave. Each lets the page pan only across the swipe.
     */
    swipeZones(layout: PlayerLayout): void {
        const list = this.list;

        if (list === null || !list.swipe) {
            return;
        }

        const column = layout.column;
        const zones = [
            ...[...layout.line.children].filter((part) => part !== column),
            ...[...column.children].filter((row) => row !== layout.box),
        ] as HTMLElement[];
        const pan =
            SWIPES[list.swipeDirection].axis === 'x' ? 'pan-y' : 'pan-x';

        for (const zone of zones) {
            zone.style.setProperty('touch-action', pan);
        }
    }

    /** Forgets the parts built, when the player builds again; their names stop walking. */
    clearParts(): void {
        for (const name of this.names) {
            name.destroy();
        }

        this.names = [];
        this.buttons = [];
    }

    /** Takes a floating list off the page, when the player is destroyed. */
    destroy(): void {
        this.floating?.destroy();
    }

    /** The chapters plugin, and the list's box when the app asks for a list. */
    private makePlugin(
        asked: PlayerOptions['chapters'],
    ): ChaptersPlugin | null {
        if (!asked) {
            return null;
        }

        const settings: PlayerChapters =
            typeof asked === 'string'
                ? { src: asked }
                : Array.isArray(asked)
                  ? { items: asked as readonly ChapterInput[] }
                  : (asked as PlayerChapters);
        const { list, ...own } = settings;
        const labels = this.host.words.labels;

        // The list's box; a floating one holds an inner part that scrolls, so its arrow can poke out.
        let content: HTMLElement | null = null;

        if (list === true || (typeof list === 'object' && list !== null)) {
            const box = document.createElement('div');
            box.className = 'sonicframe-chapter-list';
            box.id = `sonicframe-chapter-list-${++chapterLists}`;
            this.box = box;
            this.list = listSettings(list);
            this.listOwn = this.checkedLook(list === true ? {} : list);
            this.open = this.list.open;
            content = box;

            if (this.list.type !== 'inline') {
                content = document.createElement('div');
                content.className = 'sonicframe-chapter-scroll';
                box.append(content);
            }
        }

        return chapters({
            ...own,
            list: content,
            header: this.list?.header === true,
            listLook: typeof list === 'object' ? list.look : undefined,
            words: {
                chapter: labels.chapter,
                list: labels.chapters,
                none: labels.noChapter,
                link: labels.chapterLink,
            },
            onChange: (chapter, index) => {
                this.showChapter();
                this.host.changed(chapter, index);
            },
            onChapters: () => this.showChapter(),
        });
    }

    /**
     * The list floating over the page (a popover or a drawer), made once for the player's life; null
     * for the list in the player, or without a list.
     */
    private makeFloating(): FloatingList | null {
        const box = this.box;
        const list = this.list;

        if (box === null || list === null || list.type === 'inline') {
            return null;
        }

        return new FloatingList(
            box,
            box.querySelector<HTMLElement>('.sonicframe-chapter-scroll') ?? box,
            list,
            this.host.element,
            (element) => this.dressList(element),
            this.host.words.labels.closeChapters,
            (focusBack) => {
                this.open = false;
                this.showList();

                if (focusBack) {
                    this.anchor()?.focus({ preventScroll: true });
                }
            },
        );
    }

    /**
     * With `swipe`, a finger swiping off the wave opens the list one way and closes it the other.
     * The parts off the wave let the page pan only across the swipe (see `swipeZones`), so the swipe
     * reaches the player, and the wave keeps its own way of moving.
     */
    private listenSwipe(): void {
        const list = this.list;

        if (list === null || !list.swipe) {
            return;
        }

        const { element, signal } = this.host;
        const onWave = (target: EventTarget | null): boolean =>
            target instanceof Node &&
            (this.host.layout()?.box.contains(target) ?? false);

        element.addEventListener(
            'pointerdown',
            (event) => {
                this.swipeStart =
                    event.pointerType === 'touch' && !onWave(event.target)
                        ? {
                              id: event.pointerId,
                              x: event.clientX,
                              y: event.clientY,
                          }
                        : null;
            },
            { signal },
        );
        element.addEventListener(
            'pointercancel',
            () => {
                this.swipeStart = null;
            },
            { signal },
        );
        element.addEventListener(
            'pointerup',
            (event) => {
                const start = this.swipeStart;
                this.swipeStart = null;

                if (start === null || start.id !== event.pointerId) {
                    return;
                }

                const along = SWIPES[list.swipeDirection];
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                const main = along.axis === 'x' ? dx : dy;
                const across = along.axis === 'x' ? dy : dx;

                if (
                    Math.abs(main) < remPixels(SWIPE_REM) ||
                    Math.abs(main) <= Math.abs(across)
                ) {
                    return;
                }

                this.setOpen(Math.sign(main) === along.sign);
            },
            { signal },
        );
    }

    /** The list's own look with an unknown palette name reported once and dropped. */
    private checkedLook(list: PlayerChapterList): OwnLook {
        const { palette, font, style } = list;

        if (unknownPalette(palette)) {
            this.host.later(unknownName('palette', palette));

            return { font, style };
        }

        return { palette, font, style };
    }

    /** Lays the list's own look over the player's (see `dressBox`). */
    private dressList(box: HTMLElement): void {
        dressBox(
            box,
            this.listOwn,
            this.host.look().font,
            this.host.colors(),
            this.host.reportError,
        );
    }

    /** The list's button that opened it last, or the first one. */
    private anchor(): HTMLButtonElement | null {
        return this.pressed !== null && this.buttons.includes(this.pressed)
            ? this.pressed
            : (this.buttons[0] ?? null);
    }

    /** Opens or closes the list, from its button or a swipe. */
    private setOpen(open: boolean): void {
        if (this.box !== null && open !== this.open) {
            this.open = open;
            this.showList();
        }
    }
}
