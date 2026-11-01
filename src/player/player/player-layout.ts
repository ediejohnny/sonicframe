/**
 * A player's main line once built: its pieces, the voice note a narrow player turns into, the rows
 * under the wave laid as a grid when they must keep to the wave's column, and the parts beside the
 * wave lined up with the bars themselves. Pieces are moved, never built again, so the wave and its
 * state stay.
 */

import type { Part, PlayerLook } from '../../core/player/look';
import { css } from '../../dom/shared/css';

/**
 * Where a piece of the main line goes in a narrow player: it stays on the line (the wave, and what
 * `narrowLine` names), goes under the wave on the left (what `narrowStart` names) or on the right
 * (everything else), or is left out (the look's spacers).
 */
export type Place = 'line' | 'start' | 'end' | 'spacer';

/** A piece of the main line: the nodes one part built, and where they go in a narrow player. */
export type Piece = { place: Place; nodes: ChildNode[] };

export function placeOf(part: Part, look: PlayerLook): Place {
    if (part === 'wave' || look.narrowLine.includes(part)) {
        return 'line';
    }

    if (part === 'spacer') {
        return 'spacer';
    }

    return look.narrowStart.includes(part) ? 'start' : 'end';
}

/**
 * The far side of a row under the wave that may break: its parts stay together, with the row's
 * gap, and keep to the far side on whichever line the group lands.
 */
export function farGroup(): HTMLElement {
    const group = document.createElement('div');
    css(group, [
        ['display', 'flex'],
        ['flex-wrap', 'nowrap'],
        ['align-items', 'center'],
        ['gap', '0.5rem'],
        ['margin-left', 'auto'],
    ]);

    return group;
}

/** The vertical shift, in pixels, a part was given to meet the bars; 0 when it has none. */
function givenShift(part: HTMLElement): number {
    return (
        parseFloat(
            part.style.getPropertyValue('translate').split(' ')[1] ?? '',
        ) || 0
    );
}

export class PlayerLayout {
    /** Whether the line is a voice note now. */
    narrow = false;
    /** The row under the wave that holds a voice note's moved pieces; null on one line. */
    private under: HTMLElement | null = null;

    constructor(
        /** The main line. */
        readonly line: HTMLElement,
        /** The wave's box, first in its column. */
        readonly box: HTMLElement,
        /** The line's pieces, in their order. */
        readonly pieces: readonly Piece[],
    ) {}

    /** The wave's column: its box, then the rows under the wave. */
    get column(): HTMLElement {
        return this.box.parentElement as HTMLElement;
    }

    /**
     * Turns the line into a voice note, or back. In a voice note the wave and the parts on the line
     * stay, the spacers go, the parts for the start go under the wave on the left and every other
     * part under it on the right; back on one line, each piece takes its place again.
     */
    voiceNote(narrow: boolean, gap: number): void {
        this.narrow = narrow;

        if (narrow) {
            // The controls keep to the right of the time and take the room left there; only the ones
            // that do not fit wrap, and the whole group goes under the time when not even one fits.
            const space = `${gap}rem`;
            const under = document.createElement('div');
            const controls = document.createElement('div');
            under.className = 'sonicframe-under';
            controls.className = 'sonicframe-under-controls';
            css(under, [
                ['display', 'flex'],
                ['flex-wrap', 'wrap'],
                ['align-items', 'center'],
                ['gap', space],
                ['min-width', '0'],
            ]);
            css(controls, [
                ['display', 'flex'],
                ['flex-wrap', 'wrap'],
                ['justify-content', 'flex-end'],
                ['align-items', 'center'],
                ['gap', space],
                ['flex', '1 1 0px'],
                ['min-width', 'min-content'],
            ]);
            const nodes = (place: Place): ChildNode[] =>
                this.pieces
                    .filter((piece) => piece.place === place)
                    .flatMap((piece) => piece.nodes);

            for (const node of nodes('spacer')) {
                node.remove();
            }

            controls.append(...nodes('end'));
            under.append(...nodes('start'), controls);
            this.box.after(under);
            this.under = under;

            return;
        }

        this.under?.remove();
        this.under = null;
        // The pieces that stayed keep their order; each moved one goes back after the piece before it.
        let previous: ChildNode | null = null;

        for (const { place, nodes } of this.pieces) {
            for (const node of nodes) {
                if (place !== 'line') {
                    if (previous === null) {
                        this.line.prepend(node);
                    } else {
                        previous.after(node);
                    }
                }

                previous = node;
            }
        }
    }

    /**
     * A voice note's line, the line of a player with its chapters list under the wave, and one whose
     * rows under the wave start at the line (`underStart`) are a grid: its first row holds the line's
     * parts and the wave, and the rows under the wave (the small line, the list) keep to the wave's
     * column, or span the whole line from under the play button, so opening the list never moves
     * the parts beside the wave. Otherwise the line is the flexible row it was built as.
     */
    placeRows(
        look: PlayerLook,
        line: { listUnderWave: boolean; zoomOnLine: boolean },
    ): void {
        const { box } = this;
        const column = this.column;
        const parts = [...this.line.children] as HTMLElement[];
        const below = [...column.children].filter(
            (row) => row !== box,
        ) as HTMLElement[];
        const placed = [...parts, box, ...below];
        const fromLine =
            look.underStart === 'line' &&
            look.wavePlace === 'inline' &&
            below.length > 0 &&
            !line.zoomOnLine;

        if (!this.narrow && !line.listUnderWave && !fromLine) {
            css(this.line, [
                ['display', 'flex'],
                ['gap', `${look.gap}rem`],
            ]);
            css(column, [['display', 'flex']]);
            this.line.style.removeProperty('grid-template-columns');

            for (const element of placed) {
                element.style.removeProperty('grid-row');
                element.style.removeProperty('grid-column');
            }

            return;
        }

        const wave = `${parts.indexOf(column) + 1}`;
        css(this.line, [
            ['display', 'grid'],
            [
                'grid-template-columns',
                parts
                    .map((part) =>
                        part === column ? 'minmax(0, 1fr)' : 'auto',
                    )
                    .join(' '),
            ],
            ['column-gap', `${look.gap}rem`],
            ['row-gap', '0.25rem'],
        ]);
        css(column, [['display', 'contents']]);
        parts.forEach((part, index) => {
            if (part !== column) {
                css(part, [
                    ['grid-row', '1'],
                    ['grid-column', `${index + 1}`],
                ]);
            }
        });
        css(box, [
            ['grid-row', '1'],
            ['grid-column', wave],
        ]);
        below.forEach((row, index) =>
            css(row, [
                ['grid-row', `${index + 2}`],
                ['grid-column', look.underStart === 'line' ? '1 / -1' : wave],
            ]),
        );
    }

    /**
     * Lines up the parts beside a wave in the line with the bars themselves. The line centers its
     * parts on the wave's box, which also holds the strips plugins stack above and below the bars,
     * or on the whole column when rows sit under the wave; each part is moved by `translate` alone,
     * so nothing around it moves. A part centered on bars near the line's edge would stick out of
     * the line, into the player's padding; the wave's box then takes a margin on that side, by the
     * overshoot, which moves the bars in until every part fits. The box, not its column: with
     * `underStart: 'line'` the column is `display: contents` and takes no margin.
     */
    alignToBars(): void {
        const canvas = this.box.querySelector('canvas');

        if (canvas === null) {
            return;
        }

        const column = this.box.parentElement;
        const parts = [...this.line.children].filter(
            (part): part is HTMLElement =>
                part !== column &&
                part instanceof HTMLElement &&
                part.getBoundingClientRect().height > 0,
        );
        const shifts = barShifts(canvas, parts);

        if (shifts === null) {
            return;
        }

        if (column?.parentElement === this.line) {
            const line = this.line.getBoundingClientRect();

            if (line.height > 0 && fitBars(this.box, line, parts, shifts)) {
                // The bars moved: measure them again.
                applyShifts(parts, barShifts(canvas, parts) ?? shifts);

                return;
            }
        }

        applyShifts(parts, shifts);
    }
}

/**
 * Moves each of `parts`, by `translate` alone, until its middle meets the middle of the bars drawn
 * on `canvas`; nothing moves while the bars have no height.
 */
export function centerOnBars(
    canvas: HTMLCanvasElement,
    parts: readonly HTMLElement[],
): void {
    const shifts = barShifts(canvas, parts);

    if (shifts !== null) {
        applyShifts(parts, shifts);
    }
}

/**
 * How far each part must move, from where it sits now, for its middle to meet the bars' middle, in
 * whole pixels; `null` while the bars have no height.
 */
function barShifts(
    canvas: HTMLCanvasElement,
    parts: readonly HTMLElement[],
): number[] | null {
    const bars = canvas.getBoundingClientRect();

    if (bars.height <= 0) {
        return null;
    }

    const middle = bars.top + bars.height / 2;

    return parts.map((part) => {
        const rect = part.getBoundingClientRect();

        return Math.round(middle - (rect.top + rect.height / 2));
    });
}

/** Moves each part by its shift, on top of the shift it was given last time. */
function applyShifts(
    parts: readonly HTMLElement[],
    shifts: readonly number[],
): void {
    parts.forEach((part, index) => {
        const shift = Math.round(givenShift(part) + (shifts[index] ?? 0));
        part.style.setProperty('translate', `0px ${shift}px`);
    });
}

/**
 * Gives the wave's box the margins that keep every shifted part inside the line, and says whether
 * they changed. The margins already given count: the overshoot measured now is added to them, and a
 * part with room to spare takes them back, never below 0. Less than a pixel either way keeps the
 * margin: the line snaps to device pixels, so a pixel of margin can move a centered part by half a
 * pixel and back, and following that would change the margins on every resize, forever.
 */
function fitBars(
    box: HTMLElement,
    line: DOMRect,
    parts: readonly HTMLElement[],
    shifts: readonly number[],
): boolean {
    let overTop = Number.NEGATIVE_INFINITY;
    let overBottom = Number.NEGATIVE_INFINITY;

    parts.forEach((part, index) => {
        const rect = part.getBoundingClientRect();
        const shift = shifts[index] ?? 0;
        overTop = Math.max(overTop, line.top - (rect.top + shift));
        overBottom = Math.max(overBottom, rect.bottom + shift - line.bottom);
    });

    const margin = (side: 'top' | 'bottom', over: number): boolean => {
        const name = `margin-${side}`;
        const given = parseFloat(box.style.getPropertyValue(name)) || 0;
        const next =
            over === Number.NEGATIVE_INFINITY
                ? 0
                : Math.abs(over) < 1
                  ? given
                  : Math.max(0, Math.round(given + over));
        box.style.setProperty(name, `${next}px`);

        return next !== given;
    };

    const top = margin('top', overTop);
    const bottom = margin('bottom', overBottom);

    return top || bottom;
}
