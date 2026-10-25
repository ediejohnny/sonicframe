/**
 * Recording a short clip of the wave playing, as a video the listener can share. The decoded audio
 * plays (silently for the user) into a MediaStream, the wave is drawn on a canvas each frame, and a
 * MediaRecorder captures both. It runs in real time, stops at the end of the range, aborts if the
 * tab is hidden, and is capped (length, size, resolution, bitrate). No user color ever goes into a
 * gradient; the caption is clipped, not faded through one.
 */

import { clipPlan, DEFAULT_CLIP_TYPES, pickMimeType } from '../core/clip';
import { barMetrics, layoutBars } from '../core/layout';
import { resample } from '../core/peaks';
import { overlayOf } from '../core/scene';
import type { BarStyle } from '../types';
import { barsPath, paintBars, type Palette } from './paint';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const MAX_FPS = 60;
const MAX_BITRATE = 8_000_000;
const MAX_BYTES = 100 * 1024 * 1024;

export type ClipOptions = {
    /** The sound: a decoded buffer, a blob, or a URL. */
    audio: AudioBuffer | Blob | string;
    /** Peaks to draw (0..1). */
    peaks: readonly number[];
    bar: BarStyle;
    /** Resolved colors (no `var()`). */
    colors: { wave: string; progress: string };
    /** A caption drawn under the wave. */
    caption?: string;
    start?: number;
    end?: number;
    width?: number;
    height?: number;
    fps?: number;
    /** Container/codec candidates, most wanted first. */
    mimeTypes?: readonly string[];
    signal?: AbortSignal;
    onProgress?: (fraction: number) => void;
};

async function toBuffer(
    context: AudioContext,
    audio: AudioBuffer | Blob | string,
): Promise<AudioBuffer> {
    if (typeof audio !== 'string' && 'getChannelData' in audio) {
        return audio;
    }

    const data =
        typeof audio === 'string'
            ? await (await fetch(audio)).arrayBuffer()
            : await audio.arrayBuffer();

    return context.decodeAudioData(data);
}

/** Records the clip and resolves with the video blob, its type and its length in seconds. */
export async function exportClip(
    options: ClipOptions,
): Promise<{ blob: Blob; mimeType: string; duration: number }> {
    if (
        typeof MediaRecorder !== 'function' ||
        typeof AudioContext !== 'function'
    ) {
        throw new Error('sonicframe: this browser cannot record a clip');
    }

    const width = Math.min(
        MAX_WIDTH,
        Math.max(16, Math.round(options.width ?? 1280)),
    );
    const height = Math.min(
        MAX_HEIGHT,
        Math.max(16, Math.round(options.height ?? 720)),
    );
    const fps = Math.min(MAX_FPS, Math.max(1, Math.round(options.fps ?? 30)));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx === null || typeof canvas.captureStream !== 'function') {
        throw new Error('sonicframe: this browser cannot record a canvas');
    }

    const context = new AudioContext();
    const buffer = await toBuffer(context, options.audio);
    const plan = clipPlan(
        options.start ?? 0,
        options.end ?? buffer.duration,
        buffer.duration,
    );

    const stream = canvas.captureStream(fps);
    const source = context.createBufferSource();
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
    const recorder = new MediaRecorder(
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
    const waveHeight = height - captionHeight;
    const path = barsPath(
        layoutBars(values, width, waveHeight, options.bar, 1),
    );
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
        let frame = 0;
        let startedAt = 0;

        const finish = (): void => {
            if (!stopped) {
                stopped = true;
                cancelAnimationFrame(frame);

                try {
                    recorder.stop();
                } catch {
                    // already stopped
                }
            }
        };

        const fail = (error: unknown): void => {
            finish();
            void context.close();
            reject(error);
        };

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

        recorder.onstop = (): void => {
            void context.close();
            resolve({
                blob: new Blob(chunks, { type: mimeType || 'video/webm' }),
                mimeType: mimeType || 'video/webm',
                duration: plan.seconds,
            });
        };

        const draw = (): void => {
            if (stopped) {
                return;
            }

            if (options.signal?.aborted || document.hidden) {
                fail(new DOMException('aborted', 'AbortError'));

                return;
            }

            const elapsed = context.currentTime - startedAt;
            const fraction = plan.seconds > 0 ? elapsed / plan.seconds : 1;
            options.onProgress?.(Math.min(1, Math.max(0, fraction)));

            ctx.clearRect(0, 0, width, height);
            paintBars(
                ctx,
                path,
                overlayOf(Math.min(1, fraction), null, width),
                width,
                waveHeight,
                palette,
            );

            if (options.caption !== undefined) {
                ctx.fillStyle = palette.progress;
                ctx.font = '16px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, waveHeight, width, captionHeight);
                ctx.clip();
                ctx.fillText(
                    options.caption,
                    8,
                    waveHeight + captionHeight / 2,
                );
                ctx.restore();
            }

            if (elapsed >= plan.seconds) {
                finish();

                return;
            }

            frame = requestAnimationFrame(draw);
        };

        options.signal?.addEventListener('abort', () =>
            fail(new DOMException('aborted', 'AbortError')),
        );

        void context.resume().then(() => {
            startedAt = context.currentTime;
            source.start(0, plan.start, plan.seconds);
            recorder.start(1000);
            frame = requestAnimationFrame(draw);
        }, fail);
    });
}
