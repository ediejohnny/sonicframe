/**
 * The player of a recording in review: made once per recording, dressed by the screen's theme with
 * no box of its own (the screen is the box), and speaking the screen's language.
 */

import { createPlayer, type Player } from '../../player/player/player';
import { css } from '../../dom/shared/css';
import type { Recording } from '../recorder/recorder';
import type { RecorderScreenOptions } from './screen-options';

export class ReviewPlayer {
    readonly element: HTMLDivElement;
    readonly player: Player;

    constructor(
        options: RecorderScreenOptions,
        label: string,
        recording: Recording,
        address: string,
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
                ...options.look,
                padding: 0,
                border: 0,
                surface: 'none',
                shadow: 'none',
                background: null,
            },
            a11y: { lang: options.a11y?.lang },
        });
    }

    /** Stops its sound and takes it off the page. */
    destroy(): void {
        this.player.destroy();
        this.element.remove();
    }
}
