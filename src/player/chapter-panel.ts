/**
 * The chapters list floating over the page: a popover under (or over) the button that opened it,
 * kept inside the window with an arrow pointing at that button, or a drawer along the left or right
 * side of the page, with a close button and, when asked, the page dimmed behind it. It lives on the
 * page's body, so no player box clips it, and wears the player's colors and font, copied into it as
 * it opens. Escape, a press outside, the focus leaving and, unless it stays open, a chapter chosen
 * close it; the focus goes to the chapter playing as it opens.
 */

import { arrowOffset, placeTooltip } from '../core/place';
import { prefersReducedMotion } from '../dom/motion';

/** The player's chapters list settings, already checked. */
export type ListSettings = {
    type: 'inline' | 'popover' | 'drawer';
    open: boolean;
    placement: 'auto' | 'above' | 'below';
    side: 'left' | 'right';
    /** In rem. */
    width: number;
    /** In rem. */
    maxHeight: number;
    header: boolean;
    stayOpen: boolean;
    backdrop: boolean;
    animation: boolean;
    animationType: 'fade' | 'slide';
    swipe: boolean;
    swipeDirection: 'up' | 'down' | 'left' | 'right';
};

/** The player's colors and text, copied from the player into the floating list. */
const CARRIED = [
    '--sonicframe-surface',
    '--sonicframe-text',
    '--sonicframe-muted',
    '--sonicframe-border',
    '--sonicframe-progress',
];

const SVG = 'http://www.w3.org/2000/svg';

/** The arrow's side, in CSS pixels, and how far it keeps from the list's ends. */
const ARROW = 12;
const ARROW_INSET = 16;

/** Space between the button and the popover, and between the popover and the window's edges, in CSS pixels. */
const GAP = 10;
const MARGIN = 8;

/** How long the list takes to come in, when it moves, in milliseconds. */
const ENTER_MS = 180;

/** Over every page element; just under the shared tooltip. */
const LAYER = '2147483645';

function css(
    element: HTMLElement | SVGElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}

export class FloatingList {
    private readonly arrow: HTMLElement | null = null;
    private readonly backdrop: HTMLElement | null = null;
    /** The drawer's close button; a popover has none. */
    private readonly closer: HTMLButtonElement | null = null;
    private anchor: HTMLElement | null = null;
    private stops: (() => void)[] = [];

    /**
     * `box` is the list and `content` the part of it the chapters plugin fills, which scrolls;
     * `source` is the player it takes its colors from, and `dress` lays the list's own look over
     * them; `onClose(focusBack)` is called when something closes it, so the player updates its
     * button.
     */
    constructor(
        private readonly box: HTMLElement,
        private readonly content: HTMLElement,
        private readonly settings: ListSettings,
        private readonly source: HTMLElement,
        private readonly dress: (box: HTMLElement) => void,
        closeLabel: string,
        private readonly onClose: (focusBack: boolean) => void,
    ) {
        const drawer = settings.type === 'drawer';
        this.show(false);
        css(content, [
            ['overflow-y', 'auto'],
            ['scrollbar-width', 'thin'],
            [
                'scrollbar-color',
                'var(--sonicframe-muted, currentColor) transparent',
            ],
        ]);
        css(box, [
            ['position', 'fixed'],
            ['z-index', LAYER],
            ['box-sizing', 'border-box'],
            ['padding', drawer ? '1rem' : '0.5rem 0.75rem'],
            ['background-color', 'var(--sonicframe-surface, Canvas)'],
            ['color', 'var(--sonicframe-text, CanvasText)'],
            ['border-style', 'solid'],
            ['border-width', '1px'],
            ['border-color', 'var(--sonicframe-border, currentColor)'],
            ['border-radius', drawer ? '0' : '0.375rem'],
            [
                'box-shadow',
                '0 0.25rem 1rem rgba(0, 0, 0, 0.18), 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.12)',
            ],
        ]);

        if (drawer) {
            css(box, [
                ['top', '0'],
                ['bottom', '0'],
                [settings.side, '0'],
                ['width', `${settings.width}rem`],
                ['max-width', '85vw'],
                ['flex-direction', 'column'],
            ]);
            css(content, [['flex', '1 1 auto']]);
            this.closer = this.closeButton(closeLabel);
            box.prepend(this.closer);

            if (settings.backdrop) {
                const backdrop = document.createElement('div');
                backdrop.className = 'sonicframe-chapter-backdrop';
                backdrop.hidden = true;
                css(backdrop, [
                    ['position', 'fixed'],
                    ['inset', '0'],
                    ['z-index', LAYER],
                    ['background-color', 'rgba(0, 0, 0, 0.4)'],
                ]);
                document.body.append(backdrop);
                this.backdrop = backdrop;
            }
        } else {
            css(box, [
                ['width', `${settings.width}rem`],
                ['max-width', 'calc(100vw - 1rem)'],
                // The arrow pokes out of the list's edge; the inner part scrolls instead.
                ['overflow', 'visible'],
            ]);
            css(content, [['max-height', `${settings.maxHeight}rem`]]);
            const arrow = document.createElement('div');
            arrow.className = 'sonicframe-chapter-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            css(arrow, [
                ['position', 'absolute'],
                ['width', `${ARROW}px`],
                ['height', `${ARROW}px`],
                ['background-color', 'var(--sonicframe-surface, Canvas)'],
                ['border-style', 'solid'],
                ['border-color', 'var(--sonicframe-border, currentColor)'],
                ['transform', 'rotate(45deg)'],
            ]);
            box.prepend(arrow);
            this.arrow = arrow;
        }

        document.body.append(box);
    }

    get isOpen(): boolean {
        return !this.box.hidden;
    }

    /** Shows the list against `anchor` (the button that opened it) and takes the focus into it. */
    open(anchor: HTMLElement): void {
        // Opened again (the player rebuilt, say): one set of listeners, against the new button.
        this.close();
        this.anchor = anchor;
        this.carry();
        this.dress(this.box);
        this.show(true);

        if (this.backdrop !== null) {
            this.backdrop.hidden = false;
        }

        this.place();
        this.placeCloser();
        this.listen();
        this.enter();
        const chosen =
            this.box.querySelector<HTMLElement>('[aria-current="true"]') ??
            this.box.querySelector<HTMLElement>('nav button');
        chosen?.focus({ preventScroll: true });
    }

    /** Hides the list; nothing else (the player says whether the focus goes back). */
    close(): void {
        this.show(false);

        if (this.backdrop !== null) {
            this.backdrop.hidden = true;
        }

        for (const stop of this.stops.splice(0)) {
            stop();
        }
    }

    /**
     * Shows or hides the list by its `display` as well as `hidden`: a display set on the element (the
     * drawer's column) would win over `hidden` alone.
     */
    private show(visible: boolean): void {
        this.box.hidden = !visible;
        this.box.style.setProperty(
            'display',
            !visible
                ? 'none'
                : this.settings.type === 'drawer'
                  ? 'flex'
                  : 'block',
        );
    }

    /** Takes the list and the dimmed page off the page. */
    destroy(): void {
        this.close();
        this.box.remove();
        this.backdrop?.remove();
    }

    /** A cross drawn in SVG, so its middle is the button's whatever the font. */
    private closeButton(label: string): HTMLButtonElement {
        const button = document.createElement('button');
        const icon = document.createElementNS(SVG, 'svg');
        const path = document.createElementNS(SVG, 'path');
        button.type = 'button';
        button.className = 'sonicframe-chapter-close';
        button.setAttribute('aria-label', label);
        button.title = label;
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');
        path.setAttribute('d', 'M6 6 18 18M18 6 6 18');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        icon.append(path);
        button.append(icon);
        css(button, [
            // On the list's head, set by `placeCloser` when the list opens.
            ['position', 'absolute'],
            ['top', '0'],
            ['right', '0'],
            ['z-index', '1'],
            ['display', 'inline-grid'],
            ['place-items', 'center'],
            ['width', '1.75rem'],
            ['height', '1.75rem'],
            ['margin', '0'],
            ['padding', '0'],
            ['border-width', '0'],
            ['border-radius', '0.25rem'],
            ['background-color', 'transparent'],
            ['color', 'inherit'],
            ['cursor', 'pointer'],
        ]);
        css(icon, [
            ['width', '1.125rem'],
            ['height', '1.125rem'],
            ['display', 'block'],
        ]);
        button.addEventListener('click', () => this.onClose(true));

        return button;
    }

    /**
     * Puts the drawer's close button on the list's head, its middle on the middle of the head's
     * name and its right edge on the list's; without a head, in the list's top corner. Measured
     * when the list opens, since the list's look may change its padding, border and font.
     */
    private placeCloser(): void {
        const button = this.closer;

        if (button === null) {
            return;
        }

        // The button is placed from inside the drawer's border.
        const style = getComputedStyle(this.box);
        const box = this.box.getBoundingClientRect();
        const top = box.top + (parseFloat(style.borderTopWidth) || 0);
        const right = box.right - (parseFloat(style.borderRightWidth) || 0);
        const list = this.content.getBoundingClientRect();
        const size = button.getBoundingClientRect();
        const name =
            this.content.querySelector('.sonicframe-chapters-head')
                ?.firstElementChild ?? null;
        let middle = list.top + size.height / 2;

        if (name !== null) {
            const line = name.getBoundingClientRect();
            middle = line.top + line.height / 2;
        }

        css(button, [
            ['top', `${middle - size.height / 2 - top}px`],
            ['right', `${right - list.right}px`],
        ]);
    }

    /** The player's colors and font, read now, so a palette changed later still shows. */
    private carry(): void {
        const style = getComputedStyle(this.source);

        for (const name of CARRIED) {
            const value =
                style.getPropertyValue(name).trim() ||
                this.source.style.getPropertyValue(name).trim();

            if (value === '') {
                this.box.style.removeProperty(name);
            } else {
                this.box.style.setProperty(name, value);
            }
        }

        css(this.box, [
            ['font-family', style.getPropertyValue('font-family') || 'inherit'],
            ['font-size', style.getPropertyValue('font-size') || 'inherit'],
        ]);
    }

    /** A popover goes under its button (or over it), inside the window, its arrow at the button. */
    private place(): void {
        const anchor = this.anchor;
        const arrow = this.arrow;

        if (anchor === null || arrow === null) {
            return;
        }

        // The page's own width and height leave its scrollbars out; the window's would not.
        const page = document.documentElement;
        const view = {
            width: page.clientWidth || window.innerWidth,
            height: page.clientHeight || window.innerHeight,
        };
        this.box.style.setProperty(
            'max-width',
            `${Math.max(0, view.width - MARGIN * 2)}px`,
        );
        const at = anchor.getBoundingClientRect();
        const size = this.box.getBoundingClientRect();
        const spot = placeTooltip(
            at,
            { width: size.width, height: size.height },
            view,
            {
                prefer: this.settings.placement === 'above' ? 'above' : 'below',
                gap: GAP,
                margin: MARGIN,
            },
        );
        const x = arrowOffset(at, spot.left, size.width, ARROW_INSET);
        const below = spot.side === 'below';
        // The arrow is placed from inside the list's border, which the list's look may thicken.
        const edge = parseFloat(getComputedStyle(this.box).borderTopWidth) || 0;

        css(this.box, [
            ['left', `${spot.left}px`],
            ['top', `${spot.top}px`],
        ]);
        css(arrow, [
            ['left', `${x - ARROW / 2 - edge}px`],
            // The arrow's two outer sides carry the border, on the edge that faces the button.
            [
                'border-width',
                below
                    ? `${edge}px 0px 0px ${edge}px`
                    : `0px ${edge}px ${edge}px 0px`,
            ],
        ]);
        arrow.style.removeProperty(below ? 'bottom' : 'top');
        // Its middle sits on the list's outer edge, half of it out toward the button.
        arrow.style.setProperty(
            below ? 'top' : 'bottom',
            `${-ARROW / 2 - edge}px`,
        );
    }

    /** What closes the list while it is open, and what moves a popover along with its button. */
    private listen(): void {
        const outside = (event: Event): void => {
            const target = event.target as Node | null;

            if (
                target !== null &&
                !this.box.contains(target) &&
                !(this.anchor?.contains(target) ?? false)
            ) {
                this.onClose(false);
            }
        };
        const escape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.onClose(true);
            }
        };
        const leave = (event: FocusEvent): void => {
            const next = event.relatedTarget as Node | null;

            if (
                next !== null &&
                !this.box.contains(next) &&
                !(this.anchor?.contains(next) ?? false)
            ) {
                this.onClose(false);
            }
        };
        const chosen = (event: Event): void => {
            const target = event.target as Element | null;

            if (
                !this.settings.stayOpen &&
                target?.closest('.sonicframe-chapter') !== null
            ) {
                this.onClose(true);
            }
        };
        const follow = (): void => this.place();

        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('keydown', escape, true);
        this.box.addEventListener('focusout', leave);
        this.box.addEventListener('click', chosen);
        window.addEventListener('resize', follow);
        window.addEventListener('scroll', follow, {
            capture: true,
            passive: true,
        });
        this.stops.push(
            () => document.removeEventListener('pointerdown', outside, true),
            () => document.removeEventListener('keydown', escape, true),
            () => this.box.removeEventListener('focusout', leave),
            () => this.box.removeEventListener('click', chosen),
            () => window.removeEventListener('resize', follow),
            () =>
                window.removeEventListener('scroll', follow, { capture: true }),
        );
    }

    /** Fades or slides the list in, only when asked and never for people who asked for less motion. */
    private enter(): void {
        if (
            !this.settings.animation ||
            prefersReducedMotion() ||
            typeof this.box.animate !== 'function'
        ) {
            return;
        }

        const from =
            this.settings.animationType === 'fade'
                ? 'none'
                : this.settings.type === 'drawer'
                  ? `translateX(${this.settings.side === 'left' ? '-' : ''}100%)`
                  : 'translateY(-0.5rem)';
        const moving = this.box.animate(
            [
                { opacity: 0, transform: from },
                { opacity: 1, transform: 'none' },
            ],
            { duration: ENTER_MS, easing: 'ease-out' },
        );
        // Closing mid-way cancels it, which rejects `finished`: that is how it ends, never an error.
        moving.finished.catch(() => undefined);
    }
}
