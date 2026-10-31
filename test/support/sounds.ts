/** Sounds the tests describe and draw, as peaks. */

/** 200 peaks that climb in sevenths from 0 to 6/7, again and again: bars of every height. */
export const STEPS: number[] = Array.from(
    { length: 200 },
    (_, i) => (i % 7) / 7,
);

/**
 * A 33-second voice note, ten peaks a second: sound to 20 s with a loud spot at 12 s, a 4-second
 * pause, then sound to the end.
 */
export const NOTE: number[] = Array.from({ length: 330 }, (_, index) => {
    const time = index / 10;

    if (time >= 20 && time < 24) {
        return 0;
    }

    return time >= 11.75 && time < 12.45 ? 1 : 0.5;
});
