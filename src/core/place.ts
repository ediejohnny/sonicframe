/**
 * Where a tooltip or a floating box sits next to the thing it describes, kept pure so the maths are
 * tested in Node. It prefers one side, flips to the other when there is no room, centers on the
 * anchor and never lets the box leave the viewport; an arrow on the box still points at the anchor.
 */

export type Side = 'above' | 'below';
export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Placement = { left: number; top: number; side: Side };

export type PlaceOptions = {
    /** The side to try first. */
    prefer?: Side;
    /** Gap between the anchor and the tooltip, in pixels. */
    gap?: number;
    /** Least distance kept from the viewport edges, in pixels. */
    margin?: number;
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Where an arrow on a box points at its anchor, as an x from the box's left edge: at the anchor's
 * middle, kept `inset` away from the box's ends (so it never sits on a rounded corner), and in the
 * box's middle when the box is too narrow for that.
 */
export function arrowOffset(
    anchor: Pick<Rect, 'left' | 'width'>,
    boxLeft: number,
    boxWidth: number,
    inset: number,
): number {
    if (boxWidth < inset * 2) {
        return boxWidth / 2;
    }

    return clamp(
        anchor.left + anchor.width / 2 - boxLeft,
        inset,
        boxWidth - inset,
    );
}

/** Places a `tip`-sized tooltip against `anchor` within `viewport`. */
export function placeTooltip(
    anchor: Rect,
    tip: Size,
    viewport: Size,
    options: PlaceOptions = {},
): Placement {
    const prefer = options.prefer ?? 'above';
    const gap = options.gap ?? 8;
    const margin = options.margin ?? 8;

    const roomAbove = anchor.top;
    const roomBelow = viewport.height - (anchor.top + anchor.height);
    const need = tip.height + gap + margin;

    let side = prefer;

    if (prefer === 'above' && roomAbove < need && roomBelow > roomAbove) {
        side = 'below';
    } else if (
        prefer === 'below' &&
        roomBelow < need &&
        roomAbove > roomBelow
    ) {
        side = 'above';
    }

    const top =
        side === 'above'
            ? anchor.top - gap - tip.height
            : anchor.top + anchor.height + gap;

    return {
        left: clamp(
            anchor.left + anchor.width / 2 - tip.width / 2,
            margin,
            viewport.width - tip.width - margin,
        ),
        top: clamp(top, margin, viewport.height - tip.height - margin),
        side,
    };
}
