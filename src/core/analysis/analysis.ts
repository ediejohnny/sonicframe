/**
 * Measuring a sound: loudness over time, silences, peak level and clipping, and a mono mixdown. All
 * pure, so it runs in Node and in a worker (it is the `sonicframe/analysis` entry) and is tested
 * without a browser. Everything is capped, so a long recording cannot blow up memory or time.
 */

import { finiteOr, within } from '../shared/checked';
import { limitOf, type Limit } from '../shared/limits';

/** A structural stand-in for an `AudioBuffer`, so the core never names a DOM type. */
export type ChannelSource = {
    readonly numberOfChannels: number;
    readonly length: number;
    getChannelData(channel: number): Float32Array;
};

/** A stretch of quiet, in seconds. */
export type Silence = { start: number; end: number };

/** The options of `levels`. */
export type LevelsOptions = {
    /** The window, in seconds: 0.05 by default. */
    windowSeconds?: number;
    /**
     * The most windows measured; a longer sound widens them: 200 000, from 1 to 2 000 000 (10 hours
     * in windows of 20 ms is 1 800 000). Past either end, a `RangeError`.
     */
    maxWindows?: number;
};

/** What `levels` gives: the RMS and the peak of each window, and the window used, in seconds. */
export type Levels = { rms: number[]; peak: number[]; windowSeconds: number };

/** The options of `findSilences`. */
export type FindSilencesOptions = {
    /**
     * Below this level is quiet, in dB of each window's RMS (0 dB is a full-scale sample): -45 by
     * default. A silence ends once the level rises 6 dB above it.
     */
    thresholdDb?: number;
    /** The shortest silence kept, in seconds: 0.4 by default. */
    minDuration?: number;
    /** The window the level is measured on, in seconds: 0.02 by default, from 0.001 to 1. */
    windowSeconds?: number;
    /** The most windows measured (see `LevelsOptions`). */
    maxWindows?: number;
    /** The most silences kept: 10 000, from 1 to 100 000; past either end, a `RangeError`. */
    maxSilences?: number;
};

/** The options of `silencesFromPeaks`. */
export type SilencesFromPeaksOptions = {
    /**
     * Below this peak is quiet, on the peaks' own 0..1 scale, as given (not a share of the loudest
     * peak, as `outlineSound`'s `threshold` is): 0.05 by default, from 0.001 to 0.45. A silence ends
     * above twice it.
     */
    threshold?: number;
    /** The shortest silence kept, in seconds: 0.4 by default. */
    minDuration?: number;
    /** The most silences kept: 10 000, from 1 to 100 000; past either end, a `RangeError`. */
    maxSilences?: number;
};

/** What `peakLevel` gives: the loudest sample, in dB too, and whether (and how often) the sound clips. */
export type PeakLevel = {
    peak: number;
    peakDb: number;
    clipped: boolean;
    clipRuns: number;
};

const WINDOWS: Limit = {
    value: 200_000,
    least: 1,
    most: 2_000_000,
    whole: true,
};
const SILENCES: Limit = { value: 10_000, least: 1, most: 100_000, whole: true };

function amplitudeFromDb(db: number): number {
    return 10 ** (db / 20);
}

/** RMS and peak level per window (default 50ms); the window is capped so it never makes too many. */
export function levels(
    samples: ArrayLike<number>,
    sampleRate: number,
    options: LevelsOptions = {},
): Levels {
    const wanted = Math.max(
        1,
        Math.round(sampleRate * finiteOr(options.windowSeconds, 0.05)),
    );
    const most = limitOf('maxWindows', options.maxWindows, WINDOWS);
    const size = Math.max(wanted, Math.ceil(samples.length / most));
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
    options: FindSilencesOptions = {},
): Silence[] {
    const minDuration = finiteOr(options.minDuration, 0.4);
    const thresholdDb = finiteOr(options.thresholdDb, -45);
    const most = limitOf('maxSilences', options.maxSilences, SILENCES);
    const quiet = amplitudeFromDb(thresholdDb);
    const loud = amplitudeFromDb(thresholdDb + 6);
    const { rms, windowSeconds } = levels(samples, sampleRate, {
        windowSeconds: within(options.windowSeconds, 0.02, 0.001, 1),
        maxWindows: options.maxWindows,
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
            silences.length < most
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

/** Silences from server peaks (0..1), for an app that has those and no raw samples. */
export function silencesFromPeaks(
    peaks: ArrayLike<number>,
    duration: number,
    options: SilencesFromPeaksOptions = {},
): Silence[] {
    // At most 0.45: a quiet stretch closes above twice the threshold, which the loudest peak (1) is.
    const threshold = within(options.threshold, 0.05, 0.001, 0.45);
    const minDuration = finiteOr(options.minDuration, 0.4);
    const most = limitOf('maxSilences', options.maxSilences, SILENCES);
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
            silences.length < most
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
export function peakLevel(samples: ArrayLike<number>): PeakLevel {
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
 * Where to land once the playhead has run into a silence: `lead` seconds before its end, so the next
 * word is not clipped (and never past the end). Null outside every silence, or already within `lead`
 * of its end. The caller decides that it is ordinary forward playback, never right after a seek.
 */
export function nextSkip(
    time: number,
    silences: readonly Silence[],
    lead: number = 0.1,
): number | null {
    const before = Math.max(0, lead);

    for (const silence of silences) {
        const landing = silence.end - before;

        if (time >= silence.start && time < landing) {
            return landing;
        }
    }

    return null;
}
