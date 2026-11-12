import { describe, expect, it } from 'vite-plus/test';
import {
    findSilences,
    levels,
    mixdown,
    nextSkip,
    peakLevel,
    silencesFromPeaks,
    type ChannelSource,
} from '../../../src/core/analysis/analysis';

function tone(
    samples: Float32Array,
    from: number,
    to: number,
    amp: number,
): void {
    for (let i = from; i < to; i++) {
        samples[i] = amp * Math.sin(i);
    }
}

/** Three seconds at 1000 samples a second: loud, a quiet second from `from` ms, loud again. */
function quietMiddle(from = 1000): Float32Array {
    const samples = new Float32Array(3000);
    tone(samples, 0, from, 0.5);
    tone(samples, from, from + 1000, 0.0001);
    tone(samples, from + 1000, 3000, 0.5);

    return samples;
}

/** A number written as text, or `NaN`, where an option wants a number. */
const odd = (value: string | number): number => value as number;

describe('finding silences', () => {
    it('finds the quiet second between two loud ones', () => {
        const silences = findSilences(quietMiddle(), 1000, {
            thresholdDb: -45,
            minDuration: 0.4,
        });

        expect(silences).toHaveLength(1);
        expect(silences[0].start).toBeCloseTo(1, 1);
        expect(silences[0].end).toBeCloseTo(2, 1);
    });

    it('reads -45 dB, 0.4 seconds and windows of 20 ms when those are not numbers', () => {
        for (const options of [
            { thresholdDb: Number.NaN },
            { thresholdDb: odd('-45') },
            { minDuration: Number.NaN },
            { minDuration: Number.POSITIVE_INFINITY },
            { minDuration: odd('5') },
        ]) {
            const silences = findSilences(quietMiddle(), 1000, options);

            expect(silences).toHaveLength(1);
            expect(silences[0].start).toBeCloseTo(1, 1);
            expect(silences[0].end).toBeCloseTo(2, 1);
        }

        // Quiet from 1.01 s: the first quiet window of 20 ms starts at 1.02 s (one of 50 ms, at 1.05).
        for (const windowSeconds of [Number.NaN, odd('wide')]) {
            const [silence] = findSilences(quietMiddle(1010), 1000, {
                windowSeconds,
            });

            expect(silence.start).toBeCloseTo(1.02, 3);
        }
    });

    it('measures the levels in windows of 50 ms when the window is not a number', () => {
        for (const windowSeconds of [Number.NaN, odd('wide')]) {
            // One second at 1000 samples a second: twenty windows of fifty.
            expect(
                levels(new Float32Array(1000), 1000, { windowSeconds }).rms,
            ).toHaveLength(20);
        }
    });

    it('keeps its window from 1 ms to 1 second', () => {
        // A window of 100 s would take the whole sound as one loud stretch; one of 1 s finds the quiet one.
        expect(
            findSilences(quietMiddle(), 1000, { windowSeconds: 100 }),
        ).toEqual([{ start: 1, end: 2 }]);
        // A negative window is the shortest: quiet from 1.01 s starts at once, on its first sample.
        const [early] = findSilences(quietMiddle(1010), 1000, {
            windowSeconds: -1,
        });
        expect(early.start).toBeCloseTo(1.01, 3);
    });

    it('keeps the quiet of peaks from 0.001 to 0.45, so a silence can always end and digital silence is quiet', () => {
        // Over 0.5, a silence would close only above twice the threshold, past the loudest peak (1).
        expect(
            silencesFromPeaks([1, 1, 0, 0, 1, 1], 6, {
                threshold: 0.6,
                minDuration: 1,
            }),
        ).toEqual([{ start: 2, end: 4 }]);
        expect(
            silencesFromPeaks([1, 1, 0, 0, 1, 1], 6, {
                threshold: -1,
                minDuration: 1,
            }),
        ).toEqual([{ start: 2, end: 4 }]);
    });

    it('finds silences from server peaks', () => {
        const silences = silencesFromPeaks([1, 1, 0, 0, 1, 1], 6, {
            minDuration: 1,
        });

        expect(silences).toHaveLength(1);
        expect(silences[0]).toEqual({ start: 2, end: 4 });
    });

    it('reads quiet under 0.05 and pauses of 0.4 seconds from peaks when those are not numbers', () => {
        for (const options of [
            { threshold: Number.NaN },
            { threshold: odd('0.5') },
            { minDuration: Number.NaN },
            { minDuration: odd('3') },
        ]) {
            expect(silencesFromPeaks([1, 1, 0, 0, 1, 1], 6, options)).toEqual([
                { start: 2, end: 4 },
            ]);
        }
    });
});

describe('peak level', () => {
    it('reports the peak and counts clipping runs', () => {
        const level = peakLevel([0, 0.5, -1, 0.2, 1, 1]);

        expect(level.peak).toBe(1);
        expect(level.clipped).toBe(true);
        // One isolated clip, then a run of two.
        expect(level.clipRuns).toBe(2);
    });
});

describe('mixdown', () => {
    it('averages the channels to mono within the cap', () => {
        const source: ChannelSource = {
            numberOfChannels: 2,
            length: 4,
            getChannelData: (channel) =>
                channel === 0
                    ? new Float32Array([1, 1, 1, 1])
                    : new Float32Array([-1, -1, -1, -1]),
        };

        expect(Array.from(mixdown(source, 100))).toEqual([0, 0, 0, 0]);
    });
});

describe('next skip', () => {
    it('lands lead seconds before the end of a silence it runs into', () => {
        expect(nextSkip(1.2, [{ start: 1, end: 2 }], 0.1)).toBeCloseTo(1.9);
    });

    it('does not jump once inside the lead at the end', () => {
        expect(nextSkip(1.95, [{ start: 1, end: 2 }], 0.1)).toBeNull();
    });

    it('never lands past the end of the silence, even with a negative lead', () => {
        expect(nextSkip(1.2, [{ start: 1, end: 2 }], -0.5)).toBe(2);
    });
});

describe('the ceilings of the analysis', () => {
    it('measures at most 200 000 windows, or maxWindows up to 2 000 000, refusing past it', () => {
        // A window of one sample: the count is how many windows are measured.
        const samples = new Float32Array(300_000);
        const count = (maxWindows?: number): number =>
            levels(samples, 1000, { windowSeconds: 0.001, maxWindows }).rms
                .length;

        expect(count()).toBe(150_000);
        expect(count(2_000_000)).toBe(300_000);
        expect(count(10)).toBe(10);
        expect(() => count(2_000_001)).toThrow(
            new RangeError(
                'sonicframe: maxWindows goes past its most, 2000000 (2000001)',
            ),
        );
    });

    it('keeps at most 10 000 silences, or maxSilences up to 100 000, refusing past it', () => {
        // Quiet and loud by turns: every quiet peak is a silence of its own.
        const peaks = Array.from({ length: 50_000 }, (_, at) => at % 2);
        const count = (maxSilences?: number): number =>
            silencesFromPeaks(peaks, peaks.length, {
                minDuration: 0,
                maxSilences,
            }).length;
        // Two quiet samples, two loud ones: 60 000 samples hold 15 000 silences.
        const samples = new Float32Array(60_000).map((_, at) =>
            at % 4 < 2 ? 0 : 1,
        );
        const found = (maxSilences?: number): number =>
            findSilences(samples, 1000, {
                windowSeconds: 0.001,
                minDuration: 0,
                maxSilences,
            }).length;

        expect(count()).toBe(10_000);
        expect(count(100_000)).toBe(25_000);
        expect(found()).toBe(10_000);
        expect(found(100_000)).toBe(15_000);
        expect(() => count(100_001)).toThrow(
            'maxSilences goes past its most, 100000',
        );
    });
});
