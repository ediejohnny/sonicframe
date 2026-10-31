/**
 * One picture of a clip: the wave played up to a fraction, the knob on the played edge, and the
 * caption under the wave, clipped to its strip. No user color ever goes into a gradient.
 */

import { overlayOf } from '../../core/wave/scene';
import { knobSpot } from '../../core/wave/shapes';
import type { BarStyle, WaveStyle } from '../../types';
import {
    paintKnob,
    paintWave,
    type Drawing,
    type Palette,
} from '../shared/paint';

/** The caption's strip under the wave, in pixels. */
export const CAPTION_HEIGHT = 28;

/** What every picture of a clip shows, in pixels and resolved colors. */
export type ClipScene = {
    drawing: Drawing;
    width: number;
    height: number;
    /** The wave's height: the whole height, less the caption's strip when there is a caption. */
    waveHeight: number;
    wave: WaveStyle;
    align: BarStyle['align'];
    palette: Palette;
    knob: string;
    caption: string | undefined;
};

/** Paints the picture with the sound played up to `fraction` (0..1, more counts as 1). */
export function paintClipFrame(
    ctx: CanvasRenderingContext2D,
    scene: ClipScene,
    fraction: number,
): void {
    const { width, height, waveHeight, palette, caption } = scene;
    ctx.clearRect(0, 0, width, height);
    const overlay = overlayOf(Math.min(1, fraction), null, width);
    paintWave(ctx, scene.drawing, overlay, width, waveHeight, palette);

    const spot = knobSpot(
        overlay.progress,
        width,
        waveHeight,
        scene.wave,
        scene.align,
        1,
    );

    if (spot !== null) {
        paintKnob(ctx, spot, scene.knob);
    }

    if (caption !== undefined) {
        ctx.fillStyle = palette.progress;
        ctx.font = '16px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, waveHeight, width, height - waveHeight);
        ctx.clip();
        ctx.fillText(caption, 8, waveHeight + (height - waveHeight) / 2);
        ctx.restore();
    }
}
