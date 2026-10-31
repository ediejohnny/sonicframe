/**
 * Drawings of the sound on the page: line drawings are stroked in the played and unplayed colors,
 * the track draws without any peaks, the knob rides the playing position in its own color, a change
 * of drawing repaints, and a new canvas size repaints at once, never showing a blank canvas.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { mount, nextFrame, type Mounted } from './helpers';
import {
    recordingOf,
    triggerResize,
    triggerVisible,
    type Recorded,
} from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

const PEAKS = Array.from({ length: 100 }, (_, i) => (i % 10) / 10);
const COLORS = { wave: '#cccccc', progress: '#2f6fdb', hover: null };

async function draw(): Promise<Recorded> {
    const frame = mounted as Mounted;
    triggerResize(frame.canvas, { width: 200, height: 40 });
    triggerVisible(frame.canvas, true);
    frame.frame.setProgress(0.5);
    await nextFrame();

    return recordingOf(frame.canvas);
}

describe('wave drawings', () => {
    it('repaints the moment the canvas changes size, so it never shows blank', async () => {
        mounted = mount({ lazy: false, peaks: PEAKS, colors: COLORS });
        const recorded = await draw();
        const before = recorded.fills.length;

        // Setting a canvas's size clears it; a repaint left to the next animation frame shows one
        // blank frame in between.
        triggerResize(mounted.canvas, { width: 210, height: 40 });

        expect(mounted.canvas.width).toBe(210);
        expect(recorded.fills.slice(before)).toContain('#cccccc');
    });

    it('strokes a line drawing in the played and unplayed colors', async () => {
        mounted = mount({
            lazy: false,
            peaks: PEAKS,
            wave: 'line',
            colors: COLORS,
        });

        const { strokes } = await draw();

        expect(strokes).toContain('#2f6fdb');
        expect(strokes).toContain('#cccccc');
    });

    it('draws the track, as thick as its line, without peaks', async () => {
        mounted = mount({
            lazy: false,
            wave: { style: 'track', lineWidth: 4 },
            colors: COLORS,
        });

        const { fills, paths } = await draw();
        const rails = paths.flatMap((path) =>
            path.calls.filter(
                ([name, , , width, height]) =>
                    (name === 'rect' || name === 'roundRect') &&
                    width === 200 &&
                    height === 4,
            ),
        );

        expect(rails.length).toBeGreaterThan(0);
        expect(fills).toContain('#2f6fdb');
        expect(fills).toContain('#cccccc');
    });

    it('paints the knob in its own color', async () => {
        mounted = mount({
            lazy: false,
            peaks: PEAKS,
            wave: { style: 'track', knob: 12 },
            colors: { ...COLORS, knob: '#ff00ff' },
        });

        const { fills } = await draw();

        expect(fills.at(-1)).toBe('#ff00ff');
    });

    it('repaints with the new drawing after setWave', async () => {
        mounted = mount({ lazy: false, peaks: PEAKS, colors: COLORS });
        await draw();

        mounted.frame.setWave('scope');
        await nextFrame();

        expect(recordingOf(mounted.canvas).strokes).toContain('#2f6fdb');
    });
});
