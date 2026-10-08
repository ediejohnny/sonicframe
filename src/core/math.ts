/** Keeps a value between 0 and 1; anything that is not a finite number becomes 0. */
export function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** The value if it is a finite number above zero, otherwise null (an unknown length or size). */
export function positive(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null;
}
