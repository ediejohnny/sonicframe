/**
 * Where a tooltip sits next to the thing it describes, kept pure so the maths are tested in Node. It
 * prefers one side, flips to the other when there is no room, centers on the anchor and never lets
 * the tooltip leave the viewport.
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
