/**
 * A player's sound when the app brings no peaks: decoded once, when the wave first asks for its peaks
 * (near the screen), and shared by the peaks and the spectrogram. A failure is kept too, so both hear
 * the same one instead of downloading again. With `decode.stream`, the peaks are read in pieces as the
 * sound downloads instead (drawn as they come), and a sound that cannot be read so is decoded whole.
 */

import { peaksFromChannel } from '../../core/peaks/peaks';
import { within } from '../../core/shared/checked';
import { DEFAULT_WAVE, resolveWave } from '../../core/wave/shapes';
import { limitOf } from '../../core/shared/limits';
import { decodeAudio } from '../../dom/audio/decode';
import {
    NotStreamable,
    STREAM_BYTES,
    STREAM_SECONDS,
    streamPeaks,
    type StreamedPeaks,
} from '../../dom/audio/stream-peaks';
import type { SonicFrame } from '../../dom/frame/frame';
import type { DecodedAudio } from '../../plugins/spectrogram/spectrogram';
import type { PeaksSource, WaveStyle } from '../../types';
import type { PlayerDecode, PlayerOptions } from './player-options';

/** How many peaks are decoded from a sound, unless the app says otherwise. */
const PEAKS = 1000;

/** Peaks per second of sound decoded with zoom on, unless the app says otherwise. */
const PEAKS_PER_SECOND = 100;

/** The most peaks decoded from one sound. */
const MAX_DECODED_PEAKS = 1_000_000;

/** `decode.stream` checked: its ceilings within their ends, or null when it is off. */
type StreamSettings = {
    maxBytes: number;
    maxSeconds: number;
    progressive: boolean;
    webcodecs: boolean;
};

/** Reads `decode.stream`, refusing a ceiling past its ends with a `RangeError`. */
function streamSettings(stream: PlayerDecode['stream']): StreamSettings | null {
    if (stream === undefined || stream === false) {
        return null;
    }

    const own = stream === true ? {} : stream;

    return {
        maxBytes: limitOf('decode.stream.maxBytes', own.maxBytes, STREAM_BYTES),
        maxSeconds: limitOf(
            'decode.stream.maxSeconds',
            own.maxSeconds,
            STREAM_SECONDS,
        ),
        progressive: own.progressive !== false,
        webcodecs: own.webcodecs !== false,
    };
}

export class PlayerSound {
    /** The peaks decoded once, so a wave built again shows them at once. */
    private peaks: readonly number[] | null = null;
    private decoding: Promise<DecodedAudio> | null = null;
    private streaming: Promise<StreamedPeaks | null> | null = null;
    private readonly stream: StreamSettings | null;

    constructor(
        private readonly options: PlayerOptions,
        private readonly media: HTMLMediaElement | null,
        private readonly signal: AbortSignal,
        /** The wave shown now, for the peaks drawn while a sound is read in pieces. */
        private readonly frame: () => SonicFrame | null = () => null,
    ) {
        this.stream = streamSettings(options.decode?.stream);
    }

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
            const streamed = await this.streamed();

            if (streamed !== null) {
                this.peaks = streamed.peaks;

                return { peaks: streamed.peaks, duration: streamed.duration };
            }

            const { samples, duration } = await this.decoded();
            this.peaks = peaksFromChannel(samples, this.peakCount(duration));

            return this.peaks;
        };
    }

    /** The sound's address: the `src` option, or the media's. */
    private address(): string {
        const media = this.media;

        return this.options.src ?? (media ? media.currentSrc || media.src : '');
    }

    /** The media's length, when it knows one. */
    private mediaDuration(): number | undefined {
        const duration = this.media?.duration;

        return duration !== undefined &&
            Number.isFinite(duration) &&
            duration > 0
            ? duration
            : undefined;
    }

    /**
     * The peaks read in pieces as the sound downloads, once for the player's life; null when
     * `decode.stream` is off or the sound cannot be read so (it is then decoded whole).
     */
    private streamed(): Promise<StreamedPeaks | null> {
        const stream = this.stream;
        const address = this.address();

        if (stream === null || !address) {
            return Promise.resolve(null);
        }

        this.streaming ??= streamPeaks(address, {
            count: this.peakCount(this.mediaDuration()),
            maxBytes: stream.maxBytes,
            maxSeconds: stream.maxSeconds,
            webcodecs: stream.webcodecs,
            signal: this.signal,
            duration: () => this.mediaDuration(),
            onPeaks: stream.progressive
                ? (peaks): void => this.frame()?.previewPeaks(peaks)
                : undefined,
        }).catch((error: unknown) => {
            if (error instanceof NotStreamable) {
                return null;
            }

            throw error;
        });

        return this.streaming;
    }

    /** The sound decoded, once for the player's life. */
    decoded(): Promise<DecodedAudio> {
        if (this.decoding === null) {
            const address = this.address();

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

    /** How many peaks to decode: `decode.peakCount`, or per second of sound with zoom on (never fewer). */
    private peakCount(duration: number | undefined): number {
        const decode = this.options.decode ?? {};
        const base = within(
            decode.peakCount ?? decode.peaks,
            PEAKS,
            100,
            100_000,
            Math.round,
        );

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
