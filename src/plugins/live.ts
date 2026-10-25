/**
 * Live frequency bars: while the sound plays, the bars dance to its spectrum (Web Audio). The media
 * is routed through a shared analyser; on each painted frame the spectrum becomes a few log-spaced
 * bands that override the bar heights, and the peaks return when it pauses. Media that cannot be
 * tapped without muting it (cross-origin without CORS) is refused with an error, not silenced.
 */

import { frequencyBands } from '../core/bands';
import { resumeAudio, tapMedia, type MediaTap } from '../dom/audio-graph';
import type { Plugin, PluginHost } from '../types';

export type LiveFrequencyOptions = {
    /** Analyser window (a power of two, up to 2048). */
    fftSize?: number;
    /** How much each frame is smoothed toward the last (0..1). */
    smoothing?: number;
    /** Frequency range mapped across the bars. */
    minHz?: number;
    maxHz?: number;
    /** How many bands to feed the bars. */
    bars?: number;
};

export function liveFrequency(options: LiveFrequencyOptions = {}): Plugin {
    const fftSize = Math.min(2048, Math.max(32, options.fftSize ?? 512));
    const smoothing = Math.min(0.99, Math.max(0, options.smoothing ?? 0.8));
    const bars = Math.max(1, options.bars ?? 48);

    let host: PluginHost | null = null;
    let tap: MediaTap | null = null;
    let spectrum: Uint8Array<ArrayBuffer> | null = null;
    const cleanups: (() => void)[] = [];

    function reset(): void {
        host?.setValues(null);
    }

    return {
        name: 'live-frequency',

        setup(frame): void {
            host = frame;
            const media = frame.media;

            if (media === null) {
                return;
            }

            tap = tapMedia(media, fftSize, smoothing);

            if (tap === null) {
                // Refused rather than muted: tell the app, leave playback alone.
                throw new Error(
                    'sonicframe: cannot read this audio (cross-origin without CORS)',
                );
            }

            spectrum = new Uint8Array(tap.analyser.frequencyBinCount);

            for (const [type, handler] of [
                ['play', () => resumeAudio()],
                ['pause', reset],
                ['ended', reset],
            ] as const) {
                media.addEventListener(type, handler);
                cleanups.push(() => media.removeEventListener(type, handler));
            }
        },

        draw(_paint): void {
            if (tap === null || spectrum === null) {
                return;
            }

            tap.analyser.getByteFrequencyData(spectrum);
            host?.setValues(
                frequencyBands(spectrum, bars, tap.sampleRate, {
                    minHz: options.minHz,
                    maxHz: options.maxHz,
                }),
            );
        },

        destroy(): void {
            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            reset();
            tap?.release();
            tap = null;
            spectrum = null;
            host = null;
        },
    };
}
