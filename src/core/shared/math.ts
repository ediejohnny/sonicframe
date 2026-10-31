/** Keeps a value between 0 and 1; anything that is not a finite number becomes 0. */
export function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Keeps a value from `min` to `max`; when `max` is below `min`, `min` wins. */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** The smallest power of two from `min` that reaches `value`, at most `max` (both powers of two). */
export function powerOfTwo(value: number, min: number, max: number): number {
    let size = min;

    while (size < value && size < max) {
        size *= 2;
    }

    return size;
}

/** The value if it is a finite number above zero, otherwise null (an unknown length or size). */
export function positive(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null;
}
