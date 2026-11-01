/**
 * Runs a resumable job (the spectrogram) a slice at a time, yielding to the page between slices so it
 * never freezes. Each slice runs for a few milliseconds; an `AbortSignal` stops it (on destroy).
 */

import { within } from '../../core/shared/checked';

export type Resumable = {
    step(maxColumns: number): void;
    readonly done: boolean;
};

/** Steps `job` to completion in ~`slice`ms bursts; rejects with an `AbortError` if the signal fires. */
export function runChunked(
    job: Resumable,
    options: {
        slice?: number;
        signal?: AbortSignal;
        onProgress?: () => void;
    } = {},
): Promise<void> {
    const slice = within(options.slice, 8, 1, Number.POSITIVE_INFINITY);

    return new Promise((resolve, reject) => {
        const tick = (): void => {
            if (options.signal?.aborted) {
                reject(new DOMException('aborted', 'AbortError'));

                return;
            }

            const started = performance.now();

            do {
                job.step(8);
            } while (!job.done && performance.now() - started < slice);

            options.onProgress?.();

            if (job.done) {
                resolve();
            } else {
                setTimeout(tick, 0);
            }
        };

        setTimeout(tick, 0);
    });
}
