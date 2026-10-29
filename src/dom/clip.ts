/**
 * Recording a short clip of the wave playing, as a video the listener can share. The decoded audio
 * plays (silently for the user) into a MediaStream, the wave is drawn on a canvas each frame, and a
 * MediaRecorder captures both. It runs in real time, stops at the end of the range, aborts if the
 * tab is hidden or the signal fires (the download included), rejects rather than waits when the
 * audio never starts, and is capped (length, size, resolution, bitrate). Whatever way it ends, the
 * audio context it opened is closed. No user color ever goes into a gradient; the caption is
 * cleaned, capped and clipped, not faded through one.
 */

import {
    clipPlan,
    DEFAULT_CLIP_TYPES,
    DEFAULT_MAX_SOURCE_SECONDS,
    pickMimeType,
} from '../core/clip';
import { barMetrics } from '../core/layout';
import { resample } from '../core/peaks';
import { overlayOf } from '../core/scene';
import { DEFAULT_WAVE, knobSpot, waveShape } from '../core/shapes';
import { cleanText } from '../core/text';
import type { BarStyle, WaveStyle } from '../types';
import { readCapped } from './decode';
import {
    drawingOf,
    paintKnob,
    paintWave,
    type Drawing,
    type Palette,
} from './paint';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const MAX_FPS = 60;
const MAX_BITRATE = 8_000_000;
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_CAPTION = 200;

export type ClipOptions = {
    /** The sound: a decoded buffer, a blob, or a URL. */
    audio: AudioBuffer | Blob | string;
    /** Peaks to draw (0..1). */
    peaks: readonly number[];
    bar: BarStyle;
    /** How the sound is drawn (the bars unless given). */
    wave?: WaveStyle;
    /** Resolved colors (no `var()`); the knob takes `progress` unless given. */
    colors: { wave: string; progress: string; knob?: string };
    /** A caption drawn under the wave. */
    caption?: string;
    start?: number;
    end?: number;
    width?: number;
    height?: number;
    fps?: number;
    /** Container/codec candidates, most wanted first. */
    mimeTypes?: readonly string[];
    /**
     * The longest source to decode, in seconds: 10 minutes unless set (`Infinity` lifts it). The whole
     * source is decoded before the clip is cut, about 23 MB of memory per minute of stereo audio, so a
     * longer one is refused — before the download when `sourceSeconds` is given, otherwise right after
     * decoding. An `AudioBuffer` is never refused: its memory is already spent.
     */
    maxSourceSeconds?: number;
    /**
     * The source's length in seconds, when known (`frame.exportClip` gives its own media's), so an
     * over-long source is refused before anything is downloaded.
     */
    sourceSeconds?: number;
    signal?: AbortSignal;
    onProgress?: (fraction: number) => void;
};

function whole(
    value: number | undefined,
    fallback: number,
    lo: number,
    hi: number,
): number {
    const chosen =
        value !== undefined && Number.isFinite(value) ? value : fallback;

    return Math.min(hi, Math.max(lo, Math.round(chosen)));
}

/** Whether the sound is already decoded (and needs neither a download nor a decode). */
function isDecoded(audio: AudioBuffer | Blob | string): audio is AudioBuffer {
    return typeof audio !== 'string' && 'getChannelData' in audio;
}

/** A source past `maxSourceSeconds`; both lengths are named so the app can tell the listener. */
function tooLong(seconds: number, limit: number): Error {
    return new Error(
        `sonicframe: the source is too long to record a clip from (${Math.round(seconds)} s, the limit is ${Math.round(limit)} s)`,
    );
}

async function toBuffer(
    context: AudioContext,
    audio: AudioBuffer | Blob | string,
    signal: AbortSignal | undefined,
): Promise<AudioBuffer> {
    if (isDecoded(audio)) {
        return audio;
    }

    let data: ArrayBuffer;

    if (typeof audio === 'string') {
        const response = await fetch(audio, { signal });

        if (!response.ok) {
            throw new Error(
                `sonicframe: could not fetch audio (${response.status})`,
            );
        }

        data = await readCapped(response, MAX_BYTES);
    } else {
        if (audio.size > MAX_BYTES) {
            throw new Error('sonicframe: audio is too large to record');
        }

        data = await audio.arrayBuffer();
    }

    return context.decodeAudioData(data);
}

/**
 * Records the clip and resolves with the video blob, its type and its length in seconds. Call it from
 * a user gesture (a click): browsers keep audio suspended until one, and a clip whose audio never
 * starts is rejected once its length has passed.
 */
export async function exportClip(
    options: ClipOptions,
): Promise<{ blob: Blob; mimeType: string; duration: number }> {
    options.signal?.throwIfAborted();

    if (
        typeof MediaRecorder !== 'function' ||
        typeof AudioContext !== 'function'
    ) {
        throw new Error('sonicframe: this browser cannot record a clip');
    }

    const limit =
        options.maxSourceSeconds !== undefined && options.maxSourceSeconds > 0
            ? options.maxSourceSeconds
            : DEFAULT_MAX_SOURCE_SECONDS;
    const decodes = !isDecoded(options.audio);

    if (
        decodes &&
        options.sourceSeconds !== undefined &&
        options.sourceSeconds > limit
    ) {
        throw tooLong(options.sourceSeconds, limit);
    }

    const width = whole(options.width, 1280, 16, MAX_WIDTH);
    const height = whole(options.height, 720, 16, MAX_HEIGHT);
    const fps = whole(options.fps, 30, 1, MAX_FPS);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx === null || typeof canvas.captureStream !== 'function') {
        throw new Error('sonicframe: this browser cannot record a canvas');
    }

    const context = new AudioContext();
    let stream: MediaStream;
    let source: AudioBufferSourceNode;
    let recorder: MediaRecorder;
    let plan: { start: number; end: number; seconds: number };
    let drawing: Drawing;
    const wave = options.wave ?? DEFAULT_WAVE;

    try {
        const buffer = await toBuffer(context, options.audio, options.signal);

        // Its length was unknown until now: an over-long source is refused before any recording.
        if (decodes && buffer.duration > limit) {
            throw tooLong(buffer.duration, limit);
        }
        plan = clipPlan(
            options.start ?? 0,
            options.end ?? buffer.duration,
            buffer.duration,
        );

        stream = canvas.captureStream(fps);
        source = context.createBufferSource();
        source.buffer = buffer;
        const destination = context.createMediaStreamDestination();
        source.connect(destination);

        for (const track of destination.stream.getAudioTracks()) {
            stream.addTrack(track);
        }

        const mimeType =
            pickMimeType(options.mimeTypes ?? DEFAULT_CLIP_TYPES, (type) =>
                MediaRecorder.isTypeSupported(type),
            ) ?? '';
        recorder = new MediaRecorder(
            stream,
            mimeType === ''
                ? { videoBitsPerSecond: MAX_BITRATE }
                : { mimeType, videoBitsPerSecond: MAX_BITRATE },
        );

        const barCount = barMetrics(width, options.bar, 1).count;
        const values = resample(
            options.peaks.map((value) => Math.min(1, Math.abs(value))),
            barCount,
        );
        const captionHeight = options.caption === undefined ? 0 : 28;
        drawing = drawingOf(
            waveShape(
                values,
                width,
                height - captionHeight,
                options.bar,
                wave,
                1,
            ),
            Math.round(wave.glow),
        );

        // Decoding cannot be cancelled midway: a signal that fired meanwhile ends it here.
        options.signal?.throwIfAborted();
    } catch (error) {
        if (context.state !== 'closed') {
            void context.close();
        }

        throw error;
    }

    const mimeType = recorder.mimeType || 'video/webm';
    const caption =
        options.caption === undefined
            ? undefined
            : cleanText(options.caption, MAX_CAPTION);
    const captionHeight = caption === undefined ? 0 : 28;
    const waveHeight = height - captionHeight;
    const palette: Palette = {
        wave: options.colors.wave,
        progress: options.colors.progress,
        hover: null,
        cursor: null,
    };

    return new Promise((resolve, reject) => {
        const chunks: Blob[] = [];
        let size = 0;
        let stopped = false;
        let settled = false;
        let frame = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let startedAt = 0;

        const closeContext = (): void => {
            if (context.state !== 'closed') {
                void context.close();
            }
        };

        const teardown = (): void => {
            cancelAnimationFrame(frame);

            if (timer !== undefined) {
                clearTimeout(timer);
            }

            options.signal?.removeEventListener('abort', onAbort);
            document.removeEventListener('visibilitychange', onVisibility);

            for (const track of stream.getTracks()) {
                track.stop();
            }
        };

        const finish = (): void => {
            if (stopped || settled) {
                return;
            }

            stopped = true;

            // A recorder that never started never fires `onstop`: there is no clip, so say why.
            if (recorder.state === 'inactive') {
                fail(
                    new Error(
                        'sonicframe: the recording never started (audio stays suspended until a user gesture)',
                    ),
                );

                return;
            }

            teardown();

            try {
                recorder.stop();
            } catch {
                // already stopped
            }
        };

        const fail = (error: unknown): void => {
            if (settled) {
                return;
            }

            settled = true;
            teardown();

            try {
                recorder.stop();
            } catch {
                // ignore
            }

            closeContext();
            reject(error);
        };

        function onAbort(): void {
            fail(new DOMException('aborted', 'AbortError'));
        }

        function onVisibility(): void {
            if (document.hidden) {
                fail(new DOMException('aborted', 'AbortError'));
            }
        }

        recorder.ondataavailable = (event): void => {
            if (event.data.size > 0) {
                size += event.data.size;
                chunks.push(event.data);

                if (size > MAX_BYTES) {
                    fail(
                        new Error(
                            'sonicframe: the clip grew past the size cap',
                        ),
                    );
                }
            }
        };

        recorder.onerror = (): void =>
            fail(new Error('sonicframe: recording failed'));

        recorder.onstop = (): void => {
            if (settled) {
                return;
            }

            settled = true;
            closeContext();
            resolve({
                blob: new Blob(chunks, { type: mimeType }),
                mimeType,
                duration: plan.seconds,
            });
        };

        const draw = (): void => {
            if (stopped) {
                return;
            }

            const elapsed = context.currentTime - startedAt;
            const fraction = plan.seconds > 0 ? elapsed / plan.seconds : 1;
            options.onProgress?.(Math.min(1, Math.max(0, fraction)));

            ctx.clearRect(0, 0, width, height);
            const overlay = overlayOf(Math.min(1, fraction), null, width);
            paintWave(ctx, drawing, overlay, width, waveHeight, palette);

            const spot = knobSpot(
                overlay.progress,
                width,
                waveHeight,
                wave,
                options.bar.align,
                1,
            );

            if (spot !== null) {
                paintKnob(ctx, spot, options.colors.knob ?? palette.progress);
            }

            if (caption !== undefined) {
                ctx.fillStyle = palette.progress;
                ctx.font = '16px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, waveHeight, width, captionHeight);
                ctx.clip();
                ctx.fillText(caption, 8, waveHeight + captionHeight / 2);
                ctx.restore();
            }

            if (elapsed >= plan.seconds) {
                finish();

                return;
            }

            frame = requestAnimationFrame(draw);
        };

        options.signal?.addEventListener('abort', onAbort);
        document.addEventListener('visibilitychange', onVisibility);
        // A hidden tab freezes requestAnimationFrame, so a timer is the backstop that still finishes.
        timer = setTimeout(finish, (plan.seconds + 1) * 1000);

        context.resume().then(() => {
            if (stopped || settled) {
                return;
            }

            // Starting can still be refused (no track to record, a codec gone): reject, never hang.
            try {
                startedAt = context.currentTime;
                source.start(0, plan.start, plan.seconds);
                recorder.start(1000);
                frame = requestAnimationFrame(draw);
            } catch (error) {
                fail(error);
            }
        }, fail);
    });
}
