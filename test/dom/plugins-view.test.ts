/**
 * The plugins follow the view: regions, markers, the silences' shade and the timeline are placed
 * through it and leave out what is outside it; a press lands on what is under it; a keyboard choice
 * outside it brings the view along; the spectrogram shows its part of the image, and a sharp one of
 * the part in view when asked.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    markers,
    regions,
    skipSilences,
    spectrogram,
    timeline,
    type Plugin,
} from '../../src/index';
import { recordingOf, triggerResize, triggerVisible } from './fakes';
import { fakeMedia, mount, nextFrame, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

/** A 200 × 40 frame of a 100-second sound, zoom on, with pixels and on screen. */
function shown(plugins: Plugin[], zoom: object = {}): Mounted {
    mounted = mount({
        zoom: { keys: true, ...zoom },
        media: fakeMedia({ duration: 100 }),
        plugins,
        animate: false,
    });
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);

    return mounted;
}

function key(target: HTMLElement, name: string): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: name,
            bubbles: true,
            cancelable: true,
        }),
    );
}

function pointer(type: string, clientX: number): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clientX,
        clientY: 10,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        shiftKey: false,
    });
}

/** The boxes painted since `from` in one color. */
function painted(canvas: HTMLCanvasElement, fill: string, from = 0) {
    return recordingOf(canvas)
        .rects.slice(from)
        .filter((rect) => rect.fill === fill)
        .map(({ x, width }) => ({ x, width }));
}

describe('regions in a view', () => {
    it('draws a region through the view, and none outside it', async () => {
        const { frame, canvas } = shown([
            regions({
                items: [
                    { start: 55, end: 60 },
                    { start: 10, end: 20 },
                ],
                color: 'red',
                snap: true,
            }),
        ]);
        frame.setView(0.5, 0.75);
        await nextFrame();
        const from = recordingOf(canvas).rects.length;
        frame.invalidate();
        await nextFrame();

        expect(painted(canvas, 'red', from)).toEqual([{ x: 40, width: 40 }]);
    });

    it('draws at fractions of a pixel, as it always did, unless told to snap to whole pixels', async () => {
        // 55.3 s to 60 s of 100 s across 200 px: from 110.6 px, 9.4 px wide; snapped, 111 and 9.
        const band = async (snap?: boolean) => {
            const { canvas, frame } = shown([
                regions({
                    items: [{ start: 55.3, end: 60 }],
                    color: 'red',
                    snap,
                }),
            ]);
            await nextFrame();
            const from = recordingOf(canvas).rects.length;
            frame.invalidate();
            await nextFrame();
            const [rect] = painted(canvas, 'red', from);
            frame.destroy();
            mounted?.unmount();
            mounted = null;

            return rect;
        };

        const fractional = await band(undefined);
        expect(fractional.x).toBeCloseTo(110.6, 9);
        expect(fractional.width).toBeCloseTo(9.4, 9);
        expect(await band(true)).toEqual({ x: 111, width: 9 });
    });

    it('grabs a region under the pointer through the view', () => {
        const { frame, container } = shown([
            regions({ items: [{ start: 55, end: 60 }] }),
        ]);

        container.dispatchEvent(pointer('pointermove', 60));
        expect(container.style.getPropertyValue('cursor')).not.toBe('grab');

        frame.setView(0.5, 0.75);
        container.dispatchEvent(pointer('pointermove', 60));
        expect(container.style.getPropertyValue('cursor')).toBe('grab');
    });

    it('puts its label through the view and hides it outside', () => {
        const { frame, container } = shown([
            regions({ items: [{ start: 55, end: 60, label: 'chorus' }] }),
        ]);
        const label = (): HTMLElement =>
            [...container.querySelectorAll('span')].find(
                (span) => span.textContent === 'chorus',
            ) as HTMLElement;

        frame.setView(0.5, 0.75);
        expect(label().style.getPropertyValue('left')).toBe('20%');
        expect(label().style.getPropertyValue('display')).not.toBe('none');

        frame.setView(0, 0.25);
        expect(label().style.getPropertyValue('display')).toBe('none');
    });

    it('brings a region chosen by keys into view when asked, and leaves the view alone by default', () => {
        const one = shown([
            regions({ items: [{ start: 55, end: 60 }], scrollIntoView: true }),
        ]);
        one.frame.setView(0, 0.25);

        key(one.container, 'r');

        // Centered on 57.5 s: 45 s to 70 s.
        expect(one.frame.view.start).toBeCloseTo(0.45, 12);
        expect(one.frame.view.end).toBeCloseTo(0.7, 12);

        one.frame.destroy();
        one.unmount();
        const other = shown([regions({ items: [{ start: 55, end: 60 }] })]);
        other.frame.setView(0, 0.25);

        key(other.container, 'r');

        expect(other.frame.view.start).toBe(0);
    });
});

describe('markers in a view', () => {
    it('draws the markers in view only, through it', async () => {
        const { frame, canvas } = shown([
            markers({ times: [55, 10], color: 'red', width: 2 }),
        ]);
        frame.setView(0.5, 0.75);
        await nextFrame();
        const from = recordingOf(canvas).rects.length;
        frame.invalidate();
        await nextFrame();

        expect(painted(canvas, 'red', from)).toEqual([{ x: 39, width: 2 }]);
    });

    it('seeks to a marker clicked through the view', () => {
        const { frame, container } = shown([markers({ times: [55] })]);
        const media = frame.media as HTMLMediaElement;
        frame.setView(0.5, 0.75);

        // 3 px off the marker (55.375 s): it still lands on the marker's own moment.
        container.dispatchEvent(pointer('pointerdown', 43));
        container.dispatchEvent(pointer('pointerup', 43));

        expect(media.currentTime).toBeCloseTo(55, 9);
    });

    it('brings a marker reached by M into view, like any keyboard seek', () => {
        const { frame, container } = shown([markers({ times: [80] })]);
        frame.setView(0, 0.25);

        key(container, 'm');

        expect(frame.view.start).toBeCloseTo(0.75, 12);
        expect(frame.view.end).toBe(1);
    });
});

describe('the silences in a view', () => {
    it('shades the silences through the view', async () => {
        const { frame, canvas } = shown([
            skipSilences({
                silences: [{ start: 55, end: 60 }],
                dim: true,
                dimColor: 'red',
                snap: true,
            }),
        ]);
        frame.setView(0.5, 0.75);
        await nextFrame();
        const from = recordingOf(canvas).rects.length;
        frame.invalidate();
        await nextFrame();

        expect(painted(canvas, 'red', from)).toEqual([{ x: 40, width: 40 }]);
    });

    it('shades at fractions of a pixel, as it always did, unless told to snap to whole pixels', async () => {
        const shade = async (snap?: boolean) => {
            const { canvas, frame } = shown([
                skipSilences({
                    silences: [{ start: 55.3, end: 60 }],
                    dim: true,
                    dimColor: 'red',
                    snap,
                }),
            ]);
            await nextFrame();
            const from = recordingOf(canvas).rects.length;
            frame.invalidate();
            await nextFrame();
            const [rect] = painted(canvas, 'red', from);
            frame.destroy();
            mounted?.unmount();
            mounted = null;

            return rect;
        };

        const fractional = await shade(undefined);
        expect(fractional.x).toBeCloseTo(110.6, 9);
        expect(fractional.width).toBeCloseTo(9.4, 9);
        expect(await shade(true)).toEqual({ x: 111, width: 9 });
    });
});

describe('the timeline in a view', () => {
    function labels(container: HTMLElement): [string, string][] {
        return [...container.querySelectorAll('span')]
            .filter(
                (span) =>
                    span.textContent !== '' &&
                    span.style.getPropertyValue('display') !== 'none',
            )
            .map((span) => [
                span.textContent ?? '',
                span.style.getPropertyValue('left'),
            ]);
    }

    it('marks the part in view, and follows the view as it moves, reusing its labels', () => {
        const { frame, container } = shown([timeline()]);

        frame.setView(0.5, 0.75);
        const first = [...container.querySelectorAll('span')].find(
            (span) => span.textContent === '0:50',
        );

        expect(labels(container)).toEqual([
            ['0:50', '0%'],
            ['1:00', '40%'],
            ['1:10', '80%'],
        ]);

        frame.setView(0.6, 0.85);

        expect(labels(container)).toEqual([
            ['1:00', '0%'],
            ['1:10', '40%'],
            ['1:20', '80%'],
        ]);
        expect(first?.isConnected).toBe(true);
    });
});

describe('the spectrogram in a view', () => {
    const rate = 8000;
    const samples = Float32Array.from({ length: rate }, (_, i) =>
        Math.sin((2 * Math.PI * 1000 * i) / rate),
    );
    const base = {
        samples,
        sampleRate: rate,
        columns: 16,
        rows: 32,
        fftSize: 256,
    };

    async function drawn(canvas: HTMLCanvasElement): Promise<void> {
        await vi.waitFor(
            () => expect(recordingOf(canvas).images.length).toBeGreaterThan(0),
            { timeout: 3_000, interval: 20 },
        );
    }

    it('draws its whole image across the frame at the whole sound, and its part in view when zoomed', async () => {
        const { frame, canvas } = shown([spectrogram(base)]);
        await drawn(canvas);

        expect(recordingOf(canvas).images.at(-1)).toEqual([0, 0, 200, 40]);

        frame.setView(0.5, 0.75);
        await nextFrame();

        expect(recordingOf(canvas).images.at(-1)).toEqual([
            8, 0, 4, 32, 0, 0, 200, 40,
        ]);
    });

    it('computes a sharp image of the part in view once the view rests, when asked', async () => {
        const created = vi.spyOn(document, 'createElement');
        const images = (): number =>
            created.mock.calls.filter(([tag]) => tag === 'canvas').length;
        const { frame, canvas } = shown([
            spectrogram({
                ...base,
                detail: true,
                detailDelay: 10,
                detailColumns: 50,
            }),
        ]);
        await drawn(canvas);
        const before = images();

        frame.setView(0.5, 0.75);

        await vi.waitFor(
            () =>
                expect(recordingOf(canvas).images.at(-1)).toEqual([
                    0, 0, 50, 32, 0, 0, 200, 40,
                ]),
            { timeout: 3_000, interval: 20 },
        );
        expect(images()).toBe(before + 1);

        // Moved again, it shows the crop of the whole image until the new detail is ready.
        frame.setView(0.25, 0.5);
        await nextFrame();
        expect(recordingOf(canvas).images.at(-1)).toEqual([
            4, 0, 4, 32, 0, 0, 200, 40,
        ]);
        created.mockRestore();
    });

    it('computes the sharp image from the part in view only', async () => {
        // Silence, then a tone: the sharp image of the silent half is one flat color.
        const halves = Float32Array.from({ length: rate }, (_, i) =>
            i < rate / 2 ? 0 : Math.sin((2 * Math.PI * 1000 * i) / rate),
        );
        const created = vi.spyOn(document, 'createElement');
        const { frame, canvas } = shown([
            spectrogram({
                ...base,
                samples: halves,
                detail: true,
                detailDelay: 10,
                detailColumns: 20,
            }),
        ]);
        await drawn(canvas);

        frame.setView(0, 0.5);
        await vi.waitFor(
            () =>
                expect(recordingOf(canvas).images.at(-1)).toEqual([
                    0, 0, 20, 32, 0, 0, 200, 40,
                ]),
            { timeout: 3_000, interval: 20 },
        );

        const images = created.mock.results
            .map((result) => result.value as HTMLElement)
            .filter((element) => element.tagName === 'CANVAS');
        const sharp = recordingOf(images.at(-1) as HTMLCanvasElement).pixels[0];

        expect(sharp.length).toBe(20 * 32 * 4);
        expect(new Set(sharp).size).toBeLessThanOrEqual(4);
        created.mockRestore();
    });

    it('stays with the crop unless asked for detail', async () => {
        const { frame, canvas } = shown([spectrogram(base)]);
        await drawn(canvas);
        frame.setView(0.5, 0.75);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await nextFrame();

        expect(recordingOf(canvas).images.at(-1)).toEqual([
            8, 0, 4, 32, 0, 0, 200, 40,
        ]);
    });
});
