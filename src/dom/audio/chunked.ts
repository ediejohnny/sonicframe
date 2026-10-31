/**
 * Runs a resumable job (the spectrogram) a slice at a time, yielding to the page between slices so it
 * never freezes. Each slice runs for a few milliseconds; an `AbortSignal` stops it (on destroy).
 */

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
    const slice = Math.max(1, options.slice ?? 8);

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
