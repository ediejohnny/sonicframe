/**
 * The parts beside the wave line up with the bars themselves, not with the wave's box (which also
 * holds strips of titles or timelines) nor with the rows under it.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    type Player,
    type PlayerOptions,
} from '../../src/player';
import { triggerResize, triggerVisible } from './fakes';
import { boxOf, fakeMedia } from './helpers';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
});

function make(options: Partial<PlayerOptions> = {}): HTMLElement {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 480, height: 80 });
    player = createPlayer({
        container: host,
        media: fakeMedia({ duration: 100 }),
        peaks: [0.5, 0.5],
        ...options,
    });

    return host.querySelector('.sonicframe-player') as HTMLElement;
}

/** The wave's own box: the first child of the line's part that holds the canvas (its column). */
function waveBoxOf(line: HTMLElement, canvas: HTMLCanvasElement): HTMLElement {
    const column = [...line.children].find((part) => part.contains(canvas));

    return column?.firstElementChild as HTMLElement;
}

describe('the parts beside the wave', () => {
    it("center on the bars, whatever sits under them in the wave's column", () => {
        const root = make({
            chapters: { items: [{ start: 0, title: 'A' }], lane: 'below' },
            look: { line: ['play', 'wave', 'time'], meta: ['chapter'] },
        });
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        const time = root.querySelector('.sonicframe-time') as HTMLElement;
        // The bars run from 10 to 50 (middle 30); the play button sits from 30 to 66 (middle 48),
        // the time from 40 to 56 (middle 48).
        boxOf(canvas, { left: 60, top: 10, width: 300, height: 40 });
        boxOf(play, { left: 0, top: 30, width: 36, height: 36 });
        boxOf(time, { left: 400, top: 40, width: 60, height: 16 });

        triggerResize(canvas, { width: 300, height: 40 });
        triggerVisible(canvas, true);

        expect(play.style.getPropertyValue('translate')).toBe('0px -18px');
        expect(time.style.getPropertyValue('translate')).toBe('0px -18px');
    });

    it('stay put when they already center on the bars', () => {
        const root = make();
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        boxOf(canvas, { left: 60, top: 10, width: 300, height: 40 });
        boxOf(play, { left: 0, top: 12, width: 36, height: 36 });

        triggerResize(canvas, { width: 300, height: 40 });
        triggerVisible(canvas, true);

        expect(play.style.getPropertyValue('translate')).toBe('0px 0px');
    });

    it("bring short bars down when the play button centered on them would leave the line's top", () => {
        const root = make({
            chapters: { items: [{ start: 0, title: 'A' }], lane: 'below' },
            look: { line: ['play', 'wave'] },
        });
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        const line = play.parentElement as HTMLElement;
        const box = waveBoxOf(line, canvas);
        // The line runs from 0 to 60. The bars run from 2 to 22 (middle 12), so the play button
        // (36 tall) centered on them would start at -6: six pixels above the line.
        boxOf(line, { left: 0, top: 0, width: 480, height: 60 });
        boxOf(canvas, { left: 60, top: 2, width: 300, height: 20 });
        boxOf(play, { left: 0, top: 12, width: 36, height: 36 });

        triggerResize(canvas, { width: 300, height: 20 });
        triggerVisible(canvas, true);

        expect(box.style.getPropertyValue('margin-top')).toBe('6px');
        expect(box.style.getPropertyValue('margin-bottom')).toBe('0px');
    });

    it("bring the bars up when the play button centered on them would leave the line's bottom", () => {
        const root = make({ look: { line: ['play', 'wave'] } });
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        const line = play.parentElement as HTMLElement;
        const box = waveBoxOf(line, canvas);
        // The line runs from 0 to 60. The bars run from 44 to 64 (middle 54), so the play button
        // would end at 72: twelve pixels under the line.
        boxOf(line, { left: 0, top: 0, width: 480, height: 60 });
        boxOf(canvas, { left: 60, top: 44, width: 300, height: 20 });
        boxOf(play, { left: 0, top: 12, width: 36, height: 36 });

        triggerResize(canvas, { width: 300, height: 20 });
        triggerVisible(canvas, true);

        expect(box.style.getPropertyValue('margin-top')).toBe('0px');
        expect(box.style.getPropertyValue('margin-bottom')).toBe('12px');
    });

    it('leave the bars where they are when the play button fits the line', () => {
        const root = make({ look: { line: ['play', 'wave'] } });
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        const line = play.parentElement as HTMLElement;
        const box = waveBoxOf(line, canvas);
        boxOf(line, { left: 0, top: 0, width: 480, height: 60 });
        boxOf(canvas, { left: 60, top: 10, width: 300, height: 40 });
        boxOf(play, { left: 0, top: 12, width: 36, height: 36 });

        triggerResize(canvas, { width: 300, height: 40 });
        triggerVisible(canvas, true);

        expect(box.style.getPropertyValue('margin-top')).toBe('0px');
        expect(box.style.getPropertyValue('margin-bottom')).toBe('0px');
    });

    it('let the rows under the wave start at the line, under the play button, when asked', () => {
        const root = make({
            look: {
                line: ['play', 'wave'],
                meta: ['time'],
                underStart: 'line',
            },
        });
        const row = (root.querySelector('.sonicframe-time') as HTMLElement)
            .parentElement as HTMLElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;

        expect(row.style.getPropertyValue('grid-column')).toBe('1 / -1');
        expect(play.style.getPropertyValue('grid-row')).toBe('1');
    });

    it("keep the rows on the wave's left edge by default, as before", () => {
        const root = make({ look: { line: ['play', 'wave'], meta: ['time'] } });
        const row = (root.querySelector('.sonicframe-time') as HTMLElement)
            .parentElement as HTMLElement;

        expect(row.style.getPropertyValue('grid-column')).toBe('');
    });

    it('are left alone when the wave has its own line on top', () => {
        const root = make({
            look: { wavePlace: 'top', line: ['play', 'time'] },
        });
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        boxOf(canvas, { left: 0, top: 10, width: 300, height: 40 });
        boxOf(play, { left: 0, top: 60, width: 36, height: 36 });

        triggerResize(canvas, { width: 300, height: 40 });
        triggerVisible(canvas, true);

        expect(play.style.getPropertyValue('translate')).toBe('');
    });
});
