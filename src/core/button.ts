/**
 * How a play button looks, without the page: icon shapes and the inline styles for each shape and
 * fill. Icons sit on a 24 × 24 grid. The play triangle is centered by its centroid, not its box: a
 * triangle centered by its box looks pushed to the left.
 */

export type ButtonShape = 'circle' | 'rounded' | 'square';

/** Solid: filled with the color. Outline: a ring in the color. Ghost: only the icon. */
export type ButtonFill = 'solid' | 'outline' | 'ghost';

export type ButtonColors = {
    /** The button's color: its fill, its ring, or the icon for outline and ghost buttons. */
    background: string;
    /** The icon on a solid button. */
    icon: string;
};

export type ButtonLook = {
    shape: ButtonShape;
    fill: ButtonFill;
    /** Width and height in CSS pixels. */
    size: number;
    /** Corner radius in CSS pixels, instead of the shape's own. */
    radius?: number | null;
    colors: ButtonColors;
};

/** A right-pointing triangle whose centroid is the middle of the grid. */
export const PLAY_ICON: readonly (readonly [number, number])[] = [
    [8.5, 5.5],
    [8.5, 18.5],
    [19, 12],
];

/** Two bars, centered on the grid. */
export const PAUSE_ICON: readonly (readonly [
    x: number,
    y: number,
    width: number,
    height: number,
])[] = [
    [6.5, 5.5, 3.5, 13],
    [14, 5.5, 3.5, 13],
];

/** The play icon as SVG path data. */
export function playPath(): string {
    const [first, ...rest] = PLAY_ICON;

    return `M${first[0]} ${first[1]}${rest.map(([x, y]) => `L${x} ${y}`).join('')}Z`;
}

/** The pause icon as SVG path data. */
export function pausePath(): string {
    return PAUSE_ICON.map(
        ([x, y, width, height]) => `M${x} ${y}h${width}v${height}h${-width}Z`,
    ).join('');
}

/** The icon's size in CSS pixels for a button of `size`. */
export function iconSize(size: number): number {
    return Math.max(8, Math.round(size * 0.58));
}

function cornerRadius(look: ButtonLook): string {
    if (look.radius !== undefined && look.radius !== null) {
        return `${Math.max(0, look.radius)}px`;
    }

    switch (look.shape) {
        case 'circle':
            return '50%';
        case 'rounded':
            return '25%';
        default:
            return '0';
    }
}

/** The inline styles that draw a button, as CSS property and value pairs. */
export function buttonStyles(look: ButtonLook): [string, string][] {
    const size = `${Math.max(1, look.size)}px`;
    const solid = look.fill === 'solid';

    return [
        ['display', 'inline-grid'],
        ['place-items', 'center'],
        ['box-sizing', 'border-box'],
        ['flex-shrink', '0'],
        ['width', size],
        ['height', size],
        ['margin', '0'],
        ['padding', '0'],
        [
            'border',
            look.fill === 'outline'
                ? `1px solid ${look.colors.background}`
                : '0',
        ],
        ['border-radius', cornerRadius(look)],
        // Not the `background` shorthand: it would take url(...) from a color and fetch it.
        ['background-color', solid ? look.colors.background : 'transparent'],
        ['color', solid ? look.colors.icon : look.colors.background],
        ['line-height', '0'],
        ['cursor', 'pointer'],
        ['appearance', 'none'],
        ['-webkit-tap-highlight-color', 'transparent'],
        ['transition', 'opacity 120ms, transform 120ms'],
    ];
}
