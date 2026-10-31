/**
 * The chapters' strip of titles over or under the wave (`lane`): one box per chapter, from its start
 * to its end through the view, cut to fit, each a click away from its chapter. The strip is hidden
 * from screen readers (`aria-hidden`).
 */

import { chapterEnds, type Chapter } from '../core/chapters/chapters';
import { clamp01 } from '../core/shared/math';
import { viewX } from '../core/view/view';
import { css } from '../dom/css';
import { remPixels } from '../dom/units';
import type { Lane, PluginHost, SeekSource } from '../types';

/** What the strip needs from its plugin. */
export type LaneHost = {
    /** The frame, while the plugin is set up. */
    frame(): PluginHost | null;
    /** The sound's length, in seconds, or null while it is not known. */
    duration(): number | null;
    /** The chapters shown, in order. */
    shown(): readonly Chapter[];
    /** A chapter's place and title, said and shown when it has no title. */
    label(at: number): string;
    go(at: number, source: SeekSource): boolean;
};

export class ChapterLane {
    private readonly lane: Lane;

    /** Adds the strip on `side` of `frame`, `height` rem tall, each box's edge in `color`. */
    constructor(
        frame: PluginHost,
        side: 'above' | 'below',
        private readonly height: number,
        private readonly color: string,
        private readonly host: LaneHost,
    ) {
        this.lane = frame.addLane(side, remPixels(height));
        this.lane.element.setAttribute('aria-hidden', 'true');
        css(this.lane.element, [['overflow', 'hidden']]);
    }

    /** Lays the boxes out again: the chapters, the view or the size changed. */
    place(): void {
        const current = this.host.frame();

        if (current === null) {
            return;
        }

        const element = this.lane.element;
        const known = this.host.duration();
        const geometry = current.geometry;
        element.replaceChildren();

        if (known === null || geometry === null) {
            return;
        }

        const shown = this.host.shown();
        const width = geometry.width / geometry.pixelRatio;
        const view = current.view;
        const ends = chapterEnds(shown, known);

        shown.forEach((chapter, at) => {
            const from = viewX(clamp01(chapter.start / known), view, width);
            const to = viewX(clamp01((ends[at] ?? known) / known), view, width);
            const left = Math.max(0, from);
            const right = Math.min(width, to);

            if (right - left < 1) {
                return;
            }

            const box = document.createElement('span');
            box.className = 'sonicframe-chapter-name';
            box.textContent =
                chapter.title === '' ? this.host.label(at) : chapter.title;
            box.setAttribute('dir', 'auto');
            css(box, [
                ['position', 'absolute'],
                ['top', '0'],
                ['bottom', '0'],
                ['left', `${left}px`],
                ['width', `${right - left}px`],
                ['box-sizing', 'border-box'],
                ['padding', '0 0.25rem'],
                ['overflow', 'hidden'],
                ['white-space', 'nowrap'],
                ['text-overflow', 'ellipsis'],
                ['border-left-style', 'solid'],
                ['border-left-width', '1px'],
                ['border-left-color', this.color],
                ['font-size', '0.75rem'],
                ['line-height', `${this.height}rem`],
                ['cursor', 'pointer'],
                ['pointer-events', 'auto'],
            ]);
            box.addEventListener('click', () => this.host.go(at, 'pointer'));
            element.append(box);
        });
    }

    remove(): void {
        this.lane.remove();
    }
}
