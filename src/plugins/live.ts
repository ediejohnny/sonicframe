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

function powerOfTwo(value: number): number {
    const wanted = Number.isFinite(value) ? value : 512;
    let size = 32;

    while (size < wanted && size < 2048) {
        size <<= 1;
    }

    return size;
}

export function liveFrequency(options: LiveFrequencyOptions = {}): Plugin {
    const fftSize = powerOfTwo(options.fftSize ?? 512);
    const requested = options.smoothing ?? 0.8;
    const smoothing = Number.isFinite(requested)
        ? Math.min(0.99, Math.max(0, requested))
        : 0.8;
    const bars = Math.max(
        1,
        Number.isFinite(options.bars) ? (options.bars ?? 48) : 48,
    );

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
            resumeAudio();

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
            // Only while actually playing: otherwise setValues would re-invalidate every frame and
            // spin a repaint loop even when paused. The pause/ended handlers restore the peaks once.
            if (
                tap === null ||
                spectrum === null ||
                host === null ||
                host.media?.paused !== false
            ) {
                return;
            }

            tap.analyser.getByteFrequencyData(spectrum);
            host.setValues(
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
