/**
 * One tooltip for the whole page, shared by every frame and plugin (a page can hold hundreds of
 * players, so one floating element is created, lazily, and reused). It only shows text: content is
 * set with `textContent`, colors go on `background-color` and `color` (never a shorthand that could
 * fetch a `url()`), and it is `aria-hidden` because the full text reaches assistive tech another way.
 */

import { placeTooltip, type Rect } from '../core/place';

export type TooltipColors = { background: string; text: string };

class Tooltip {
    readonly element: HTMLElement;

    constructor() {
        const element = document.createElement('div');
        element.setAttribute('aria-hidden', 'true');

        for (const [property, value] of [
            ['position', 'fixed'],
            ['z-index', '2147483646'],
            ['max-width', '280px'],
            ['padding', '6px 8px'],
            ['border-radius', '3px'],
            ['font-size', '12px'],
            ['line-height', '1.4'],
            ['box-shadow', '0 2px 8px rgba(0, 0, 0, 0.25)'],
            ['overflow-wrap', 'anywhere'],
            ['pointer-events', 'auto'],
            ['display', 'none'],
            ['top', '0'],
            ['left', '0'],
        ]) {
            element.style.setProperty(property, value);
        }

        document.body.append(element);
        this.element = element;
    }

    /** Shows `lines` against `anchor`, colored for readability. */
    show(anchor: HTMLElement, lines: string[], colors: TooltipColors): void {
        this.element.replaceChildren();

        for (const line of lines) {
            const row = document.createElement('div');
            row.textContent = line;
            this.element.append(row);
        }

        this.element.style.setProperty('background-color', colors.background);
        this.element.style.setProperty('color', colors.text);
        this.element.style.setProperty('display', 'block');
        this.place(anchor.getBoundingClientRect());
    }

    hide(): void {
        this.element.style.setProperty('display', 'none');
    }

    /** Whether a node is the tooltip or inside it (so the pointer can rest on it). */
    contains(node: Node | null): boolean {
        return node !== null && this.element.contains(node);
    }

    get open(): boolean {
        return this.element.style.getPropertyValue('display') !== 'none';
    }

    private place(anchor: DOMRect): void {
        const tip = this.element.getBoundingClientRect();
        const spot = placeTooltip(
            {
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
                height: anchor.height,
            } satisfies Rect,
            { width: tip.width, height: tip.height },
            { width: window.innerWidth, height: window.innerHeight },
        );

        this.element.style.setProperty('left', `${spot.left}px`);
        this.element.style.setProperty('top', `${spot.top}px`);
    }
}

let shared: Tooltip | null = null;

/** The page's one tooltip, created on first use. */
export function sharedTooltip(): Tooltip {
    return (shared ??= new Tooltip());
}

export type { Tooltip };
