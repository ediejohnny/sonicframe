import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    barMetrics,
    barWindow,
    layoutBars,
    type Bar,
} from '../src/core/layout';
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

describe('barWindow', () => {
    it('is the whole row of bars for the whole sound, laid out exactly as without a window', () => {
        for (const ratio of RATIOS) {
            const width = Math.round(448 * ratio);
            const grid = barWindow(width, { start: 0, end: 1 }, STYLE, ratio);
            const { count } = barMetrics(width, STYLE, ratio);
            const values = wave(count);

            expect(grid).toEqual({
                total: count,
                first: 0,
                count,
                virtualWidth: width,
                offset: 0,
            });
            expect(layoutBars(values, width, 30, STYLE, ratio, grid)).toEqual(
                layoutBars(values, width, 30, STYLE, ratio),
            );
        }
    });

    it('lays four times as many bars over the sound at 4×, and shows the quarter in view', () => {
        // 400 px at 4×: 1600 px of bars (533 of them, 3 px apart), the view starting 400 px in.
        const grid = barWindow(400, { start: 0.25, end: 0.5 }, STYLE, 1);

        expect(grid.total).toBe(barMetrics(1600, STYLE, 1).count);
        expect(grid.virtualWidth).toBe(1600);
        expect(grid.offset).toBe(400);
        expect(grid.first).toBeLessThanOrEqual(Math.floor(400 / 3));
        expect(grid.first + grid.count).toBeGreaterThan(Math.floor(800 / 3));
    });

    it('keeps every bar on the same piece of sound while the view scrolls (the bars never swim)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 40, max: 900 }),
                fc.constantFrom(...RATIOS),
                fc.double({ min: 1, max: 64, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                (cssWidth, ratio, level, a, b) => {
                    const width = Math.round(cssWidth * ratio);
                    const span = 1 / level;
                    const place = (at: number): Map<number, number> => {
                        const start = at * (1 - span);
                        const grid = barWindow(
                            width,
                            { start, end: start + span },
                            STYLE,
                            ratio,
                        );
                        const bars = layoutBars(
                            wave(grid.count),
                            width,
                            30,
                            STYLE,
                            ratio,
                            grid,
                        );

                        // Each bar by its place in the whole grid, at its x on the whole sound.
                        return new Map(
                            bars.map((bar, i) => [
                                grid.first + i,
                                bar.x + grid.offset,
                            ]),
                        );
                    };
                    const one = place(a);
                    const two = place(b);

                    for (const [index, x] of one) {
                        if (two.has(index)) {
                            expect(two.get(index)).toBe(x);
                        }
                    }
                },
            ),
        );
    });

    it('draws a solid row the same however far the window reaches', () => {
        const solid = { ...STYLE, gap: 0, radius: 0 };

        // Rows whose bars do not divide evenly, so some windows end on a bar one pixel wider.
        let wideEnds = 0;

        for (let step = 0; step < 200; step++) {
            const ratio = RATIOS[step % RATIOS.length];
            const start = (step % 37) * 0.0101;
            const width = 101 + (step % 41);
            const grid = barWindow(
                width,
                { start, end: start + 0.5 },
                solid,
                ratio,
            );
            const wider = { ...grid, count: grid.count + 3 };
            const bars = layoutBars(
                wave(grid.count),
                width,
                30,
                solid,
                ratio,
                grid,
            );
            const more = layoutBars(
                wave(wider.count),
                width,
                30,
                solid,
                ratio,
                wider,
            );

            expect(bars).toEqual(more.slice(0, bars.length));

            const last = more[bars.length - 1];

            if (
                more[bars.length].x - last.x >
                barMetrics(1, solid, ratio).width
            ) {
                wideEnds++;
            }
        }

        expect(wideEnds).toBeGreaterThan(0);
    });

    it('covers the screen from edge to edge with the bars it lays, and lays none far outside', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 40, max: 900 }),
                fc.constantFrom(...RATIOS),
                fc.double({ min: 1, max: 64, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                (cssWidth, ratio, level, at) => {
                    const width = Math.round(cssWidth * ratio);
                    const span = 1 / level;
                    const start = at * (1 - span);
                    const grid = barWindow(
                        width,
                        { start, end: start + span },
                        STYLE,
                        ratio,
                    );
                    const bars = layoutBars(
                        wave(grid.count),
                        width,
                        30,
                        STYLE,
                        ratio,
                        grid,
                    );
                    const step =
                        barMetrics(width, STYLE, ratio).width +
                        barMetrics(width, STYLE, ratio).gap;

                    expect(bars.length).toBe(grid.count);
                    expect(grid.first === 0 || bars[0].x <= 0).toBe(true);
                    expect(
                        grid.first + grid.count === grid.total ||
                            bars.at(-1)!.x + bars.at(-1)!.width >= width,
                    ).toBe(true);
                    expect(bars[0].x + bars[0].width).toBeGreaterThan(
                        -2 * step,
                    );
                    expect(bars.at(-1)!.x).toBeLessThan(width + 2 * step);
                },
            ),
        );
    });
});
