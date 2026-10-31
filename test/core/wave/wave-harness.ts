/** The values the wave's tests lay out and draw. */

/** `count` values that rise and fall like a sound, from 0.05 to 0.95, never two equal in a row. */
export function wave(count: number): number[] {
    return Array.from(
        { length: count },
        (_, i) => Math.abs(Math.sin(i * 0.37)) * 0.9 + 0.05,
    );
}
