/**
 * Markers on the page: a click on a marker seeks to its moment, M steps to the next, and crowded
 * markers share a tooltip. A click away from a marker still seeks normally.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { sharedTooltip } from '../../../src/dom/shared/tooltip';
import { markers, type MarkersOptions } from '../../../src/index';
import type { PluginHost } from '../../../src/types';
import { firePointer, playTo, pressKey } from '../../support/events';
import {
    fakeMedia,
    mount,
    mountShown,
    repainted,
    tooltipTextOnPale,
    type Mounted,
} from '../../support/helpers';

afterEach(() => {
    sharedTooltip().hide();
});

/** A frame of a 40-second sound with markers at 10, 20 and 30 s, and its media. */
function marked(
    options: MarkersOptions = {},
): Mounted & { media: ReturnType<typeof fakeMedia> } {
    const media = fakeMedia({ duration: 40 });
    const mounted = mount({
        media,
        plugins: [
            markers({
                marks: [{ time: 10 }, { time: 20 }, { time: 30 }],
                ...options,
            }),
        ],
    });

    return { ...mounted, media };
}

/** The lines of the tooltip over two markers 2 px apart (5 s and 5.4 s of 40 s, across 200 px). */
function crowdedLines(options: MarkersOptions = {}): number {
    const { container } = mount({
        media: fakeMedia({ duration: 40 }),
        plugins: [markers({ marks: [{ time: 5 }, { time: 5.4 }], ...options })],
    });
    firePointer(container, 'pointermove', 26);

    return sharedTooltip().element.childElementCount;
}

describe('markers on the page', () => {
    it('seeks to a marker when it is clicked', () => {
        const media = fakeMedia({ duration: 40 });
        const { container } = mount({
            media,
            plugins: [markers({ marks: [{ time: 10, label: 'reply' }] })],
        });

        // 10s of 40s across 200px is x = 50.
        firePointer(container, 'pointerdown', 50);
        firePointer(container, 'pointerup', 50);

        expect(media.currentTime).toBe(10);
    });

    it('still seeks normally when the click is away from any marker', () => {
        const media = fakeMedia({ duration: 40 });
        const { container } = mount({
            media,
            plugins: [markers({ marks: [{ time: 10 }] })],
        });

        firePointer(container, 'pointerdown', 150);
        firePointer(container, 'pointerup', 150);

        expect(media.currentTime).toBe(30);
    });

    it('steps to the next marker with M', () => {
        const { container, media } = marked();

        pressKey(container, 'm');

        expect(media.currentTime).toBe(10);
    });

    it('goes by the Shift key, not the letter case, so Caps Lock changes nothing', () => {
        const { container, media } = marked();

        pressKey(container, 'M');
        pressKey(container, 'M');
        expect(media.currentTime).toBe(20);

        pressKey(container, 'm', { shiftKey: true });
        expect(media.currentTime).toBe(10);
    });

    it('goes back past a marker left less than a second ago, else to its start', () => {
        const { container, media } = marked();

        playTo(media, 20.5);
        pressKey(container, 'm', { shiftKey: true });
        expect(media.currentTime).toBe(10);

        playTo(media, 25);
        pressKey(container, 'm', { shiftKey: true });
        expect(media.currentTime).toBe(20);
    });

    it('lands on the marker just left when backGrace is 0', () => {
        const { container, media } = marked({ backGrace: 0 });

        playTo(media, 20.5);
        pressKey(container, 'm', { shiftKey: true });
        expect(media.currentTime).toBe(20);
    });

    it('shows a tooltip for crowded markers on hover', () => {
        expect(crowdedLines()).toBe(2);
        expect(sharedTooltip().open).toBe(true);
    });

    it('groups markers by the usual 12 px when group is not a number', () => {
        for (const group of [Number.NaN, '0' as unknown as number]) {
            expect(crowdedLines({ group })).toBe(2);
        }
    });

    it("writes the tooltip in the page's color for text on the played color, or in black or white that reads when asked", () => {
        const hovered = (options: MarkersOptions): string => {
            const { container } = mount({
                media: fakeMedia({ duration: 40 }),
                plugins: [markers({ marks: [{ time: 5 }], ...options })],
            });

            return tooltipTextOnPale(container, () =>
                firePointer(container, 'pointermove', 25),
            );
        };

        expect(hovered({})).toBe('#ffffff');
        expect(hovered({ a11y: { tooltip: { readable: true } } })).toBe(
            'rgba(0, 0, 0, 1)',
        );
    });
});

describe('the line of a marker', () => {
    it('is the usual 2 pixels wide when the width is not a number', async () => {
        for (const width of [Number.NaN, '6' as unknown as number]) {
            const shown = mountShown({
                media: fakeMedia({ duration: 40 }),
                plugins: [markers({ times: [20], color: 'red', width })],
            });

            expect(
                (await repainted(shown, 'red')).map((box) => box.width),
            ).toEqual([2]);
        }
    });
});

describe('markers plugin', () => {
    it('asks its frame for a new picture when the moments change', () => {
        let invalidated = 0;
        const plugin = markers({ times: [1] });
        plugin.setup?.({
            invalidate: () => invalidated++,
        } as unknown as PluginHost);

        plugin.set([2, 3]);

        expect(plugin.times).toEqual([2, 3]);
        expect(invalidated).toBe(1);
    });

    it('keeps every marker when max is not a number', () => {
        const times = [5, 10, 15];

        expect(markers({ times, max: Number.NaN }).times).toEqual(times);
        expect(markers({ times, max: '2' as unknown as number }).times).toEqual(
            times,
        );
    });
});
