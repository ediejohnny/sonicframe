/**
 * Hover colors: while the pointer is over a frame, the bars can recolor. Off by default; here they
 * are set explicitly and the recording context confirms the played bars take `progressHover`.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { mount, nextFrame, type Mounted } from './helpers';
import { recordingOf, triggerResize, triggerVisible } from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

function movePointer(target: HTMLElement, clientX: number): void {
    target.dispatchEvent(
        Object.assign(new Event('pointermove', { bubbles: true }), {
            clientX,
            pointerType: 'mouse',
        }),
    );
}

async function draw(): Promise<string[]> {
    const frame = mounted as Mounted;
    triggerResize(frame.canvas, { width: 200, height: 40 });
    triggerVisible(frame.canvas, true);
    frame.frame.setProgress(0.5);
    await nextFrame();

    return recordingOf(frame.canvas).fills;
}

describe('hover colors', () => {
    it('paints the played bars with progressHover while hovered', async () => {
        mounted = mount({
            lazy: false,
            colors: {
                progress: '#2f6fdb',
                progressHover: '#ff0000',
                hover: null,
            },
        });

        await draw();
        movePointer(mounted.container, 150);
        await nextFrame();

        expect(recordingOf(mounted.canvas).fills).toContain('#ff0000');
    });

    it('leaves the played color alone when the pointer is away', async () => {
        mounted = mount({
            lazy: false,
            colors: {
                progress: '#2f6fdb',
                progressHover: '#ff0000',
                hover: null,
            },
        });

        const fills = await draw();

        expect(fills).not.toContain('#ff0000');
        expect(fills).toContain('#2f6fdb');
    });
});
