import { describe, expect, it } from 'vite-plus/test';
import { barMetrics, layoutBars, type Bar } from '../src/core/layout';
import type { BarStyle } from '../src/types';

const STYLE: BarStyle = {
    width: 2,
    gap: 1,
    radius: 1.5,
    minHeight: 2,
    align: 'center',
    curve: 1,
};

const RATIOS = [1, 1.25, 1.5, 2, 3];

function wave(count: number): number[] {
    return Array.from(
        { length: count },
        (_, i) => Math.abs(Math.sin(i * 0.37)) * 0.9 + 0.05,
    );
}

/** Lays out as a frame does: as many values as bars fit. */
function layout(
    cssWidth: number,
    cssHeight: number,
    ratio: number,
    style: BarStyle = STYLE,
): { bars: Bar[]; width: number; height: number } {
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    const { count } = barMetrics(width, style, ratio);

    return {
        bars: layoutBars(wave(count), width, height, style, ratio),
        width,
        height,
    };
}

describe('barMetrics', () => {
    it('uses whole device pixels and fits the bars inside the width', () => {
        for (const ratio of RATIOS) {
            for (const width of [37, 120, 448, 1001]) {
                const device = Math.round(width * ratio);
                const metrics = barMetrics(device, STYLE, ratio);

                expect(Number.isInteger(metrics.width)).toBe(true);
                expect(metrics.gap).toBeGreaterThanOrEqual(1);
                expect(
                    metrics.count * metrics.width +
                        (metrics.count - 1) * metrics.gap,
                ).toBeLessThanOrEqual(device);
                expect(
                    (metrics.count + 1) * metrics.width +
                        metrics.count * metrics.gap,
                ).toBeGreaterThan(device);
            }
        }
    });

    it('fits no bar in a frame narrower than one bar', () => {
        expect(barMetrics(1, { width: 3, gap: 1 }, 1).count).toBe(0);
    });
});

describe('layoutBars', () => {
    it('never overlaps, keeps one width and spans the frame edge to edge at any density', () => {
        for (const ratio of RATIOS) {
            for (const cssWidth of [64, 300, 448, 777]) {
                const { bars, width } = layout(cssWidth, 30, ratio);
                const gap = barMetrics(width, STYLE, ratio).gap;

                expect(bars.length).toBeGreaterThan(1);
                expect(new Set(bars.map((bar) => bar.width)).size).toBe(1);
                expect(bars[0].x).toBe(0);
                expect(bars.at(-1)!.x + bars.at(-1)!.width).toBe(width);

                for (let i = 1; i < bars.length; i++) {
                    expect(Number.isInteger(bars[i].x)).toBe(true);
                    expect(
                        bars[i].x - (bars[i - 1].x + bars[i - 1].width),
                    ).toBeGreaterThanOrEqual(gap);
                }
            }
        }
    });

    it('centers every bar exactly, on whole pixels', () => {
        for (const ratio of RATIOS) {
            const { bars, height } = layout(300, 31, ratio);

            for (const bar of bars) {
                expect(Number.isInteger(bar.y)).toBe(true);
                expect(bar.y * 2 + bar.height).toBe(height);
            }
        }
    });

    it('keeps silence at the minimum height and loud parts inside the frame', () => {
        const bars = layoutBars([0, 1, 2], 30, 20, STYLE, 1.5);

        expect(bars[0].height).toBe(4);
        expect(bars[1].height).toBe(20);
        expect(bars[2].height).toBe(20);
    });

    it('never rounds a corner past half the bar', () => {
        const bars = layoutBars(
            [0, 0.5, 1],
            40,
            24,
            { ...STYLE, width: 3, radius: 10 },
            2,
        );

        for (const bar of bars) {
            expect(bar.radius).toBeLessThanOrEqual(Math.floor(bar.width / 2));
            expect(bar.radius).toBeLessThanOrEqual(Math.floor(bar.height / 2));
        }
    });

    it('grows bars from the bottom when asked', () => {
        const bars = layoutBars(
            [0.5, 1],
            10,
            20,
            { ...STYLE, align: 'bottom' },
            1,
        );

        for (const bar of bars) {
            expect(bar.y + bar.height).toBe(20);
        }
    });

    it('draws one solid shape without a gap', () => {
        const solid = { ...STYLE, gap: 0, radius: 0 };
        const { bars, width } = layout(301, 30, 1.25, solid);

        for (let i = 1; i < bars.length; i++) {
            expect(bars[i].x).toBe(bars[i - 1].x + bars[i - 1].width);
        }

        expect(bars.at(-1)!.x + bars.at(-1)!.width).toBe(width);
    });

    it('lifts quiet sounds with a curve below 1', () => {
        const flat = layoutBars([0.25], 2, 100, STYLE, 1)[0];
        const lifted = layoutBars(
            [0.25],
            2,
            100,
            { ...STYLE, curve: 0.5 },
            1,
        )[0];

        expect(flat.height).toBe(26);
        expect(lifted.height).toBe(50);
    });
});
