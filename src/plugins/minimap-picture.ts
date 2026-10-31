/**
 * The minimap's picture: a canvas with the whole sound's wave, the played part and a box over the
 * part in view. The wave's drawing is kept until the canvas size or the peaks change.
 */

import { resample } from '../core/peaks/peaks';
import { isFullView } from '../core/view/view';
import { barMetrics } from '../core/wave/layout';
import { overlayOf } from '../core/wave/scene';
import { waveShape } from '../core/wave/shapes';
import { css } from '../dom/css';
import { drawingOf, paintWave, type Drawing } from '../dom/paint';
import type { BarStyle, PaintContext, WaveStyle } from '../types';

/** How the strip draws: its height in CSS pixels, the wave, the colors and whether the played part shows. */
export type MinimapLook = {
    height: number;
    wave: WaveStyle;
    bar: BarStyle;
    colors: { wave: string; progress: string; view: string; edge: string };
    progress: boolean;
};

export class MinimapPicture {
    readonly canvas: HTMLCanvasElement = document.createElement('canvas');
    /** The wave's drawing and what it was made for: the canvas size and the peaks. */
    private kept: {
        width: number;
        height: number;
        peaks: readonly number[] | null;
        drawing: Drawing;
    } | null = null;

    /** A canvas `look.height` tall, `gap` CSS pixels from the wave on `side`; hidden from screen readers. */
    constructor(
        private readonly look: MinimapLook,
        side: 'above' | 'below',
        gap: number,
    ) {
        css(this.canvas, [
            ['display', 'block'],
            ['width', '100%'],
            ['height', `${look.height}px`],
            [side === 'below' ? 'margin-top' : 'margin-bottom', `${gap}px`],
        ]);
        this.canvas.setAttribute('aria-hidden', 'true');
    }

    paint(paint: PaintContext, peaks: readonly number[] | null): void {
        const canvas = this.canvas;
        const context = canvas.getContext('2d');

        if (context === null) {
            return;
        }

        const { wave, bar, colors } = this.look;
        const ratio = paint.pixelRatio;
        const width = paint.width;
        const tall = Math.max(1, Math.round(this.look.height * ratio));

        if (canvas.width !== width || canvas.height !== tall) {
            canvas.width = width;
            canvas.height = tall;
        }

        let kept = this.kept;

        if (
            kept === null ||
            kept.width !== width ||
            kept.height !== tall ||
            kept.peaks !== peaks
        ) {
            const values =
                peaks === null
                    ? []
                    : resample(peaks, barMetrics(width, bar, ratio).count);
            kept = this.kept = {
                width,
                height: tall,
                peaks,
                drawing: drawingOf(
                    waveShape(values, width, tall, bar, wave, ratio),
                    Math.round(wave.glow * ratio),
                ),
            };
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, tall);
        paintWave(
            context,
            kept.drawing,
            overlayOf(this.look.progress ? paint.progress : 0, null, width),
            width,
            tall,
            {
                wave: paint.color(colors.wave),
                progress: paint.color(colors.progress),
                hover: null,
                cursor: null,
            },
        );

        const view = paint.view;

        if (isFullView(view)) {
            return;
        }

        const from = Math.round(view.start * width);
        const to = Math.max(from + 1, Math.round(view.end * width));
        const edge = Math.max(1, Math.round(ratio));
        context.fillStyle = paint.color(colors.view);
        context.fillRect(from, 0, to - from, tall);
        context.fillStyle = paint.color(colors.edge);
        context.fillRect(from, 0, edge, tall);
        context.fillRect(to - edge, 0, edge, tall);
    }
}
