/**
 * The drawings made of pieces, as pure geometry in device pixels: the track's rail, the needles,
 * and the blocks and dots, whose number is capped.
 */

import type { BarStyle } from '../../types';
import type { Bar } from './layout';

/** The most blocks or dots one drawing makes; past it the cells grow taller. */
export const MAX_CELLS = 20000;

/** A circle, in device pixels. */
export type Circle = { x: number; y: number; radius: number };

/** One rail across the whole width, as thick as the line, with round ends. */
export function rail(
    width: number,
    height: number,
    thickness: number,
    align: BarStyle['align'],
): Bar {
    const tall = Math.min(height, thickness);

    return {
        x: 0,
        y: align === 'bottom' ? height - tall : Math.round((height - tall) / 2),
        width,
        height: tall,
        radius: Math.floor(tall / 2),
    };
}

/** Each bar thinned to one CSS pixel, centered in its place. */
export function needles(bars: readonly Bar[], ratio: number): Bar[] {
    const thin = Math.max(1, Math.round(ratio));

    return bars.map((bar) => {
        const width = Math.min(bar.width, thin);

        return {
            x: bar.x + Math.floor((bar.width - width) / 2),
            y: bar.y,
            width,
            height: bar.height,
            radius: 0,
        };
    });
}

/** Each bar as a column of square cells (blocks) or round ones (dots), as tall as the bar. */
export function cells(
    bars: readonly Bar[],
    height: number,
    bar: BarStyle,
    ratio: number,
    style: 'blocks' | 'dots',
): { rects: Bar[]; circles: Circle[] } {
    const shape: { rects: Bar[]; circles: Circle[] } = {
        rects: [],
        circles: [],
    };
    const gap = Math.max(1, Math.round((bar.gap > 0 ? bar.gap : 1) * ratio));
    let size = Math.max(1, Math.round(bar.width * ratio));
    let fit = Math.floor((height + gap) / (size + gap));

    // Past the cap the cells grow taller, so a huge frame never makes millions of pieces.
    while (fit > 1 && bars.length * fit > MAX_CELLS) {
        size *= 2;
        fit = Math.floor((height + gap) / (size + gap));
    }

    fit = Math.max(1, fit);
    size = Math.min(size, height);

    for (const column of bars) {
        const count = Math.min(
            fit,
            Math.max(1, Math.round((column.height + gap) / (size + gap))),
        );
        const tall = count * size + (count - 1) * gap;
        const top =
            bar.align === 'bottom'
                ? height - tall
                : Math.round((height - tall) / 2);

        for (let index = 0; index < count; index++) {
            const y = top + index * (size + gap);

            if (style === 'dots') {
                shape.circles.push({
                    x: column.x + column.width / 2,
                    y: y + size / 2,
                    radius: Math.min(column.width, size) / 2,
                });
            } else {
                shape.rects.push({
                    x: column.x,
                    y,
                    width: column.width,
                    height: size,
                    radius: Math.max(
                        0,
                        Math.min(
                            Math.round(bar.radius * ratio),
                            Math.floor(Math.min(column.width, size) / 2),
                        ),
                    ),
                });
            }
        }
    }

    return shape;
}
