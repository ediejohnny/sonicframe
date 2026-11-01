/**
 * The timeline on the page: once the frame has a size and a duration, a lane fills with labelled
 * ticks on round seconds.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    timeline,
    type SonicFrameOptions,
    type TimelineOptions,
} from '../../../src/index';
import { fakeMedia, mountShown, type Mounted } from '../../support/helpers';

/** A 300 × 40 frame with a timeline, sized and on screen. */
function ruled(
    options: Partial<SonicFrameOptions>,
    ruler: TimelineOptions = {},
): Mounted {
    return mountShown(
        { ...options, plugins: [timeline(ruler)] },
        { left: 0, top: 0, width: 300, height: 40 },
    );
}

describe('the timeline plugin', () => {
    it('lays out labelled ticks once sized', () => {
        const { container } = ruled({
            media: fakeMedia({ duration: 60 }),
            lazy: false,
        });

        expect(container.textContent).toContain('0:10');
    });

    it('fills the ruler of a lazy frame sized far from the screen once it comes near', () => {
        const { container } = ruled({ media: fakeMedia({ duration: 60 }) });

        expect(container.textContent).toContain('0:10');
    });

    it('redraws the ruler when the duration changes while the position stays put', () => {
        const { container, frame } = ruled({ duration: 60, lazy: false });

        frame.setDuration(600);

        expect(container.textContent).toContain('10:00');
        expect(container.textContent).not.toContain('0:50');
    });

    it('keeps its usual 14 px lane and labels 48 px apart when size or minSpacing is not a number', () => {
        for (const odd of [Number.NaN, '200' as unknown as number]) {
            const { canvas, container } = ruled(
                { media: fakeMedia({ duration: 60 }), lazy: false },
                { size: odd, minSpacing: odd },
            );

            expect(canvas.style.getPropertyValue('height')).toBe(
                'calc(100% - 14px)',
            );
            expect(container.textContent).toContain('0:10');
        }
    });

    it('takes its height in pixels or written with its unit over the old size, and its side by placement over the old side', () => {
        // The canvas's top and height beside the ruler; a rem is 16 px.
        const cases: [TimelineOptions, string, string][] = [
            [{ height: 20 }, '0px', 'calc(100% - 20px)'],
            [{ height: '1.5rem' }, '0px', 'calc(100% - 24px)'],
            [{ height: '18px', size: 30 }, '0px', 'calc(100% - 18px)'],
            [{ size: 30 }, '0px', 'calc(100% - 30px)'],
            [{ placement: 'above' }, '14px', 'calc(100% - 14px)'],
            [
                { placement: 'above', side: 'below' },
                '14px',
                'calc(100% - 14px)',
            ],
            [{ side: 'above' }, '14px', 'calc(100% - 14px)'],
            [{ placement: 'left' as 'above' }, '0px', 'calc(100% - 14px)'],
        ];

        for (const [ruler, top, height] of cases) {
            const { canvas } = ruled(
                { media: fakeMedia({ duration: 60 }), lazy: false },
                ruler,
            );

            expect([
                canvas.style.getPropertyValue('top'),
                canvas.style.getPropertyValue('height'),
            ]).toEqual([top, height]);
        }
    });
});
