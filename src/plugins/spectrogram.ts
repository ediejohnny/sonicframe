/**
 * A spectrogram under the bars. The heavy maths are pure and resumable (`createSpectrogram`); here
 * the samples are decoded (from the page's audio, with no user gesture) or taken ready-made, the job
 * runs in short slices so the page never freezes, and the result is drawn once into a small canvas
 * and scaled onto the frame. Colors only ever land in an `ImageData`.
 */

import { colormap, type ColormapName } from '../core/colormap';
import {
    createSpectrogram,
    type SpectrogramOptions,
} from '../core/spectrogram';
import { decodeAudio } from '../dom/decode';
import { runChunked } from '../dom/chunked';
import type { Plugin, PluginHost } from '../types';

export type SpectrogramPluginOptions = SpectrogramOptions & {
    /** Ready-made mono samples (skip decoding). */
    samples?: Float32Array;
    /** The sample rate of `samples`. */
    sampleRate?: number;
    /** A URL or blob to decode instead. */
    source?: string | Blob;
    /** The color map. */
    map?: ColormapName;
};

export function spectrogram(options: SpectrogramPluginOptions = {}): Plugin {
    const map = colormap(options.map ?? 'magma');

    let host: PluginHost | null = null;
    let image: HTMLCanvasElement | null = null;
    // One signal for the download, the decode and the slices: destroy() stops whichever is running.
    let controller: AbortController | null = null;
    let destroyed = false;

    function paintImage(columns: number, rows: number, data: Uint8Array): void {
        if (destroyed) {
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = columns;
        canvas.height = rows;
        const context = canvas.getContext('2d');

        if (context === null) {
            return;
        }

        const picture = context.createImageData(columns, rows);

        for (let i = 0; i < data.length; i++) {
            const value = data[i];
            picture.data[i * 4] = map[value * 3];
            picture.data[i * 4 + 1] = map[value * 3 + 1];
            picture.data[i * 4 + 2] = map[value * 3 + 2];
            picture.data[i * 4 + 3] = 255;
        }

        context.putImageData(picture, 0, 0);
        image = canvas;
        host?.invalidate();
    }

    function compute(samples: Float32Array, sampleRate: number): void {
        if (destroyed || controller === null) {
            return;
        }

        const job = createSpectrogram(samples, sampleRate, options);
        runChunked(job, { signal: controller.signal })
            .then(() => paintImage(job.columns, job.rows, job.data))
            .catch((error: unknown) => {
                if (!(error instanceof DOMException)) {
                    host?.invalidate();
                    throw error;
                }
            });
    }

    function start(): void {
        controller = new AbortController();

        if (options.samples !== undefined) {
            compute(options.samples, options.sampleRate ?? 44100);
        } else if (options.source !== undefined) {
            decodeAudio(options.source, { signal: controller.signal }).then(
                ({ samples, sampleRate }) => compute(samples, sampleRate),
                () => undefined,
            );
        }
    }

    return {
        name: 'spectrogram',
        layer: 'under',

        setup(frame): void {
            host = frame;
            start();
        },

        draw(paint): void {
            if (image !== null) {
                paint.ctx.drawImage(image, 0, 0, paint.width, paint.height);
            }
        },

        destroy(): void {
            destroyed = true;
            controller?.abort();
            controller = null;
            image = null;
            host = null;
        },
    };
}
