/**
 * The zoom tests' sound and what they read back: a sound of a quiet half and a loud half, and the
 * bars last drawn.
 */

import { recordingOf } from '../../support/fakes';

/** The bars of the last wave drawn: their x and height, in device pixels. */
export function lastBars(
    canvas: HTMLCanvasElement,
): { x: number; height: number }[] {
    const paths = recordingOf(canvas).paths;

    for (let i = paths.length - 1; i >= 0; i--) {
        const bars = paths[i].calls.filter((call) => call[0] === 'roundRect');

        if (bars.length > 0) {
            return bars.map((call) => ({
                x: call[1] as number,
                height: call[4] as number,
            }));
        }
    }

    return [];
}

export const HALVES: number[] = [
    ...Array.from({ length: 500 }, () => 0),
    ...Array.from({ length: 500 }, () => 1),
];
