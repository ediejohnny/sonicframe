/**
 * The regions' labels: one line each on the frame's overlay, anchored at the region's start through
 * the view, and hidden while that start is out of view. Text only ever goes in as text.
 */

import { clamp01 } from '../core/shared/math';
import { viewX } from '../core/view/view';
import { css } from '../dom/css';
import type { PluginHost } from '../types';
import type { Region } from './region-store';

export class RegionLabels {
    /** The frame's overlay the labels sit on; a frame set up later brings its own. */
    private layer: HTMLElement | null = null;
    private readonly spans = new Map<string, HTMLElement>();

    /** Places the labels of `regions` over a sound `span` seconds long, on `frame`. */
    layout(frame: PluginHost, regions: readonly Region[], span: number): void {
        const layer = (this.layer ??= frame.overlay());

        for (const [id, node] of this.spans) {
            if (
                regions.find((region) => region.id === id)?.label === undefined
            ) {
                node.remove();
                this.spans.delete(id);
            }
        }

        for (const region of regions) {
            if (region.label === undefined) {
                continue;
            }

            let node = this.spans.get(region.id);

            if (node === undefined) {
                node = document.createElement('span');
                css(node, [
                    ['position', 'absolute'],
                    ['top', '0'],
                    ['font-size', '10px'],
                    ['padding', '0 2px'],
                    ['pointer-events', 'none'],
                    ['white-space', 'nowrap'],
                    ['overflow', 'hidden'],
                    ['max-width', '40%'],
                    ['text-overflow', 'ellipsis'],
                ]);
                layer.append(node);
                this.spans.set(region.id, node);
            }

            // Anchored at the region's start: shown while the start is in view.
            const view = frame.view;
            const at = clamp01(region.start / span);
            const left = Math.round(viewX(at, view, 100) * 1000) / 1000;
            node.textContent = region.label;
            node.style.setProperty('left', `${left}%`);
            node.style.setProperty(
                'display',
                at >= view.start && at <= view.end ? '' : 'none',
            );
        }
    }

    /** Takes the labels off, and forgets the overlay: it goes with its frame. */
    destroy(): void {
        for (const node of this.spans.values()) {
            node.remove();
        }

        this.spans.clear();
        this.layer = null;
    }
}
