/**
 * Live frequency on the page: without Web Audio (happy-dom has none) the plugin refuses with an
 * error rather than muting playback; with a stand-in audio context it feeds the bars as many bands
 * as asked; and setValues overrides the bars.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { liveFrequency, type LiveFrequencyOptions } from '../../../src/index';
import {
    recordingOf,
    triggerResize,
    triggerVisible,
} from '../../support/fakes';
import {
    mount,
    nextFrame,
    fakeMedia,
    takeOff,
    type Mounted,
} from '../../support/helpers';

let mounted: Mounted | null = null;

describe('live frequency', () => {
    it('reports an error when it cannot tap the audio', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({ media });

        const errors: unknown[] = [];
        mounted.frame.on('error', (error) => errors.push(error));
        mounted.frame.use(liveFrequency());

        expect(errors).toHaveLength(1);
    });
});

describe('the bands', () => {
    /** An audio context whose analyser hears a loud, even spectrum. */
    class LoudContext {
        readonly sampleRate = 48000;
        readonly destination = {};

        resume(): Promise<void> {
            return Promise.resolve();
        }

        createAnalyser(): object {
            return {
                fftSize: 512,
                smoothingTimeConstant: 0.8,
                frequencyBinCount: 256,
                connect: (): void => undefined,
                getByteFrequencyData: (spectrum: Uint8Array): void => {
                    spectrum.fill(200);
                },
            };
        }

        createMediaElementSource(): object {
            return { connect: (): void => undefined };
        }
    }

    afterEach(() => vi.unstubAllGlobals());

    it('feeds the bars as many bands as asked, by bands over the old bars, 48 unless told', async () => {
        vi.stubGlobal('AudioContext', LoudContext);
        const cases: [LiveFrequencyOptions, number][] = [
            [{ bands: 12 }, 12],
            [{ bands: 12, bars: 30 }, 12],
            [{ bars: 30 }, 30],
            [{}, 48],
        ];

        for (const [options, count] of cases) {
            const playing = mount({
                media: fakeMedia({ duration: 40, paused: false }),
                lazy: false,
            });
            triggerResize(playing.canvas, { width: 200, height: 40 });
            triggerVisible(playing.canvas, true);
            const fed = vi.spyOn(playing.frame, 'setValues');
            playing.frame.use(liveFrequency(options));
            playing.frame.invalidate();
            await nextFrame();

            expect(fed.mock.calls.at(-1)?.[0]).toHaveLength(count);
            takeOff(playing);
        }
    });
});

describe('setValues', () => {
    it('draws the overridden bars', async () => {
        mounted = mount({ lazy: false });
        triggerResize(mounted.canvas, { width: 200, height: 40 });
        triggerVisible(mounted.canvas, true);

        mounted.frame.setValues([1, 0.2, 0.8, 0.1, 0.9]);
        await nextFrame();

        expect(recordingOf(mounted.canvas).ops).toContain('fill');
    });
});
