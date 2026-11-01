/**
 * The player of a recording in review: made once per recording, dressed by the screen's theme with
 * no box of its own (the screen is the box), and speaking the screen's language. It shares one line
 * with the screen's buttons: the rows under its wave start under its play button unless the app's
 * look says otherwise, and with `bars`, the parts beside it center on its bars, as its play button
 * does.
 */

import { css } from '../../dom/shared/css';
import { observeSize } from '../../dom/shared/observe';
import { createPlayer, type Player } from '../../player/player/player';
import { centerOnBars } from '../../player/player/player-layout';
import type { Recording } from '../recorder/recorder';
import type { RecorderScreenOptions } from './screen-options';

export class ReviewPlayer {
    readonly element: HTMLDivElement;
    readonly player: Player;
    private readonly stopSize: () => void = () => undefined;

    constructor(
        options: RecorderScreenOptions,
        label: string,
        recording: Recording,
        address: string,
        private readonly bars: boolean,
    ) {
        this.element = document.createElement('div');
        this.element.className = 'sonicframe-recorder-player';
        css(this.element, [
            ['flex', '1 1 auto'],
            ['min-width', '0'],
        ]);
        this.player = createPlayer({
            container: this.element,
            src: address,
            peaks: [...recording.peaks],
            duration: recording.duration,
            label,
            theme: options.theme,
            palette: options.palette,
            wave: options.wave,
            bar: options.bar,
            font: options.font,
            look: {
                underStart: 'line',
                ...options.look,
                ...options.reviewLook,
                padding: 0,
                border: 0,
                surface: 'none',
                shadow: 'none',
                background: null,
            },
            a11y: { lang: options.a11y?.lang },
        });
        if (bars) {
            // Its rows come and go with its width, and the bars move with them.
            this.stopSize = observeSize(this.element, () => this.lineUp());
        }
    }

    /** Centers the parts beside it, in the screen's row, on its bars, when asked to. */
    lineUp(): void {
        const canvas = this.element.querySelector('canvas');
        const row = this.element.parentElement;

        if (!this.bars || canvas === null || row === null) {
            return;
        }

        centerOnBars(
            canvas,
            [...row.children].filter(
                (part): part is HTMLElement =>
                    part !== this.element && part instanceof HTMLElement,
            ),
        );
    }

    /** Stops its sound and takes it off the page. */
    destroy(): void {
        this.stopSize();
        this.player.destroy();
        this.element.remove();
    }
}
