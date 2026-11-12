/**
 * The playlist's list of tracks and the buttons over it. The list is the media list (`MediaListView`,
 * the same one the player's chapters use), in the playlist or floating over the page as a popover or
 * a drawer (`FloatingList`), opened by its button. The arrows, Home and End move the focus from track
 * to track, which keeps one stop in the tab order; shuffle and repeat say their state.
 */

import type { PlaylistWords } from '../../core/languages/words';
import { DEFAULT_LOOK } from '../../core/player/look';
import { DEFAULT_PALETTE, unknownPalette } from '../../core/player/palettes';
import type { Repeat } from '../../core/playlist/order';
import { unknownName } from '../../core/shared/checked';
import { PROGRESS } from '../../core/shared/variables';
import { MediaListView, type MediaListItem } from '../../dom/list/media-list';
import { css } from '../../dom/shared/css';
import { FloatingList } from '../../player/chapters/chapter-panel';
import {
    LIST_ICON,
    listSettings,
} from '../../player/chapters/chapter-list-part';
import { iconButton } from '../../player/parts/part-buttons';
import { dressBox, type OwnLook } from '../../player/player/player-paint';
import type {
    PlaylistButton,
    PlaylistList,
} from '../playlist/playlist-options';

/** What the list needs from its playlist. */
export type TrackListHost = {
    readonly words: PlaylistWords;
    /** The playlist's root: a floating list takes its colors and font from it. */
    readonly element: HTMLElement;
    /** A track was chosen in the list. */
    choose(index: number): void;
    shuffle(): boolean;
    setShuffle(on: boolean): void;
    repeat(): Repeat;
    setRepeat(repeat: Repeat): void;
    /** Reports an error of the list's own work (a font or a palette it cannot use). */
    reportError(error: unknown): void;
};

const SHUFFLE_ICON =
    'M4 7h3.5l7 10H20v-2l3 3-3 3v-2h-6.5l-7-10H4zm10.5 0H20V5l3 3-3 3V9h-4.5l-1.6 2.3-1.2-1.7zM4 15h2.5l1.6-2.3 1.2 1.7L7.5 17H4z';
const REPEAT_ICON =
    'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z';

/** The next repeat, as the repeat button steps through them. */
const NEXT_REPEAT: Readonly<Record<Repeat, Repeat>> = {
    none: 'all',
    all: 'one',
    one: 'none',
};

let trackLists = 0;

export class TrackList {
    /** The bar of buttons and, unless it floats, the list. */
    readonly element: HTMLElement;
    private readonly box: HTMLElement;
    private readonly view: MediaListView;
    private readonly floating: FloatingList | null;
    private readonly own: OwnLook;
    private readonly toggle: HTMLButtonElement | null = null;
    private readonly shuffleButton: HTMLButtonElement | null = null;
    private readonly repeatButton: HTMLButtonElement | null = null;
    private current = -1;

    constructor(
        list: true | PlaylistList,
        buttons: readonly PlaylistButton[],
        private readonly host: TrackListHost,
    ) {
        const own = list === true ? {} : list;
        const settings = listSettings(own);
        const { words } = host;
        this.own = { palette: own.palette, font: own.font, style: own.box };

        if (unknownPalette(own.palette)) {
            host.reportError(unknownName('palette', own.palette));
            this.own = { font: own.font, style: own.box };
        }

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-playlist-tracks';
        const bar = document.createElement('div');
        bar.className = 'sonicframe-playlist-bar';
        css(bar, [
            ['display', 'flex'],
            ['justify-content', 'flex-end'],
            ['gap', '0.25rem'],
        ]);

        this.box = document.createElement('div');
        this.box.className = 'sonicframe-track-list';
        this.box.id = `sonicframe-track-list-${++trackLists}`;
        let content = this.box;

        if (settings.type === 'inline') {
            this.floating = null;
        } else {
            content = document.createElement('div');
            content.className = 'sonicframe-track-scroll';
            this.box.append(content);
            this.floating = new FloatingList(
                this.box,
                content,
                settings,
                host.element,
                (box) => this.dress(box),
                words.close,
                (focusBack) => this.close(focusBack),
            );
            const toggle = this.button('toggle', LIST_ICON, words.playlist);
            toggle.setAttribute('aria-controls', this.box.id);
            toggle.setAttribute('aria-expanded', 'false');
            toggle.addEventListener('click', () => {
                if (this.floating?.isOpen === true) {
                    this.close(false);
                } else {
                    this.floating?.open(toggle);
                    toggle.setAttribute('aria-expanded', 'true');
                }
            });
            bar.append(toggle);
            this.toggle = toggle;
        }

        if (buttons.includes('shuffle')) {
            const button = this.button('shuffle', SHUFFLE_ICON, words.shuffle);
            button.addEventListener('click', () =>
                host.setShuffle(!host.shuffle()),
            );
            bar.append(button);
            this.shuffleButton = button;
        }

        if (buttons.includes('repeat')) {
            const button = this.button('repeat', REPEAT_ICON, '');
            button.addEventListener('click', () =>
                host.setRepeat(NEXT_REPEAT[host.repeat()]),
            );
            bar.append(button);
            this.repeatButton = button;
        }

        this.view = new MediaListView(
            content,
            {
                prefix: 'sonicframe-track',
                name: words.playlist,
                header: settings.header,
                look: own.look,
            },
            (index) => host.choose(index),
        );
        content.addEventListener('keydown', this.rove);

        if (bar.childElementCount > 0) {
            this.element.append(bar);
        }

        if (this.floating === null) {
            this.element.append(this.box);
            this.dress(this.box);
        }

        this.update();
    }

    /** Shows `items` as the list, the current track still marked. */
    render(items: readonly MediaListItem[]): void {
        this.view.render(items);
        this.stop(this.current);
    }

    /** Marks the track playing (-1 for none); `played` (0 to 1, or null) fills its bar. */
    mark(index: number, played: number | null): void {
        this.view.mark(index, played);

        if (index !== this.current) {
            this.current = index;
            this.stop(index);
        }
    }

    /** Shows the state of shuffle and repeat. */
    update(): void {
        const { words } = this.host;
        const repeat = this.host.repeat();
        this.pressed(this.shuffleButton, this.host.shuffle());

        if (this.repeatButton !== null) {
            const label =
                repeat === 'all'
                    ? words.repeatAll
                    : repeat === 'one'
                      ? words.repeatOne
                      : words.repeatNone;
            this.repeatButton.setAttribute('aria-label', label);
            this.repeatButton.title = label;
            this.pressed(this.repeatButton, repeat !== 'none');
            this.repeatButton.querySelector('.sonicframe-repeat-one')?.remove();

            if (repeat === 'one') {
                const one = document.createElement('span');
                one.className = 'sonicframe-repeat-one';
                one.textContent = '1';
                one.setAttribute('aria-hidden', 'true');
                css(one, [
                    ['position', 'absolute'],
                    ['font-size', '0.5rem'],
                    ['font-weight', '700'],
                ]);
                this.repeatButton.append(one);
            }
        }
    }

    /** Takes the list and a floating one off the page. */
    destroy(): void {
        this.floating?.destroy();
        this.view.destroy();
        this.element.remove();
    }

    /** A round button of the bar. */
    private button(
        name: string,
        icon: string,
        label: string,
    ): HTMLButtonElement {
        const button = iconButton(
            DEFAULT_LOOK,
            `sonicframe-playlist-${name}`,
            icon,
            label,
        );
        css(button, [['position', 'relative']]);

        return button;
    }

    /** A button's on or off, in `aria-pressed` and in the played color. */
    private pressed(button: HTMLButtonElement | null, on: boolean): void {
        button?.setAttribute('aria-pressed', String(on));
        button?.style.setProperty('color', on ? PROGRESS : 'inherit');
    }

    /** Closes a floating list; the focus goes back to its button when asked. */
    private close(focusBack: boolean): void {
        this.floating?.close();
        this.toggle?.setAttribute('aria-expanded', 'false');

        if (focusBack) {
            this.toggle?.focus({ preventScroll: true });
        }
    }

    /** Lays the list's own look over the playlist's colors. */
    private dress(box: HTMLElement): void {
        dressBox(box, this.own, 'system', DEFAULT_PALETTE, (error) =>
            this.host.reportError(error),
        );
    }

    /** Leaves the track at `index` (the first one when none) as the list's one stop in the tab order. */
    private stop(index: number): void {
        const items = this.view.items;
        const kept = index >= 0 && index < items.length ? index : 0;
        items.forEach((item, at) => {
            item.tabIndex = at === kept ? 0 : -1;
        });
    }

    /** The arrows, Home and End move the focus through the list. */
    private readonly rove = (event: KeyboardEvent): void => {
        const items = this.view.items;
        const from = items.indexOf(event.target as HTMLButtonElement);

        if (from < 0) {
            return;
        }

        const to =
            event.key === 'ArrowDown'
                ? Math.min(items.length - 1, from + 1)
                : event.key === 'ArrowUp'
                  ? Math.max(0, from - 1)
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : null;

        if (to === null) {
            return;
        }

        event.preventDefault();
        this.stop(to);
        items[to].focus();
    };
}
