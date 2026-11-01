/**
 * The lines where the chapters start, drawn over the wave (`lines`), with the chapter's place and
 * title in the shared tooltip under the mouse (`tooltip`) and a click on a line that goes to its
 * chapter (`snap`). A chapter that starts with the sound, at 0, has no line.
 */

import type { Chapter } from '../../core/chapters/chapters';
import { clamp01, positive } from '../../core/shared/math';
import { formatTime } from '../../core/shared/timing';
import { FULL_VIEW, viewX } from '../../core/view/view';
import {
    sharedTooltip,
    tooltipColors,
    type TooltipA11y,
} from '../../dom/shared/tooltip';
import type { PaintContext, WavePoint } from '../../types';
import type { LaneHost } from './chapter-lane';

/** Over this many CSS pixels from a line, the pointer is not on it. */
const SLOP = 6;

/** How the lines are drawn and what they answer. */
export type LinesSettings = {
    lines: boolean;
    /** Any CSS color or `var(--name)`. */
    color: string;
    /** In CSS pixels. */
    width: number;
    tooltip: boolean;
    snap: boolean;
    a11y: TooltipA11y | undefined;
};

export class ChapterLines {
    /** Whether the shared tooltip shows a line's chapter now. */
    private openedTooltip = false;

    constructor(
        private readonly host: LaneHost,
        private readonly settings: LinesSettings,
    ) {}

    draw(paint: PaintContext): void {
        const known = positive(paint.duration);

        if (!this.settings.lines || known === null || paint.width <= 0) {
            return;
        }

        const lineWidth = Math.max(
            1,
            Math.round(this.settings.width * paint.pixelRatio),
        );
        paint.ctx.fillStyle = paint.color(this.settings.color);

        for (const chapter of this.host.shown()) {
            if (chapter.start <= 0 || chapter.start >= known) {
                continue;
            }

            const x = paint.xAt(chapter.start / known);

            if (x < 0 || x > paint.width) {
                continue;
            }

            paint.ctx.fillRect(
                Math.min(
                    paint.width - lineWidth,
                    Math.max(0, Math.round(x - lineWidth / 2)),
                ),
                0,
                lineWidth,
                paint.height,
            );
        }
    }

    /** The mouse over the wave: a line's chapter in the tooltip, and the hand a click would use. */
    hover(point: WavePoint | null): string | void {
        const current = this.host.frame();
        const at = point === null ? -1 : this.lineAt(point);

        if (at < 0 || current === null) {
            this.close();

            return;
        }

        if (this.settings.tooltip) {
            const chapter: Chapter = this.host.shown()[at];
            sharedTooltip().show(
                current.container,
                [`${formatTime(chapter.start)} · ${this.host.label(at)}`],
                tooltipColors(current, this.settings.a11y),
            );
            this.openedTooltip = true;
        }

        return this.settings.snap ? 'pointer' : undefined;
    }

    /** A press on a line is the plugin's, when a click goes to its chapter. */
    down(point: WavePoint): 'take' | void {
        return this.settings.snap && this.lineAt(point) >= 0
            ? 'take'
            : undefined;
    }

    up(point: WavePoint): void {
        const at = this.lineAt(point);

        if (at >= 0) {
            this.host.go(at, 'pointer');
        }
    }

    /** Hides the tooltip, when it shows a line's chapter. */
    close(): void {
        if (this.openedTooltip) {
            sharedTooltip().hide();
            this.openedTooltip = false;
        }
    }

    /** The chapter whose line is under the pointer, or -1. */
    private lineAt(point: WavePoint): number {
        const known = this.host.duration();

        if (!this.settings.lines || known === null) {
            return -1;
        }

        const view = this.host.frame()?.view ?? FULL_VIEW;
        let best = -1;
        let distance = SLOP;

        this.host.shown().forEach((chapter, at) => {
            if (chapter.start <= 0) {
                return;
            }

            const x = viewX(clamp01(chapter.start / known), view, point.width);
            const away = Math.abs(x - point.x);

            if (away <= distance) {
                best = at;
                distance = away;
            }
        });

        return best;
    }
}
