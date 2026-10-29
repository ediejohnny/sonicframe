import { describe, expect, it } from 'vite-plus/test';
import {
    findSilences,
    mixdown,
    nextSkip,
    peakLevel,
    silencesFromPeaks,
    type ChannelSource,
} from '../src/core/analysis';

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

describe('finding silences', () => {
    it('finds the quiet second between two loud ones', () => {
        const rate = 1000;
        const samples = new Float32Array(3 * rate);
        tone(samples, 0, rate, 0.5);
        tone(samples, rate, 2 * rate, 0.0001);
        tone(samples, 2 * rate, 3 * rate, 0.5);

        const silences = findSilences(samples, rate, {
            thresholdDb: -45,
            minDuration: 0.4,
        });

        expect(silences).toHaveLength(1);
        expect(silences[0].start).toBeCloseTo(1, 1);
        expect(silences[0].end).toBeCloseTo(2, 1);
    });

    it('finds silences from server peaks', () => {
        const silences = silencesFromPeaks([1, 1, 0, 0, 1, 1], 6, {
            minDuration: 1,
        });

        expect(silences).toHaveLength(1);
        expect(silences[0]).toEqual({ start: 2, end: 4 });
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
