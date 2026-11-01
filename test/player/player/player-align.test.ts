/**
 * The parts beside the wave line up with the bars themselves, not with the wave's box (which also
 * holds strips of titles or timelines) nor with the rows under it.
 */

import { describe, expect, it } from 'vite-plus/test';
import { createPlayer, type PlayerOptions } from '../../../src/player';
import { triggerResize, triggerVisible } from '../../support/fakes';
import { afterTest, boxOf, fakeMedia, pageHost } from '../../support/helpers';

function make(options: Partial<PlayerOptions> = {}): HTMLElement {
    const host = pageHost({ left: 0, top: 0, width: 480, height: 80 });
    afterTest(
        createPlayer({
            container: host,
            media: fakeMedia({ duration: 100 }),
            peaks: [0.5, 0.5],
            ...options,
        }),
    );

    return host.querySelector('.sonicframe-player') as HTMLElement;
}

/** Gives `element` a box measured afresh at every read, as a page that reflows would. */
function liveBox(
    element: Element,
    measure: () => { left: number; top: number; width: number; height: number },
): void {
    element.getBoundingClientRect = (): DOMRect => {
        const box = measure();

        return {
            ...box,
            right: box.left + box.width,
            bottom: box.top + box.height,
            x: box.left,
            y: box.top,
            toJSON: () => box,
        };
    };
}

/** A player's wave canvas, its play button, the line they share and the wave's own box. */
type Line = {
    canvas: HTMLCanvasElement;
    play: HTMLElement;
    line: HTMLElement;
    box: HTMLElement;
};

/** The parts of the line of a player made with `options`; the line is 480 × 60. */
function lineOf(options: Partial<PlayerOptions> = {}): Line {
    const root = make(options);
    const canvas = root.querySelector('canvas') as HTMLCanvasElement;
    const play = root.querySelector('.sonicframe-play') as HTMLElement;
    const line = play.parentElement as HTMLElement;
    // The wave's own box: the first child of the line's part that holds the canvas (its column).
    const column = [...line.children].find((part) => part.contains(canvas));
    boxOf(line, { left: 0, top: 0, width: 480, height: 60 });

    return {
        canvas,
        play,
        line,
        box: column?.firstElementChild as HTMLElement,
    };
}

/**
 * Lays the line out: the bars 300 wide at 60 px, from `top` and `height` tall, and the play button
 * 36 square from `playTop`.
 */
function layOut(
    { canvas, play }: Pick<Line, 'canvas' | 'play'>,
    top: number,
    height: number,
    playTop = 12,
): void {
    boxOf(canvas, { left: 60, top, width: 300, height });
    boxOf(play, { left: 0, top: playTop, width: 36, height: 36 });

    triggerResize(canvas, { width: 300, height });
    triggerVisible(canvas, true);
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
        boxOf(time, { left: 400, top: 40, width: 60, height: 16 });
        layOut({ canvas, play }, 10, 40, 30);

        expect(play.style.getPropertyValue('translate')).toBe('0px -18px');
        expect(time.style.getPropertyValue('translate')).toBe('0px -18px');
    });

    it('stay put when they already center on the bars', () => {
        const root = make();
        const canvas = root.querySelector('canvas') as HTMLCanvasElement;
        const play = root.querySelector('.sonicframe-play') as HTMLElement;
        layOut({ canvas, play }, 10, 40);

        expect(play.style.getPropertyValue('translate')).toBe('0px 0px');
    });

    it("bring short bars down when the play button centered on them would leave the line's top", () => {
        const line = lineOf({
            chapters: { items: [{ start: 0, title: 'A' }], lane: 'below' },
            look: { line: ['play', 'wave'] },
        });
        // The line runs from 0 to 60. The bars run from 2 to 22 (middle 12), so the play button
        // (36 tall) centered on them would start at -6: six pixels above the line.
        layOut(line, 2, 20);

        expect(line.box.style.getPropertyValue('margin-top')).toBe('6px');
        expect(line.box.style.getPropertyValue('margin-bottom')).toBe('0px');
    });

    it("bring the bars up when the play button centered on them would leave the line's bottom", () => {
        const line = lineOf({ look: { line: ['play', 'wave'] } });
        // The line runs from 0 to 60. The bars run from 44 to 64 (middle 54), so the play button
        // would end at 72: twelve pixels under the line.
        layOut(line, 44, 20);

        expect(line.box.style.getPropertyValue('margin-top')).toBe('0px');
        expect(line.box.style.getPropertyValue('margin-bottom')).toBe('12px');
    });

    it('settle when a pixel of margin grows the line by a little more than a pixel', () => {
        const { canvas, play, line, box } = lineOf({
            look: { line: ['play', 'wave'] },
        });
        const margin = (): number =>
            parseFloat(box.style.getPropertyValue('margin-bottom')) || 0;
        const shift = (): number =>
            parseFloat(
                play.style.getPropertyValue('translate').split(' ')[1] ?? '',
            ) || 0;
        // The browser snaps the line to device pixels: with 4 px of margin under the wave's box the
        // line is 43.99 tall, with 5 px it is 45. The play button (35.99 tall) is centered in the
        // line and moved by its own translate; the bars run from 13.99, 25.99 tall.
        const height = (): number => (margin() >= 5 ? 45 : 39.99 + margin());
        liveBox(line, () => ({
            left: 0,
            top: 0,
            width: 480,
            height: height(),
        }));
        liveBox(canvas, () => ({
            left: 60,
            top: 13.99,
            width: 300,
            height: 25.99,
        }));
        liveBox(play, () => ({
            left: 0,
            top: (height() - 35.99) / 2 + shift(),
            width: 36,
            height: 35.99,
        }));
        box.style.setProperty('margin-bottom', '4px');
        play.style.setProperty('translate', '0px 5px');
        triggerResize(canvas, { width: 300, height: 26 });
        triggerVisible(canvas, true);

        // Each new size of the bars (the device pixels shift with the line) lines the parts up again.
        const states: string[] = [];

        for (let round = 0; round < 6; round++) {
            triggerResize(canvas, {
                width: 300,
                height: round % 2 === 0 ? 25 : 26,
            });
            states.push(`${margin()} ${shift()}`);
        }

        expect(new Set(states.slice(1)).size).toBe(1);
    });

    it('leave the bars where they are when the play button fits the line', () => {
        const line = lineOf({ look: { line: ['play', 'wave'] } });
        layOut(line, 10, 40);

        expect(line.box.style.getPropertyValue('margin-top')).toBe('0px');
        expect(line.box.style.getPropertyValue('margin-bottom')).toBe('0px');
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
