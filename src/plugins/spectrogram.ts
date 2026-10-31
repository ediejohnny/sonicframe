/**
 * A spectrogram under the bars. The heavy maths are pure and resumable (`createSpectrogram`); here
 * the samples are decoded (from the page's audio, with no user gesture), given by a function (to share
 * one decode), or taken ready-made, the job runs in short slices so the page never freezes, and the
 * result is drawn into a small canvas and scaled onto the frame. Nothing is downloaded or computed
 * before the frame's first picture, which a lazy frame only paints near the screen. The color map is
 * a named one or a few CSS colors (read back as numbers, so a theme's variables work); when those
 * colors change after a `refresh()`, the image is repainted from the same result, never recomputed.
 * Colors only ever land in an `ImageData`. Zoomed in, the part of the picture under the view is
 * shown; with `detail`, a sharp picture of that part is computed once the view rests.
 */

import { buildColormap, colormap, type ColormapName } from '../core/colormap';
import {
    createSpectrogram,
    type SpectrogramOptions,
} from '../core/spectrogram';
import { decodeAudio } from '../dom/decode';
import { runChunked } from '../dom/chunked';
import { readColor } from '../dom/paint';
import type { PaintContext, Plugin, PluginHost } from '../types';

/** A color map from colors, quiet to loud: any CSS color or `var(--name, fallback)`. */
export type ColorStops = { from: string; via?: string; to: string };

/** Decoded mono samples, their rate, and the whole sound's length in seconds when known. */
export type DecodedAudio = {
    samples: Float32Array;
    sampleRate: number;
    duration?: number;
};

export type SpectrogramPluginOptions = SpectrogramOptions & {
    /** Ready-made mono samples (skip decoding). */
    samples?: Float32Array;
    /** The sample rate of `samples`. */
    sampleRate?: number;
    /** A URL or blob to decode instead, or a function that gives decoded audio (to share one decode). */
    source?: string | Blob | (() => Promise<DecodedAudio>);
    /** A named color map, or colors from quiet to loud. */
    map?: ColormapName | ColorStops;
    /**
     * Zoomed in, computes a sharp picture of the part in view once the view rests (until then, and
     * without it, the part of the whole picture is shown). Off by default.
     */
    detail?: boolean;
    /** How long the view must rest before the sharp picture is computed, in milliseconds: 200. */
    detailDelay?: number;
    /** Columns of the sharp picture: the frame's width in CSS pixels by default, at most 4096. */
    detailColumns?: number;
};

/** The finished spectrum, kept so the image can be repainted in new colors. */
type Spectrum = { columns: number; rows: number; data: Uint8Array };

/** A sharp picture of one view (its key), its spectrum and its image. */
type Detail = {
    key: string;
    spectrum: Spectrum;
    image: HTMLCanvasElement | null;
};

/** The most columns of a sharp picture. */
const MAX_DETAIL_COLUMNS = 4096;

export function spectrogram(options: SpectrogramPluginOptions = {}): Plugin {
    const choice = options.map ?? 'magma';
    const stops = typeof choice === 'object' ? choice : null;
    const named = typeof choice === 'object' ? null : colormap(choice);

    let host: PluginHost | null = null;
    let spectrum: Spectrum | null = null;
    let image: HTMLCanvasElement | null = null;
    let imageKey: string | null = null;
    let tableKey = '';
    let table: Uint8Array = named ?? colormap('magma');
    // One signal for the download, the decode and the slices: destroy() stops whichever is running.
    let controller: AbortController | null = null;
    let destroyed = false;
    const sharp = options.detail === true;
    const detailDelay = Math.max(
        0,
        Number.isFinite(options.detailDelay)
            ? (options.detailDelay ?? 200)
            : 200,
    );
    /** The decoded sound, kept only for sharp pictures. */
    let audio: DecodedAudio | null = null;
    let detail: Detail | null = null;
    /** The view whose sharp picture is waited for or being computed. */
    let wanted: string | null = null;
    let detailTimer: ReturnType<typeof setTimeout> | undefined;
    let detailJob: AbortController | null = null;

    /**
     * The table for the colors as they are now, and a key that changes only when they do. Colors
     * that cannot be read fall back to the default map.
     */
    function currentMap(paint: PaintContext): string {
        if (stops === null) {
            return 'named';
        }

        const colors = [stops.from, stops.via, stops.to]
            .filter((color): color is string => typeof color === 'string')
            .map((color) => paint.color(color));
        const key = colors.join('\n');

        if (key !== tableKey) {
            const read = colors.map((color) => readColor(color));
            tableKey = key;
            table = read.every((color) => color !== null)
                ? buildColormap(
                      read.map((color) => [
                          color?.[0] ?? 0,
                          color?.[1] ?? 0,
                          color?.[2] ?? 0,
                      ]),
                  )
                : colormap('magma');
        }

        return key;
    }

    function paintImage(result: Spectrum): HTMLCanvasElement | null {
        const { columns, rows, data } = result;
        const canvas = document.createElement('canvas');
        canvas.width = columns;
        canvas.height = rows;
        const context = canvas.getContext('2d');

        if (context === null) {
            return null;
        }

        const picture = context.createImageData(columns, rows);

        for (let i = 0; i < data.length; i++) {
            const value = data[i];
            picture.data[i * 4] = table[value * 3];
            picture.data[i * 4 + 1] = table[value * 3 + 1];
            picture.data[i * 4 + 2] = table[value * 3 + 2];
            picture.data[i * 4 + 3] = 255;
        }

        context.putImageData(picture, 0, 0);

        return canvas;
    }

    /** Computes the sharp picture of `view` once it has rested; a newer view drops an older wait or job. */
    function wantDetail(
        key: string,
        view: { start: number; end: number },
        columns: number,
    ): void {
        if (wanted === key) {
            return;
        }

        wanted = key;
        clearTimeout(detailTimer);
        detailJob?.abort();
        detailJob = null;
        detailTimer = setTimeout(() => {
            const sound = audio;

            if (sound === null || destroyed) {
                return;
            }

            const count = sound.samples.length;
            const slice = sound.samples.subarray(
                Math.floor(view.start * count),
                Math.ceil(view.end * count),
            );
            const job = createSpectrogram(slice, sound.sampleRate, {
                ...options,
                columns,
            });
            const signal = (detailJob = new AbortController()).signal;

            runChunked(job, { signal })
                .then(() => {
                    if (!destroyed && wanted === key) {
                        const result = {
                            columns: job.columns,
                            rows: job.rows,
                            data: job.data,
                        };
                        detail = {
                            key,
                            spectrum: result,
                            image: paintImage(result),
                        };
                        host?.invalidate();
                    }
                })
                .catch((error: unknown) => {
                    // A view that moved on cancels its job: no failure to report.
                    if (!signal.aborted) {
                        fail(error);
                    }
                });
        }, detailDelay);
    }

    /** Tells the app through the frame's `error` event, unless it is the cancellation `destroy()` asked for. */
    function fail(error: unknown): void {
        if (!destroyed) {
            host?.reportError(error);
        }
    }

    function compute(samples: Float32Array, sampleRate: number): void {
        if (destroyed || controller === null) {
            return;
        }

        audio = sharp ? { samples, sampleRate } : null;
        const job = createSpectrogram(samples, sampleRate, options);
        runChunked(job, { signal: controller.signal })
            .then(() => {
                if (!destroyed) {
                    spectrum = {
                        columns: job.columns,
                        rows: job.rows,
                        data: job.data,
                    };
                    host?.invalidate();
                }
            })
            .catch(fail);
    }

    function start(): void {
        controller = new AbortController();
        const source = options.source;

        if (options.samples !== undefined) {
            compute(options.samples, options.sampleRate ?? 44100);
        } else if (typeof source === 'function') {
            source()
                .then(({ samples, sampleRate }) => compute(samples, sampleRate))
                .catch(fail);
        } else if (source !== undefined) {
            decodeAudio(source, { signal: controller.signal })
                .then(({ samples, sampleRate }) => compute(samples, sampleRate))
                .catch(fail);
        }
    }

    return {
        name: 'spectrogram',
        layer: 'under',

        setup(frame): void {
            host = frame;
        },

        draw(paint): void {
            // A frame paints only once it has pixels, so the first picture is the moment to begin.
            if (controller === null && !destroyed) {
                start();
            }

            if (spectrum !== null) {
                const key = currentMap(paint);

                if (key !== imageKey) {
                    image = paintImage(spectrum);

                    if (detail !== null) {
                        detail.image = paintImage(detail.spectrum);
                    }

                    imageKey = key;
                }
            }

            const { start: from, end: to } = paint.view;
            const { width, height } = paint;

            if (from <= 0 && to >= 1) {
                if (image !== null) {
                    paint.ctx.drawImage(image, 0, 0, width, height);
                }

                return;
            }

            if (sharp && spectrum !== null) {
                const columns = Math.min(
                    MAX_DETAIL_COLUMNS,
                    Math.max(
                        1,
                        Math.round(
                            options.detailColumns ?? width / paint.pixelRatio,
                        ),
                    ),
                );
                const key = `${from}:${to}:${columns}`;

                if (detail?.key === key && detail.image !== null) {
                    const sharpImage = detail.image;
                    paint.ctx.drawImage(
                        sharpImage,
                        0,
                        0,
                        sharpImage.width,
                        sharpImage.height,
                        0,
                        0,
                        width,
                        height,
                    );

                    return;
                }

                wantDetail(key, paint.view, columns);
            }

            // The part of the whole picture under the view.
            if (image !== null) {
                paint.ctx.drawImage(
                    image,
                    from * image.width,
                    0,
                    (to - from) * image.width,
                    image.height,
                    0,
                    0,
                    width,
                    height,
                );
            }
        },

        destroy(): void {
            destroyed = true;
            clearTimeout(detailTimer);
            detailJob?.abort();
            detailJob = null;
            audio = null;
            detail = null;
            controller?.abort();
            controller = null;
            spectrum = null;
            image = null;
            host = null;
        },
    };
}
