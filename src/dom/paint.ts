/**
 * Drawing on the canvas. The wave becomes one cached path; every strip (played, hover, not played) is
 * the same path filled or stroked through its own clip, so strips never overlap and edges never bleed.
 */

import { rgbaFromBytes, type Rgba } from '../core/color';
import type { Bar } from '../core/layout';
import { cursorSpan, regions, type Overlay } from '../core/scene';
import type { Circle, Polyline, WaveShape } from '../core/shapes';

/** Colors ready for the canvas: variables already resolved. */
export type Palette = {
    wave: string;
    progress: string;
    hover: string | null;
    cursor: string | null;
    /** The unplayed color while hovered, or null to keep `wave`. */
    waveHover?: string | null;
    /** The played color while hovered, or null to keep `progress`. */
    progressHover?: string | null;
    /** The dot riding the playing position, or null to take `progress`. */
    knob?: string | null;
};

/** A wave ready to paint: its cached path and how to put it on the canvas (device pixels). */
export type Drawing = {
    path: Path2D;
    mode: 'fill' | 'stroke';
    lineWidth: number;
    glow: number;
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

export function barsPath(
    bars: readonly Bar[],
    path: Path2D = new Path2D(),
): Path2D {
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

function addCircles(path: Path2D, circles: readonly Circle[]): void {
    for (const circle of circles) {
        path.moveTo(circle.x + circle.radius, circle.y);
        path.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
    }
}

/** A run of points, with corners or curved through the midpoints between them (never past them). */
function addLine(path: Path2D, line: Polyline, smooth: boolean): void {
    const { points } = line;
    const count = points.length / 2;

    if (count < 2) {
        return;
    }

    path.moveTo(points[0], points[1]);

    if (smooth && count > 2) {
        for (let index = 1; index < count - 1; index++) {
            const x = points[index * 2];
            const y = points[index * 2 + 1];
            path.quadraticCurveTo(
                x,
                y,
                (x + points[index * 2 + 2]) / 2,
                (y + points[index * 2 + 3]) / 2,
            );
        }
    }

    for (
        let index = smooth && count > 2 ? count - 1 : 1;
        index < count;
        index++
    ) {
        path.lineTo(points[index * 2], points[index * 2 + 1]);
    }

    if (line.closed) {
        path.closePath();
    }
}

/** Turns a shape into one path, with its glow in device pixels. */
export function drawingOf(shape: WaveShape, glow: number): Drawing {
    const path = barsPath(shape.rects);
    addCircles(path, shape.circles);

    for (const line of shape.lines) {
        addLine(path, line, shape.smooth);
    }

    return { path, mode: shape.mode, lineWidth: shape.lineWidth, glow };
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

export function paintWave(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    overlay: Overlay,
    width: number,
    height: number,
    palette: Palette,
): void {
    const shown =
        palette.hover === null ? { ...overlay, hover: null } : overlay;
    const hovered = overlay.hovered ?? false;
    const progress =
        hovered && palette.progressHover != null
            ? palette.progressHover
            : palette.progress;
    const wave =
        hovered && palette.waveHover != null ? palette.waveHover : palette.wave;

    for (const region of regions(shown, width)) {
        const color =
            region.kind === 'progress'
                ? progress
                : region.kind === 'hover'
                  ? (palette.hover ?? wave)
                  : wave;

        ctx.save();
        ctx.beginPath();
        ctx.rect(region.from, 0, region.to - region.from, height);
        ctx.clip();

        if (drawing.glow > 0) {
            ctx.shadowBlur = drawing.glow;
            ctx.shadowColor = color;
        }

        if (drawing.mode === 'stroke') {
            ctx.lineWidth = drawing.lineWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.strokeStyle = color;
            ctx.stroke(drawing.path);
        } else {
            ctx.fillStyle = color;
            ctx.fill(drawing.path);
        }

        ctx.restore();
    }
}

/** The dot riding the playing position. */
export function paintKnob(
    ctx: CanvasRenderingContext2D,
    spot: Circle,
    color: string,
): void {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
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
