/** A color as red, green, blue (0..255) and alpha (0..1). */
export type Rgba = readonly [number, number, number, number];

/**
 * `var(--name)` or `var(--name, fallback)`. One greedy group for the fallback (trimmed afterwards):
 * neighbouring optional spaces around a lazy group would backtrack for ages on a long broken value.
 */
const VARIABLE = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/;

/**
 * Resolves `var(--name)` and `var(--name, fallback)`, following variables that point to other
 * variables; any other color comes back as it is. `lookup` reads a custom property (the page's
 * computed style). An unknown variable without a fallback resolves to an empty string.
 */
export function resolveColor(
    value: string,
    lookup: (name: string) => string,
    depth: number = 0,
): string {
    const color = value.trim();
    const match = VARIABLE.exec(color);

    if (!match) {
        return color;
    }

    if (depth >= 8) {
        return '';
    }

    const found = lookup(match[1]).trim();

    if (found !== '') {
        return resolveColor(found, lookup, depth + 1);
    }

    return match[2] === undefined
        ? ''
        : resolveColor(match[2], lookup, depth + 1);
}

/** Blends two colors: `amount` 0 is `from`, 1 is `to`. */
export function mixColors(from: Rgba, to: Rgba, amount: number): Rgba {
    const t = Math.min(1, Math.max(0, amount));
    const channel = (index: number): number =>
        Math.round(from[index] + (to[index] - from[index]) * t);

    return [
        channel(0),
        channel(1),
        channel(2),
        Math.round((from[3] + (to[3] - from[3]) * t) * 1000) / 1000,
    ];
}

/** Four bytes of canvas pixel data (red, green, blue, alpha 0..255) as a color. */
export function rgbaFromBytes(bytes: ArrayLike<number>): Rgba {
    return [
        bytes[0],
        bytes[1],
        bytes[2],
        Math.round((bytes[3] / 255) * 1000) / 1000,
    ];
}

export function rgbaString(color: Rgba): string {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
}

/**
 * The played and unplayed colors to use while the pointer is over the frame: the wave is nudged a
 * fifth of the way toward the played color, and the played color is lightened or darkened a little
 * (away from its own luminance), so a hovered frame stands out without a jarring recolor.
 */
export function hoverColors(
    wave: Rgba,
    progress: Rgba,
): { waveHover: Rgba; progressHover: Rgba } {
    const target: Rgba =
        relativeLuminance(progress) < 0.5
            ? [255, 255, 255, progress[3]]
            : [0, 0, 0, progress[3]];

    return {
        waveHover: mixColors(wave, progress, 0.2),
        progressHover: mixColors(progress, target, 0.12),
    };
}

/** Relative luminance (WCAG), 0 (black) to 1 (white); alpha is ignored. */
export function relativeLuminance(color: Rgba): number {
    const linear = (value: number): number => {
        const channel = value / 255;

        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    };

    return (
        0.2126 * linear(color[0]) +
        0.7152 * linear(color[1]) +
        0.0722 * linear(color[2])
    );
}

/** Contrast ratio (WCAG) between two colors, from 1 (same) to 21 (black on white). */
export function contrastRatio(a: Rgba, b: Rgba): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * A text color readable on `background`: the `preferred` color when it clears the 4.5:1 AA threshold,
 * otherwise black or white, whichever has more contrast. Returns a CSS color string.
 */
export function readableText(background: Rgba, preferred: Rgba): string {
    if (contrastRatio(background, preferred) >= 4.5) {
        return rgbaString(preferred);
    }

    const white: Rgba = [255, 255, 255, 1];
    const black: Rgba = [0, 0, 0, 1];

    return rgbaString(
        contrastRatio(background, white) >= contrastRatio(background, black)
            ? white
            : black,
    );
}
