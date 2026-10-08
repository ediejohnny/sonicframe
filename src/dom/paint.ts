/**
 * Drawing on the canvas. The bars become one cached path; every strip (played, hover, not played) is
 * the same path filled through its own clip, so strips never overlap and edges never bleed.
 */

import { rgbaFromBytes, type Rgba } from '../core/color';
import type { Bar } from '../core/layout';
import { cursorSpan, regions, type Overlay } from '../core/scene';

/** Colors ready for the canvas: variables already resolved. */
export type Palette = {
    wave: string;
    progress: string;
    hover: string | null;
    cursor: string | null;
};

function roundedRect(path: Path2D, bar: Bar): void {
    const { x, y, width, height, radius } = bar;

    path.moveTo(x + radius, y);
    path.arcTo(x + width, y, x + width, y + height, radius);
    path.arcTo(x + width, y + height, x, y + height, radius);
    path.arcTo(x, y + height, x, y, radius);
    path.arcTo(x, y, x + width, y, radius);
    path.closePath();
}

export function barsPath(bars: readonly Bar[]): Path2D {
    const path = new Path2D();
    const native = typeof path.roundRect === 'function';

    for (const bar of bars) {
        if (bar.radius <= 0) {
            path.rect(bar.x, bar.y, bar.width, bar.height);
        } else if (native) {
            path.roundRect(bar.x, bar.y, bar.width, bar.height, bar.radius);
        } else {
            roundedRect(path, bar);
        }
    }

    return path;
}

/** The thin line drawn while there are no peaks yet; it takes the played color like the bars. */
export function linePath(
    width: number,
    height: number,
    pixelRatio: number,
    align: 'center' | 'bottom',
): Path2D {
    const path = new Path2D();
    const thickness = Math.min(height, Math.max(1, Math.round(pixelRatio)));
    const y =
        align === 'bottom'
            ? height - thickness
            : Math.floor((height - thickness) / 2);

    path.rect(0, y, width, thickness);

    return path;
}

export function paintBars(
    ctx: CanvasRenderingContext2D,
    path: Path2D,
    overlay: Overlay,
    width: number,
    height: number,
    palette: Palette,
): void {
    const shown =
        palette.hover === null ? { ...overlay, hover: null } : overlay;

    for (const region of regions(shown, width)) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(region.from, 0, region.to - region.from, height);
        ctx.clip();
        ctx.fillStyle =
            region.kind === 'progress'
                ? palette.progress
                : region.kind === 'hover'
                  ? (palette.hover ?? palette.wave)
                  : palette.wave;
        ctx.fill(path);
        ctx.restore();
    }
}

export function paintCursor(
    ctx: CanvasRenderingContext2D,
    progress: number,
    size: number,
    width: number,
    height: number,
    color: string,
): void {
    const span = cursorSpan(progress, size, width);

    if (span.width > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(span.x, 0, span.width, height);
    }
}

let probe: CanvasRenderingContext2D | null | undefined;

/** Any CSS color the canvas understands, as numbers (read back from one pixel); null if unreadable. */
export function readColor(color: string): Rgba | null {
    if (probe === undefined) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        probe = canvas.getContext('2d', { willReadFrequently: true });
    }

    if (probe === null || color === '') {
        return null;
    }

    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);

    return rgbaFromBytes(probe.getImageData(0, 0, 1, 1).data);
}
