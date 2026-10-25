/**
 * Measuring a sound: loudness over time, silences, peak level and clipping, and a mono mixdown. All
 * pure, so it runs in Node and in a worker (it is the `sonicframe/analysis` entry) and is tested
 * without a browser. Everything is capped, so a long recording cannot blow up memory or time.
 */

/** A structural stand-in for an `AudioBuffer`, so the core never names a DOM type. */
export type ChannelSource = {
    readonly numberOfChannels: number;
    readonly length: number;
    getChannelData(channel: number): Float32Array;
};

/** A stretch of quiet, in seconds. */
export type Silence = { start: number; end: number };

const MAX_WINDOWS = 200_000;
const MAX_SILENCES = 10_000;

function amplitudeFromDb(db: number): number {
    return 10 ** (db / 20);
}

/** RMS and peak level per window (default 50ms); the window is capped so it never makes too many. */
export function levels(
    samples: ArrayLike<number>,
    sampleRate: number,
    options: { windowSeconds?: number } = {},
): { rms: number[]; peak: number[]; windowSeconds: number } {
    const wanted = Math.max(
        1,
        Math.round(sampleRate * (options.windowSeconds ?? 0.05)),
    );
    const size = Math.max(wanted, Math.ceil(samples.length / MAX_WINDOWS));
    const rms: number[] = [];
    const peak: number[] = [];

    for (let start = 0; start < samples.length; start += size) {
        const end = Math.min(samples.length, start + size);
        let sum = 0;
        let top = 0;

        for (let i = start; i < end; i++) {
            const value = samples[i];
            const magnitude = Math.abs(value);
            sum += value * value;

            if (magnitude > top) {
                top = magnitude;
            }
        }

        rms.push(Math.sqrt(sum / Math.max(1, end - start)));
        peak.push(top);
    }

    return { rms, peak, windowSeconds: size / sampleRate };
}

/**
 * Stretches of quiet of at least `minDuration` seconds. A window below `thresholdDb` opens a
 * silence; it closes only once the level rises a little above the threshold (hysteresis), so a tiny
 * blip does not split one silence in two.
 */
export function findSilences(
    samples: ArrayLike<number>,
    sampleRate: number,
    options: {
        thresholdDb?: number;
        minDuration?: number;
        windowSeconds?: number;
    } = {},
): Silence[] {
    const minDuration = options.minDuration ?? 0.4;
    const quiet = amplitudeFromDb(options.thresholdDb ?? -45);
    const loud = amplitudeFromDb((options.thresholdDb ?? -45) + 6);
    const { rms, windowSeconds } = levels(samples, sampleRate, {
        windowSeconds: options.windowSeconds ?? 0.02,
    });
    const silences: Silence[] = [];
    let open = false;
    let from = 0;

    const close = (toWindow: number): void => {
        const silence = {
            start: from * windowSeconds,
            end: toWindow * windowSeconds,
        };

        if (
            silence.end - silence.start >= minDuration &&
            silences.length < MAX_SILENCES
        ) {
            silences.push(silence);
        }
    };

    for (let w = 0; w < rms.length; w++) {
        if (!open && rms[w] < quiet) {
            open = true;
            from = w;
        } else if (open && rms[w] > loud) {
            close(w);
            open = false;
        }
    }

    if (open) {
        close(rms.length);
    }

    return silences;
}

/** Silences from server peaks (0..1), for an app that has no raw samples (e.g. voicechan). */
export function silencesFromPeaks(
    peaks: ArrayLike<number>,
    duration: number,
    options: { threshold?: number; minDuration?: number } = {},
): Silence[] {
    const threshold = options.threshold ?? 0.05;
    const minDuration = options.minDuration ?? 0.4;
    const step = peaks.length > 0 ? duration / peaks.length : 0;

    if (step <= 0) {
        return [];
    }

    const silences: Silence[] = [];
    let open = false;
    let from = 0;

    const close = (to: number): void => {
        const silence = { start: from * step, end: to * step };

        if (
            silence.end - silence.start >= minDuration &&
            silences.length < MAX_SILENCES
        ) {
            silences.push(silence);
        }
    };

    for (let i = 0; i < peaks.length; i++) {
        if (!open && peaks[i] < threshold) {
            open = true;
            from = i;
        } else if (open && peaks[i] > threshold * 2) {
            close(i);
            open = false;
        }
    }

    if (open) {
        close(peaks.length);
    }

    return silences;
}

/** The loudest sample and whether (and how often) the sound clips. */
export function peakLevel(samples: ArrayLike<number>): {
    peak: number;
    peakDb: number;
    clipped: boolean;
    clipRuns: number;
} {
    let peak = 0;
    let clipRuns = 0;
    let inClip = false;

    for (let i = 0; i < samples.length; i++) {
        const magnitude = Math.abs(samples[i]);

        if (magnitude > peak) {
            peak = magnitude;
        }

        const clipping = magnitude >= 0.999;

        if (clipping && !inClip) {
            clipRuns++;
        }

        inClip = clipping;
    }

    return {
        peak,
        peakDb: peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY,
        clipped: clipRuns > 0,
        clipRuns,
    };
}

/** Mixes every channel down to one, to at most `max` samples (picking evenly through a long sound). */
export function mixdown(source: ChannelSource, max: number): Float32Array {
    const length = max > 0 ? Math.min(source.length, max) : source.length;
    const step = source.length > length ? source.length / length : 1;
    const channels = Array.from({ length: source.numberOfChannels }, (_, c) =>
        source.getChannelData(c),
    );
    const out = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        const at = Math.floor(i * step);
        let sum = 0;

        for (const channel of channels) {
            sum += channel[at] ?? 0;
        }

        out[i] = channels.length > 0 ? sum / channels.length : 0;
    }

    return out;
}

/**
 * The end of the silence the playhead has run into, or null. Only when moving forward into a silence
 * (never right after a seek), and it stops `lead` seconds before the end so a word is not clipped.
 */
export function nextSkip(
    time: number,
    silences: readonly Silence[],
    lead: number = 0.1,
): number | null {
    for (const silence of silences) {
        if (time >= silence.start && time < silence.end - lead) {
            return silence.end;
        }
    }

    return null;
}
