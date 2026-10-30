/**
 * Peaks at every zoom: a pyramid of maxima, built once, from which any window of a bar grid laid
 * over the whole sound is read at a cost that follows the screen, not the file. Nothing here touches
 * the page.
 */

/** Level 0 is the peaks; each next level keeps the louder of each pair of the one below. */
export type Detail = readonly Float64Array[];

export function buildDetail(peaks: readonly number[]): Detail {
    const levels = [Float64Array.from(peaks)];

    for (let below = levels[0]; below.length > 1;) {
        const level = new Float64Array(Math.ceil(below.length / 2));

        for (let i = 0; i < level.length; i++) {
            level[i] = Math.max(below[i * 2], below[i * 2 + 1] ?? 0);
        }

        levels.push(level);
        below = level;
    }

    return levels;
}

/** The loudest peak from index `from` to `to` (excluded), from whole blocks of the pyramid. */
function loudest(detail: Detail, from: number, to: number): number {
    let best = 0;
    let low = from;
    let high = to;

    for (let level = 0; low < high; level++) {
        const values = detail[level];

        if (low % 2 === 1) {
            best = Math.max(best, values[low]);
            low++;
        }

        if (high % 2 === 1) {
            high--;
            best = Math.max(best, values[high]);
        }

        low /= 2;
        high /= 2;
    }

    return best;
}

/**
 * Bars `first` to `first + count - 1` (kept inside the grid) of `total` bars laid over the whole
 * sound. Bar k keeps the loudest peak from floor(k × n ÷ total) to floor((k + 1) × n ÷ total), the
 * slices of `resample`; with more bars than peaks it blends the neighbours, as `resample` stretches.
 */
export function barValues(
    detail: Detail,
    total: number,
    first: number,
    count: number,
): number[] {
    const peaks = detail[0];
    const n = peaks.length;
    const from = Math.max(0, first);
    const to = Math.min(total, first + count);
    const values: number[] = [];

    if (n === 0 || total <= 0) {
        return values;
    }

    for (let bar = from; bar < to; bar++) {
        if (total <= n) {
            values.push(
                loudest(
                    detail,
                    Math.floor((bar * n) / total),
                    Math.floor(((bar + 1) * n) / total),
                ),
            );
        } else {
            const position = total > 1 ? (bar * (n - 1)) / (total - 1) : 0;
            const left = Math.floor(position);
            const right = Math.min(n - 1, left + 1);

            values.push(
                peaks[left] + (peaks[right] - peaks[left]) * (position - left),
            );
        }
    }

    return values;
}
