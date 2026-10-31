/**
 * The player's list of chapters: in the player, or floating over the page (a popover or a drawer,
 * see `FloatingList`), in its own look over the player's, opened and closed by its buttons and,
 * when asked, by a finger's swipe (`ChapterSwipe`).
 */

import { unknownPalette, type Palette } from '../core/player/palettes';
import { oneOf, unknownName, within } from '../core/shared/checked';
import { FloatingList, type ListSettings } from './chapter-panel';
import { ChapterSwipe } from './chapter-swipe';
import { iconButton, type PartHost } from './part-buttons';
import type { PlayerLayout } from './player-layout';
import type { PlayerChapterList } from './player-options';
import { dressBox, type OwnLook } from './player-paint';

/** What the list needs from its player, besides what every part needs. */
export type ListHost = PartHost & {
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
};

/** The list of chapters, as an icon. */
const LIST_ICON =
    'M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zM4 16h2v2H4zm4 0h12v2H8z';

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

export class ChapterListPart {
    /** The list's box. */
    readonly box: HTMLElement;
    /** The part of the box the chapters plugin fills: the box itself, or a floating list's inner part that scrolls. */
    readonly content: HTMLElement;
    readonly settings: ListSettings;
    /** The list's own palette, font and box, as the app gave them (an unknown palette dropped). */
    private readonly own: OwnLook;
    /** The list floating over the page (a popover or a drawer), or null for the list in the player. */
    private readonly floating: FloatingList | null;
    /** The swipe that opens the list, or null unless the list asks for it. */
    private readonly swipe: ChapterSwipe | null;
    private open: boolean;
    /** The list's button pressed last: a floating list points at it. */
    private pressed: HTMLButtonElement | null = null;
    /** The buttons built that open the list. */
    private buttons: HTMLButtonElement[] = [];

    constructor(
        list: true | PlayerChapterList,
        private readonly host: ListHost,
    ) {
        const box = document.createElement('div');
        box.className = 'sonicframe-chapter-list';
        box.id = `sonicframe-chapter-list-${++chapterLists}`;
        this.box = box;
        this.settings = listSettings(list);
        this.own = this.checkedLook(list === true ? {} : list);
        this.open = this.settings.open;

        // A floating list holds an inner part that scrolls, so its arrow can poke out.
        let content = box;

        if (this.settings.type !== 'inline') {
            content = document.createElement('div');
            content.className = 'sonicframe-chapter-scroll';
            box.append(content);
        }

        this.content = content;
        this.floating =
            this.settings.type === 'inline'
                ? null
                : new FloatingList(
                      box,
                      content,
                      this.settings,
                      host.element,
                      (element) => this.dress(element),
                      host.words.labels.closeChapters,
                      (focusBack) => {
                          this.open = false;
                          this.show();

                          if (focusBack) {
                              this.anchor()?.focus({ preventScroll: true });
                          }
                      },
                  );

        this.swipe = this.settings.swipe
            ? new ChapterSwipe(this.settings.swipeDirection, {
                  element: host.element,
                  signal: host.signal,
                  layout: () => host.layout(),
                  setOpen: (open) => this.setOpen(open),
              })
            : null;
    }

    /** Whether the list floats over the page, so it opens only from its button. */
    get floats(): boolean {
        return this.floating !== null;
    }

    /** Puts the list in the player, in `target`, dressed in its own look; a floating list stays put. */
    place(target: HTMLElement): void {
        if (this.floating === null) {
            target.append(this.box);
            this.dress(this.box);
        }
    }

    /** A button that opens and closes the list, in the player or over the page. */
    button(): HTMLButtonElement {
        const button = iconButton(
            this.host.look(),
            'sonicframe-chapters-toggle',
            LIST_ICON,
            this.host.words.labels.chapters,
        );
        button.setAttribute('aria-controls', this.box.id);
        button.addEventListener('click', () => {
            this.pressed = button;
            this.setOpen(!this.open);
        });
        this.buttons.push(button);

        return button;
    }

    /**
     * Shows the list when it is open: over the page against its button when it floats; in the player,
     * also always when no button can open it.
     */
    show(): void {
        const floating = this.floating;
        const anchor = this.anchor();
        const shown =
            floating === null
                ? this.buttons.length === 0 || this.open
                : this.open && anchor !== null;

        if (floating === null) {
            this.box.hidden = !shown;
        } else if (shown && anchor !== null) {
            floating.open(anchor);
        } else {
            floating.close();
        }

        for (const button of this.buttons) {
            button.setAttribute('aria-expanded', String(shown));
        }
    }

    /** Lets the parts off the wave start the swipe (see `ChapterSwipe`), when the list asks for one. */
    swipeZones(layout: PlayerLayout): void {
        this.swipe?.zones(layout);
    }

    /** Forgets the buttons built, when the player builds again. */
    clearButtons(): void {
        this.buttons = [];
    }

    /** Takes a floating list off the page, when the player is destroyed. */
    destroy(): void {
        this.floating?.destroy();
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
    private dress(box: HTMLElement): void {
        dressBox(
            box,
            this.own,
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
        if (open !== this.open) {
            this.open = open;
            this.show();
        }
    }
}
