/**
 * One tooltip for the whole page, shared by every frame and plugin (a page can hold hundreds of
 * players, so one floating element is created, lazily, and reused). It only shows text: content is
 * set with `textContent`, colors go on `background-color` and `color` (never a shorthand that could
 * fetch a `url()`), and it is `aria-hidden` because the full text reaches assistive tech another way.
 */

import { readableText, type Rgba } from '../../core/shared/color';
import { placeTooltip, type Rect } from '../../core/shared/place';
import { ON_PROGRESS, PROGRESS } from '../../core/shared/variables';
import { css } from './css';
import { readColor } from './paint';
import { pageSize } from './units';

export type TooltipColors = { background: string; text: string };

/** The accessibility of a plugin's tooltip. */
export type TooltipA11y = {
    /**
     * `readable` writes the text in black or white, whichever reads on the tooltip's color (4.5:1),
     * as the caption does. Off by default: the page's color for text on the played color.
     */
    tooltip?: { readable?: boolean };
};

/** What resolves a CSS color as the page computes it (a frame, a plugin's host); '' when it cannot. */
type ColorSource = { color(value: string): string };

/** The played color without a page or a palette, as text and as numbers. */
const PLAYED = '#2f6fdb';
const PLAYED_RGBA: Rgba = [47, 111, 219, 1];
const WHITE: Rgba = [255, 255, 255, 1];

/** The tooltip in the played color, its text the page's color for text on it (white without one). */
export function onProgressColors(source: ColorSource): TooltipColors {
    return {
        background: source.color(PROGRESS) || PLAYED,
        text: source.color(ON_PROGRESS) || '#ffffff',
    };
}

/** The tooltip in the played color, its text white where that reads (4.5:1), otherwise black or white. */
export function readableColors(source: ColorSource | null): TooltipColors {
    const background = source?.color(PROGRESS) || PLAYED;

    return {
        background,
        text: readableText(readColor(background) ?? PLAYED_RGBA, WHITE),
    };
}

/** The colors of a plugin's tooltip: readable ones when its `a11y` asks, the page's otherwise. */
export function tooltipColors(
    source: ColorSource,
    a11y: TooltipA11y | undefined,
): TooltipColors {
    return a11y?.tooltip?.readable === true
        ? readableColors(source)
        : onProgressColors(source);
}

class Tooltip {
    readonly element: HTMLElement;

    constructor() {
        const element = document.createElement('div');
        element.setAttribute('aria-hidden', 'true');
        css(element, [
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
        ]);
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
            pageSize(),
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
