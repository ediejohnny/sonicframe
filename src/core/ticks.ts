/**
 * Choosing nice tick marks for a timeline: a step from a fixed ladder (so labels land on round
 * seconds and minutes) that is at least `minSpacing` pixels apart, and the moments to mark. Pure, so
 * the choice is tested in Node. At most `MAX_TICKS` marks, whatever the duration.
 */

const LADDER = [
    0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

const MAX_TICKS = 200;

/** The step (seconds) and the moments to mark for a `duration`-second sound `width` pixels wide. */
export function niceTicks(
    duration: number,
    width: number,
    minSpacing: number,
): { step: number; times: number[] } {
    if (
        !Number.isFinite(duration) ||
        !Number.isFinite(width) ||
        duration <= 0 ||
        width <= 0
    ) {
        return { step: 0, times: [] };
    }

    const fits = (step: number): boolean =>
        (step / duration) * width >= minSpacing;
    let step = LADDER.find(fits) ?? LADDER[LADDER.length - 1];

    // Never more than MAX_TICKS marks: grow the step (keeping round numbers) until they fit.
    while (duration / step > MAX_TICKS) {
        step *= step < 60 ? 10 : 2;
    }

    const times: number[] = [];

    for (let time = 0; time <= duration + 1e-6; time += step) {
        times.push(Math.round(time * 1000) / 1000);
    }

    return { step, times };
}
