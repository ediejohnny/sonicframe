/**
 * What a recording shows and says while it runs: the time recorded, the live wave (kept while the
 * screen records or pauses, let go after), and, when asked, the time said every few seconds.
 */

import type { ThemeParts } from '../../core/player/theme';
import type { LevelTrack } from '../../core/recording/levels';
import type { RecorderSay } from '../../core/recording/recorder-words';
import { within } from '../../core/shared/checked';
import { formatTime } from '../../core/shared/timing';
import { announce } from '../../dom/a11y/announce';
import { css } from '../../dom/shared/css';
import { LiveWave } from './live-wave';
import type { RecorderScreenOptions } from './screen-options';

export class LiveView {
    private wave: LiveWave | null = null;
    private time: HTMLElement | null = null;
    /** How many times the time was said in this recording. */
    private spoken = 0;

    constructor(
        private readonly parts: ThemeParts,
        private readonly options: RecorderScreenOptions,
        private readonly words: RecorderSay,
    ) {}

    /** A recording starts: the time is said again from its start. */
    begin(): void {
        this.spoken = 0;
    }

    /** Forgets the parts drawn before; the wave stays only while `recording` says so. */
    clear(recording: boolean): void {
        this.time = null;

        if (!recording) {
            this.release();
        }
    }

    /** The time recorded, as text. */
    timePart(seconds: number): HTMLElement {
        const time = document.createElement('span');
        time.className = 'sonicframe-recorder-time';
        time.textContent = formatTime(seconds);
        css(time, [['white-space', 'nowrap']]);
        this.time = time;

        return time;
    }

    /** The live wave, made once per recording. */
    wavePart(): HTMLElement {
        this.wave ??= new LiveWave(
            this.parts.look,
            this.parts.wave,
            this.parts.bar,
        );

        return this.wave.element;
    }

    /** Shows `seconds` and the levels, and says the time when its turn comes. */
    show(seconds: number, levels: LevelTrack): void {
        const text = formatTime(seconds);

        if (this.time !== null && this.time.textContent !== text) {
            this.time.textContent = text;
        }

        this.wave?.show(
            this.options.live === 'fit'
                ? levels.levels
                : levels.last(within(this.options.window, 10, 2, 60)),
        );

        const every = within(this.options.a11y?.announceEvery, 0, 0, 3600);

        if (every > 0 && Math.floor(seconds / every) > this.spoken) {
            this.spoken = Math.floor(seconds / every);
            announce(
                this.words.say('elapsed', {
                    time: formatTime(this.spoken * every),
                }),
            );
        }
    }

    /** Lets the live wave go. */
    release(): void {
        this.wave?.destroy();
        this.wave = null;
    }
}
