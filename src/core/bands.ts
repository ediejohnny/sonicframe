/**
 * Turning a frequency spectrum (an analyser's bytes, 0..255) into a handful of log-spaced bands,
 * 0..1 — the bars that dance while the sound plays. Log spacing so low notes are not all crammed
 * into one bar. Pure, so it is tested without Web Audio.
 */

export function frequencyBands(
    spectrum: ArrayLike<number>,
    count: number,
    sampleRate: number,
    options: { minHz?: number; maxHz?: number } = {},
): number[] {
    const bins = spectrum.length;
    const nyquist = sampleRate / 2;

    if (bins === 0 || count <= 0 || nyquist <= 0) {
        return Array.from({ length: Math.max(0, count) }, () => 0);
    }

    const minHz = Math.max(1, options.minHz ?? 40);
    const maxHz = Math.min(nyquist, options.maxHz ?? Math.min(16000, nyquist));
    const ratio = maxHz / minHz;
    const bands: number[] = [];

    for (let b = 0; b < count; b++) {
        const from = minHz * ratio ** (b / count);
        const to = minHz * ratio ** ((b + 1) / count);
        const lo = Math.max(0, Math.floor((from / nyquist) * bins));
        const hi = Math.min(bins - 1, Math.ceil((to / nyquist) * bins));
        let peak = 0;

        for (let i = lo; i <= hi; i++) {
            if (spectrum[i] > peak) {
                peak = spectrum[i];
            }
        }

        bands.push(peak / 255);
    }

    return bands;
}
