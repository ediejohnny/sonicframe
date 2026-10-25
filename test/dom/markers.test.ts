/**
 * Markers on the page: a click on a marker seeks to its moment, M steps to the next, and crowded
 * markers share a tooltip. A click away from a marker still seeks normally.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { markers } from '../../src/index';
import { fakeMedia, mount, type Mounted } from './helpers';
import { sharedTooltip } from '../../src/dom/tooltip';

let mounted: Mounted | null = null;

afterEach(() => {
    sharedTooltip().hide();
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

function pointer(target: HTMLElement, type: string, clientX: number): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), {
            clientX,
            clientY: 0,
            pointerId: 1,
            isPrimary: true,
            button: 0,
            pointerType: 'mouse',
            shiftKey: false,
        }),
    );
}

describe('markers on the page', () => {
    it('seeks to a marker when it is clicked', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({
            media,
            plugins: [markers({ marks: [{ time: 10, label: 'reply' }] })],
        });

        // 10s of 40s across 200px is x = 50.
        pointer(mounted.container, 'pointerdown', 50);
        pointer(mounted.container, 'pointerup', 50);

        expect(media.currentTime).toBe(10);
    });

    it('still seeks normally when the click is away from any marker', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({
            media,
            plugins: [markers({ marks: [{ time: 10 }] })],
        });

        pointer(mounted.container, 'pointerdown', 150);
        pointer(mounted.container, 'pointerup', 150);

        expect(media.currentTime).toBe(30);
    });

    it('steps to the next marker with M', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({
            media,
            plugins: [markers({ marks: [{ time: 10 }, { time: 20 }] })],
        });

        mounted.container.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'm', bubbles: true }),
        );

        expect(media.currentTime).toBe(10);
    });

    it('shows a tooltip for crowded markers on hover', () => {
        const media = fakeMedia({ duration: 40 });
        mounted = mount({
            media,
            plugins: [markers({ marks: [{ time: 5 }, { time: 5.4 }] })],
        });

        pointer(mounted.container, 'pointermove', 26);

        expect(sharedTooltip().open).toBe(true);
        expect(sharedTooltip().element.childElementCount).toBe(2);
    });
});
