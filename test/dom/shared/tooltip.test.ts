/**
 * The page's one tooltip, placed against what it describes and kept inside the room the page shows.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { sharedTooltip } from '../../../src/dom/shared/tooltip';
import { boxOf } from '../../support/helpers';

const COLORS = { background: '#2f6fdb', text: '#ffffff' };

let anchor: HTMLElement | null = null;

afterEach(() => {
    sharedTooltip().hide();
    anchor?.remove();
    anchor = null;
    vi.restoreAllMocks();
});

/** An element at the page's right edge, with a 200 × 40 tooltip to place over it. */
function edgeAnchor(): HTMLElement {
    anchor = document.createElement('span');
    document.body.append(anchor);
    boxOf(anchor, { left: 1000, top: 300, width: 20, height: 10 });
    boxOf(sharedTooltip().element, { left: 0, top: 0, width: 200, height: 40 });

    return anchor;
}

describe('the shared tooltip', () => {
    it("keeps clear of the page's scrollbar", () => {
        // A 16 px scrollbar: the page shows 1008 of the window's 1024 pixels.
        vi.spyOn(
            document.documentElement,
            'clientWidth',
            'get',
        ).mockReturnValue(1008);
        sharedTooltip().show(edgeAnchor(), ['Interview'], COLORS);

        // Its right edge 8 px (the margin) inside the page: 1008 - 8 - 200.
        expect(sharedTooltip().element.style.getPropertyValue('left')).toBe(
            '800px',
        );
    });

    it("keeps clear of the page's bottom scrollbar", () => {
        // A 16 px scrollbar under the page: it shows 752 of the window's 768 pixels.
        vi.spyOn(
            document.documentElement,
            'clientHeight',
            'get',
        ).mockReturnValue(752);
        const tall = edgeAnchor();
        boxOf(tall, { left: 400, top: 20, width: 20, height: 690 });
        sharedTooltip().show(tall, ['Interview'], COLORS);

        // No room above, so under the anchor, its bottom edge 8 px inside the page: 752 - 8 - 40.
        expect(sharedTooltip().element.style.getPropertyValue('top')).toBe(
            '704px',
        );
    });
});
