/**
 * Recording a short clip of the wave playing, as a video the listener can share. The decoded audio
 * plays (silently for the user) into a MediaStream, the wave is drawn on a canvas each frame, and a
 * MediaRecorder captures both. It runs in real time, stops at the end of the range, aborts if the
 * tab is hidden or the signal fires (the download included), rejects rather than waits when the
 * audio never starts, and is capped (length, size, resolution, bitrate). Whatever way it ends, the
 * audio context it opened is closed. No user color ever goes into a gradient; the caption is
 * cleaned, capped and clipped, not faded through one.
 */

import { within } from '../../core/shared/checked';
import { limitOf, type Limit } from '../../core/shared/limits';
import { cleanText } from '../../core/shared/text';
import {
    clipPlan,
    clipShape,
    DEFAULT_CLIP_TYPES,
    DEFAULT_MAX_SOURCE_SECONDS,
    pickMimeType,
} from '../../core/wave/clip';
import { DEFAULT_WAVE } from '../../core/wave/shapes';
import type { BarStyle, WaveStyle } from '../../types';
import { drawingOf, type Drawing } from '../shared/paint';
import { CAPTION_HEIGHT, paintClipFrame, type ClipScene } from './clip-picture';
import { CLIP_BYTES, isDecoded, toBuffer, tooLong } from './clip-source';

/** The widest and tallest video, in pixels: 4K, well inside a canvas's 32 767 a side. */
const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
const MAX_FPS = 60;
const MAX_CAPTION = 200;

/** The longest clip, in seconds: 2 minutes, up to 10 (the longest of the short-video networks). */
const CLIP_SECONDS: Limit = { value: 120, least: 1, most: 600, whole: false };

/** The video's bits a second: 8 Mbps, up to 50 (4K at 60 frames). */
const CLIP_BITRATE: Limit = {
    value: 8_000_000,
    least: 100_000,
    most: 50_000_000,
    whole: true,
};

/**
 * The longest source decoded, in seconds: 2 hours at the most (about 2.7 GB of decoded stereo), also
 * for an `Infinity` that once lifted the limit.
 */
const MOST_SOURCE_SECONDS = 7200;

/** A clip made by `exportClip`: the file, its media type and its length in seconds. */
export type ClipResult = { blob: Blob; mimeType: string; duration: number };

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
    /** The video's width in pixels: 1280, from 16 to 3840. */
    width?: number;
    /** The video's height in pixels: 720, from 16 to 2160. */
    height?: number;
    fps?: number;
    /** The longest clip, in seconds: 120, from 1 to 600; past either end, a `RangeError`. */
    maxSeconds?: number;
    /** The video's bits a second: 8 000 000, from 100 000 to 50 000 000; past either end, a `RangeError`. */
    bitrate?: number;
    /**
     * The largest source downloaded and the largest clip, in bytes: 104 857 600 (100 MiB), from 1 to
     * 1 073 741 824 (1 GiB); past either end, a `RangeError`.
     */
    maxBytes?: number;
    /** Container/codec candidates, most wanted first. */
    mimeTypes?: readonly string[];
    /**
     * The longest source to decode, in seconds: 10 minutes unless set, up to 2 hours (a larger value,
     * `Infinity` too, is 2 hours). The whole source is decoded before the clip is cut, about 23 MB of
     * memory per minute of stereo audio, so a longer one is refused — before the download when
     * `sourceSeconds` is given, otherwise right after decoding. An `AudioBuffer` is never refused: its
     * memory is already spent.
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

/**
 * Records the clip and resolves with the video blob, its type and its length in seconds. Call it from
 * a user gesture (a click): browsers keep audio suspended until one, and a clip whose audio never
 * starts is rejected once its length has passed.
 */
export async function exportClip(options: ClipOptions): Promise<ClipResult> {
    options.signal?.throwIfAborted();

    if (
        typeof MediaRecorder !== 'function' ||
        typeof AudioContext !== 'function'
    ) {
        throw new Error('sonicframe: this browser cannot record a clip');
    }

    const asked = options.maxSourceSeconds;
    const limit =
        asked !== undefined && asked > 0
            ? Math.min(asked, MOST_SOURCE_SECONDS)
            : DEFAULT_MAX_SOURCE_SECONDS;
    const maxSeconds = limitOf('maxSeconds', options.maxSeconds, CLIP_SECONDS);
    const bitrate = limitOf('bitrate', options.bitrate, CLIP_BITRATE);
    const maxBytes = limitOf('maxBytes', options.maxBytes, CLIP_BYTES);
    const decodes = !isDecoded(options.audio);

    if (
        decodes &&
        options.sourceSeconds !== undefined &&
        options.sourceSeconds > limit
    ) {
        throw tooLong(options.sourceSeconds, limit);
    }

    const width = within(options.width, 1280, 16, MAX_WIDTH, Math.round);
    const height = within(options.height, 720, 16, MAX_HEIGHT, Math.round);
    const fps = within(options.fps, 30, 1, MAX_FPS, Math.round);
    const caption =
        options.caption === undefined
            ? undefined
            : cleanText(options.caption, MAX_CAPTION);
    const waveHeight = height - (caption === undefined ? 0 : CAPTION_HEIGHT);

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
        const buffer = await toBuffer(
            context,
            options.audio,
            options.signal,
            maxBytes,
        );

        // Its length was unknown until now: an over-long source is refused before any recording.
        if (decodes && buffer.duration > limit) {
            throw tooLong(buffer.duration, limit);
        }
        plan = clipPlan(
            options.start ?? 0,
            options.end ?? buffer.duration,
            buffer.duration,
            maxSeconds,
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
                ? { videoBitsPerSecond: bitrate }
                : { mimeType, videoBitsPerSecond: bitrate },
        );

        drawing = drawingOf(
            clipShape(
                options.peaks,
                plan,
                buffer.duration,
                width,
                waveHeight,
                options.bar,
                wave,
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
    const scene: ClipScene = {
        drawing,
        width,
        height,
        waveHeight,
        wave,
        align: options.bar.align,
        palette: {
            wave: options.colors.wave,
            progress: options.colors.progress,
            hover: null,
            cursor: null,
        },
        knob: options.colors.knob ?? options.colors.progress,
        caption,
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

                if (size > maxBytes) {
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
            paintClipFrame(ctx, scene, fraction);

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
