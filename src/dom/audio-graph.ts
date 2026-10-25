/**
 * One Web Audio graph for the whole page, so the live analyser can read a media element's sound. A
 * single `AudioContext` is shared; each element is routed source → analyser → destination exactly
 * once (the browser allows only one source per element) and the audio passes through unchanged. The
 * context is never closed and the destination is never disconnected — either would silence the
 * element — and media that cannot be tapped (cross-origin without CORS) is refused, not muted.
 */

import { canTapMedia } from '../core/origin';

export type MediaTap = {
    analyser: AnalyserNode;
    sampleRate: number;
    release(): void;
};

let context: AudioContext | null = null;
const graphs = new WeakMap<
    HTMLMediaElement,
    { analyser: AnalyserNode; refs: number }
>();

function audioContext(): AudioContext | null {
    if (context === null) {
        const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;

        if (typeof Ctor !== 'function') {
            return null;
        }

        context = new Ctor();
    }

    return context;
}

/** Resumes the shared context (it starts suspended until a user gesture). */
export function resumeAudio(): void {
    void context?.resume();
}

/** Routes `media` through a shared analyser, or null if it cannot be tapped without muting it. */
export function tapMedia(
    media: HTMLMediaElement,
    fftSize: number,
    smoothing: number,
): MediaTap | null {
    const tappable = canTapMedia({
        src: media.currentSrc || media.src,
        crossOrigin: media.crossOrigin,
        pageOrigin: window.location.origin,
    });

    if (!tappable) {
        return null;
    }

    const ctx = audioContext();

    if (ctx === null) {
        return null;
    }

    let entry = graphs.get(media);

    if (entry === undefined) {
        let source: MediaElementAudioSourceNode;

        try {
            source = ctx.createMediaElementSource(media);
        } catch {
            return null;
        }

        const analyser = ctx.createAnalyser();
        source.connect(analyser);
        analyser.connect(ctx.destination);
        entry = { analyser, refs: 0 };
        graphs.set(media, entry);
    }

    entry.analyser.fftSize = fftSize;
    entry.analyser.smoothingTimeConstant = smoothing;
    entry.refs++;
    const analyser = entry.analyser;
    let released = false;

    return {
        analyser,
        sampleRate: ctx.sampleRate,
        release(): void {
            if (released) {
                return;
            }

            released = true;
            const current = graphs.get(media);

            if (current !== undefined) {
                current.refs = Math.max(0, current.refs - 1);
            }
        },
    };
}
