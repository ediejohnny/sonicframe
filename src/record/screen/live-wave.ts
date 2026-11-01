/**
 * The wave drawn while recording: a frame that only shows (no seeking), fed the live levels, in the
 * played color. It is hidden from screen readers: the time and the announcements say what matters.
 */

import type { PlayerLook } from '../../core/player/look';
import { PROGRESS } from '../../core/shared/variables';
import { SonicFrame } from '../../dom/frame/frame';
import { css } from '../../dom/shared/css';
import type { BarStyle, WaveStyle } from '../../types';

export class LiveWave {
    readonly element: HTMLDivElement;
    private readonly frame: SonicFrame;

    constructor(
        look: PlayerLook,
        wave: Partial<WaveStyle>,
        bar: Partial<BarStyle>,
    ) {
        this.element = document.createElement('div');
        this.element.className = 'sonicframe-recorder-wave';
        this.element.setAttribute('aria-hidden', 'true');
        const box = document.createElement('div');
        this.element.append(box);
        css(this.element, [
            ['flex', '1 1 auto'],
            ['min-width', '0'],
        ]);
        css(box, [
            ['position', 'relative'],
            ['height', `${look.waveHeight}rem`],
        ]);
        this.frame = new SonicFrame({
            container: box,
            interact: false,
            lazy: false,
            animate: false,
            wave,
            bar,
            colors: { wave: PROGRESS },
        });
    }

    /** Draws `levels` (0 to 1) across the wave. */
    show(levels: readonly number[]): void {
        this.frame.setValues(levels);
    }

    destroy(): void {
        this.frame.destroy();
        this.element.remove();
    }
}
