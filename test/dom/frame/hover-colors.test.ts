/**
 * Hover colors: while the pointer is over a frame, the bars can recolor. Off by default; here they
 * are set explicitly and the recording context confirms the played bars take `progressHover`.
 */

import { describe, expect, it } from 'vite-plus/test';
import { recordingOf } from '../../support/fakes';
import {
    drawnHalfway,
    mount,
    nextFrame,
    type Mounted,
} from '../../support/helpers';

let mounted: Mounted | null = null;

function movePointer(target: HTMLElement, clientX: number): void {
    target.dispatchEvent(
        Object.assign(new Event('pointermove', { bubbles: true }), {
            clientX,
            pointerType: 'mouse',
        }),
    );
}

async function draw(): Promise<string[]> {
    return (await drawnHalfway(mounted as Mounted)).fills;
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
