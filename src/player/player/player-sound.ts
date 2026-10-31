/**
 * A player's sound when the app brings no peaks: decoded once, when the wave first asks for its peaks
 * (near the screen), and shared by the peaks and the spectrogram. A failure is kept too, so both hear
 * the same one instead of downloading again.
 */

import { peaksFromChannel } from '../../core/peaks/peaks';
import { within } from '../../core/shared/checked';
import { DEFAULT_WAVE, resolveWave } from '../../core/wave/shapes';
import { decodeAudio } from '../../dom/audio/decode';
import type { SonicFrame } from '../../dom/frame/frame';
import type { DecodedAudio } from '../../plugins/spectrogram/spectrogram';
import type { PeaksSource, WaveStyle } from '../../types';
import type { PlayerOptions } from './player-options';

/** How many peaks are decoded from a sound, unless the app says otherwise. */
const PEAKS = 1000;

/** Peaks per second of sound decoded with zoom on, unless the app says otherwise. */
const PEAKS_PER_SECOND = 100;

/** The most peaks decoded from one sound. */
const MAX_DECODED_PEAKS = 1_000_000;

export class PlayerSound {
    /** The peaks decoded once, so a wave built again shows them at once. */
    private peaks: readonly number[] | null = null;
    private decoding: Promise<DecodedAudio> | null = null;

    constructor(
        private readonly options: PlayerOptions,
        private readonly media: HTMLMediaElement | null,
        private readonly signal: AbortSignal,
    ) {}

    /**
     * The peaks for a wave about to be built: the app's, the ones decoded before, or a decode that
     * gives them; none for a player without media, or one whose drawing is the track.
     */
    peaksFor(frame: SonicFrame | null, wave: Partial<WaveStyle>): PeaksSource {
        if (this.options.peaks !== undefined) {
            // A new build keeps what the old frame already has, with the duration it came with.
            return frame?.peaks
                ? { peaks: frame.peaks, duration: frame.peaksDuration }
                : this.options.peaks;
        }

        if (this.peaks !== null) {
            return this.peaks;
        }

        const track = resolveWave(DEFAULT_WAVE, wave).style === 'track';

        if (this.media === null || track) {
            return null;
        }

        return async () => {
            const { samples, duration } = await this.decoded();
            this.peaks = peaksFromChannel(samples, this.peakCount(duration));

            return this.peaks;
        };
    }

    /** The sound decoded, once for the player's life. */
    decoded(): Promise<DecodedAudio> {
        if (this.decoding === null) {
            const media = this.media;
            const address =
                this.options.src ??
                (media ? media.currentSrc || media.src : '');

            this.decoding = address
                ? decodeAudio(address, {
                      signal: this.signal,
                      maxSeconds: this.options.decode?.maxSeconds,
                      maxBytes: this.options.decode?.maxBytes,
                  })
                : Promise.reject(
                      new Error('sonicframe: no sound to read peaks from'),
                  );
        }

        return this.decoding;
    }

    /** How many peaks to decode: `decode.peaks`, or per second of sound with zoom on (never fewer). */
    private peakCount(duration: number | undefined): number {
        const decode = this.options.decode ?? {};
        const base = within(decode.peaks, PEAKS, 100, 100_000, Math.round);

        if (!this.options.zoom || duration === undefined || !(duration > 0)) {
            return base;
        }

        const perSecond = within(
            decode.peaksPerSecond,
            PEAKS_PER_SECOND,
            1,
            1000,
            Math.round,
        );

        return Math.min(
            MAX_DECODED_PEAKS,
            Math.max(base, Math.round(duration * perSecond)),
        );
    }
}
