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
