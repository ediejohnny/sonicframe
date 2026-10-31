/** A long job run a slice of time at a time, yielding to the page between slices. */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { runChunked, type Resumable } from '../../../src/dom/audio/chunked';

afterEach(() => {
    vi.restoreAllMocks();
});

/** A job of `steps` steps that takes no time at all. */
function job(steps: number): Resumable {
    let left = steps;

    return {
        step: () => {
            left--;
        },
        get done() {
            return left <= 0;
        },
    };
}

describe('running a job a slice at a time', () => {
    it('runs the whole quick job in one slice, also when the slice is not a number', async () => {
        // No time passes: every step fits in a slice of the usual 8 ms.
        vi.spyOn(performance, 'now').mockReturnValue(0);

        for (const slice of [
            undefined,
            Number.NaN,
            'fast' as unknown as number,
        ]) {
            let slices = 0;
            await runChunked(job(3), { slice, onProgress: () => slices++ });

            expect(slices).toBe(1);
        }
    });
});
