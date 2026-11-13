/**
 * A frame's picture. The wave is shaped from the peaks: one value per bar across the width, or,
 * zoomed in, the bars of the view from the peaks' pyramid; live values (a spectrum) take the peaks'
 * place while they last. New peaks grow in, unless the person asked for less motion. Each picture
 * paints the plugins' `under` layer, the wave, their `over` layer, then the cursor and the knob. A
 * drawing without its peaks yet shows a thin line; the track needs none.
 */

import { barValues, buildDetail, type Detail } from '../../core/peaks/detail';
import { resample } from '../../core/peaks/peaks';
import { easeOut } from '../../core/shared/timing';
import type { View } from '../../core/view/view';
import { barMetrics, barWindow } from '../../core/wave/layout';
import type { Overlay } from '../../core/wave/scene';
import { knobSpot, waveShape } from '../../core/wave/shapes';
import type { BarStyle, PaintContext, WaveStyle } from '../../types';
import type { Size } from '../shared/observe';
import {
    drawingOf,
    linePath,
    paintCursor,
    paintKnob,
    paintWave,
    type Drawing,
    type Palette,
} from '../shared/paint';
import type { PluginSet } from './plugin-set';

/** How long the bars take to grow in, in milliseconds. */
const APPEAR_MS = 180;

/** What a picture is drawn from. */
export type Scene = {
    size: Size;
    /** The peaks, 0..1, or null while there are none. */
    peaks: readonly number[] | null;
    /** Live values drawn in the peaks' place, or null. */
    override: readonly number[] | null;
    view: View;
    bar: BarStyle;
    wave: WaveStyle;
    /** The cursor line's width, in CSS pixels. */
    cursorWidth: number;
};

export class FramePicture {
    private drawing: Drawing | null = null;
    /** One value per bar across the width, measured from the peaks or the live values. */
    private values: number[] | null = null;
    /** The peaks' pyramid, built the first time the frame draws zoomed in. */
    private detail: Detail | null = null;
    /** When the bars started growing in: -1 waits for the next animation frame, null means not growing. */
    private appear: number | null = null;

    /** Whether the bars are growing in: every animation frame shapes them again. */
    get growing(): boolean {
        return this.appear !== null;
    }

    /**
     * New peaks came (or went): what was measured from the old ones goes, and `grow` lets them grow
     * in; `'keep'` leaves the bars as they are, growing on only if they were growing.
     */
    newPeaks(grow: boolean | 'keep'): void {
        this.values = null;
        this.detail = null;

        if (grow !== 'keep') {
            this.appear = grow ? -1 : null;
        }
    }

    /** The live values changed: the values per bar are measured again. */
    newValues(): void {
        this.values = null;
    }

    /** Shapes the wave for `scene`, at the animation frame's time `now` (for bars growing in). */
    shape(scene: Scene, now: number): void {
        const { size, bar, wave, override } = scene;
        const { width, height, pixelRatio } = size;
        const source = override ?? scene.peaks;

        // The track needs no peaks; every other drawing shows a thin line until they arrive.
        if (source === null && wave.style !== 'track') {
            this.drawing = {
                path: linePath(width, height, pixelRatio, bar.align),
                mode: 'fill',
                lineWidth: 1,
                glow: 0,
            };

            return;
        }

        const view = scene.view;
        const zoomed = override === null && (view.start > 0 || view.end < 1);
        const window = zoomed
            ? barWindow(width, view, bar, pixelRatio)
            : undefined;
        let values: number[];

        // Zoomed in, the bars of the view come from the peaks' pyramid; live values and the whole
        // sound keep one value per bar across the width.
        if (window !== undefined && scene.peaks !== null) {
            this.detail ??= buildDetail(scene.peaks);
            values = barValues(
                this.detail,
                window.total,
                window.first,
                window.count,
            );
        } else {
            const count = barMetrics(width, bar, pixelRatio).count;

            if (
                source !== null &&
                (this.values === null || this.values.length !== count)
            ) {
                this.values = resample(source, count);
            }

            values = source === null ? [] : (this.values ?? []);
        }

        if (this.appear !== null) {
            if (this.appear < 0) {
                this.appear = now;
            }

            const grown = (now - this.appear) / APPEAR_MS;

            if (grown >= 1) {
                this.appear = null;
            } else {
                const scale = easeOut(grown);
                values = values.map((value) => value * scale);
            }
        }

        this.drawing = drawingOf(
            waveShape(values, width, height, bar, wave, pixelRatio, window),
            Math.round(wave.glow * pixelRatio),
        );
    }

    /** Paints the picture: the plugins under the wave, the wave, the plugins over it, the cursor, the knob. */
    paint(
        paint: PaintContext,
        scene: Scene,
        overlay: Overlay,
        palette: Palette,
        plugins: PluginSet,
    ): void {
        const { ctx } = paint;
        const { width, height, pixelRatio } = scene.size;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        plugins.draw('under', paint);

        if (this.drawing !== null) {
            paintWave(ctx, this.drawing, overlay, width, height, palette);
        }

        plugins.draw('over', paint);

        if (overlay.offscreen === true) {
            return;
        }

        if (palette.cursor !== null) {
            paintCursor(
                ctx,
                overlay.progress,
                Math.max(1, Math.round(scene.cursorWidth * pixelRatio)),
                width,
                height,
                palette.cursor,
            );
        }

        const spot = knobSpot(
            overlay.progress,
            width,
            height,
            scene.wave,
            scene.bar.align,
            pixelRatio,
        );

        if (spot !== null) {
            paintKnob(ctx, spot, palette.knob ?? palette.progress);
        }
    }
}
