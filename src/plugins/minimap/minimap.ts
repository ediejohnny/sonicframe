/**
 * A minimap: a strip above or below the wave with the whole sound, the played part and a box over
 * the part in view (zoom on). Dragging the box scrolls the view, a click beside it brings the view
 * there and the wheel can zoom, each with its own switch; a press on it never seeks. It is hidden
 * from screen readers unless `a11y.keys` makes it a keyboard slider of the part in view. Its colors
 * follow the page's theme variables.
 */

import { EN } from '../../core/languages/en';
import { within } from '../../core/shared/checked';
import { fillTemplate } from '../../core/shared/text';
import { ratioText } from '../../core/shared/timing';
import { PROGRESS, REGION, WAVE } from '../../core/shared/variables';
import { isFullView } from '../../core/view/view';
import { DEFAULT_WAVE, resolveWave } from '../../core/wave/shapes';
import type {
    BarStyle,
    Lane,
    Plugin,
    PluginHost,
    WaveName,
    WaveStyle,
} from '../../types';
import {
    MinimapControls,
    type MinimapControlSettings,
} from './minimap-controls';
import { MinimapPicture, type MinimapLook } from './minimap-picture';

/** The words of the minimap as a slider; `total` is the sound's length. */
export type MinimapWords = {
    value(from: string, to: string, total: string): string;
};

export type MinimapOptions = {
    /** Above or below the wave: `'below'`. */
    side?: 'above' | 'below';
    /** The strip's height, in CSS pixels: 24. */
    height?: number;
    /** Space between the strip and the wave (or the lane next to it), in CSS pixels: 4. */
    gap?: number;
    /** How the sound is drawn in the strip: thin bars by default. */
    wave?: WaveName | Partial<WaveStyle>;
    bar?: Partial<BarStyle>;
    /** Colors (any CSS color or `var()`); by default the page's theme variables. */
    colors?: { wave?: string; progress?: string; view?: string; edge?: string };
    /** Paints the played part: on. */
    progress?: boolean;
    controls?: {
        /** Dragging the box scrolls the view: on. */
        drag?: boolean;
        /** A click beside the box brings the view there: on. */
        click?: boolean;
        /** The wheel over the strip zooms around the pointer: off. */
        wheel?: boolean;
    };
    /**
     * The mouse cursor (any CSS cursor): `'grab'` over the box, `'grabbing'` while dragging it,
     * `'pointer'` beside it. Where a press does nothing (its control off), the plain arrow.
     */
    cursors?: { box?: string; moving?: string; beside?: string };
    /** Takes no room while the whole sound is in view: off. */
    autoHide?: boolean;
    a11y?: {
        /**
         * Makes the strip a keyboard slider of the part in view (arrows, Page Up/Down, Home, End).
         * Off: the strip is hidden from screen readers.
         */
        keys?: boolean;
        /** Its accessible name: `'Visible part'`. */
        label?: string;
        /** Its value in words: English by default. */
        words?: Partial<MinimapWords>;
    };
};

export const MINIMAP_WORDS: Readonly<MinimapWords> = Object.freeze({
    value: (from: string, to: string, total: string) =>
        fillTemplate(EN.minimap.value, { from, to, total }),
});

const MINIMAP_BAR: Readonly<BarStyle> = Object.freeze({
    width: 2,
    gap: 1,
    radius: 0,
    minHeight: 1,
    align: 'center',
    curve: 0.7,
});

const COLORS = {
    wave: WAVE,
    progress: PROGRESS,
    view: `var(--sonicframe-minimap-view, ${REGION})`,
    edge: `var(--sonicframe-minimap-edge, ${PROGRESS})`,
};

/**
 * The strip's height and the space on its wave side, in CSS pixels: 24 and 4 unless given; the
 * height is at least 4 and the space at least 0.
 */
export function minimapSize(options: Pick<MinimapOptions, 'height' | 'gap'>): {
    height: number;
    gap: number;
} {
    return {
        height: within(options.height, 24, 4, Number.POSITIVE_INFINITY),
        gap: within(options.gap, 4, 0, Number.POSITIVE_INFINITY),
    };
}

export function minimap(options: MinimapOptions = {}): Plugin {
    const side = options.side === 'above' ? 'above' : 'below';
    const { height, gap } = minimapSize(options);
    /** The lane's room: the strip and the space on its wave side. */
    const laneSize = height + gap;
    const look: MinimapLook = {
        height,
        wave: resolveWave({ ...DEFAULT_WAVE, style: 'bars' }, options.wave),
        bar: { ...MINIMAP_BAR, ...options.bar },
        colors: { ...COLORS, ...options.colors },
        progress: options.progress !== false,
    };
    const drag = options.controls?.drag !== false;
    const click = options.controls?.click !== false;
    const keys = options.a11y?.keys === true;
    const settings: MinimapControlSettings = {
        drag,
        click,
        wheel: options.controls?.wheel === true,
        keys,
        cursors: {
            box: drag ? (options.cursors?.box ?? 'grab') : 'default',
            moving: options.cursors?.moving ?? 'grabbing',
            beside: click ? (options.cursors?.beside ?? 'pointer') : 'default',
        },
    };
    const autoHide = options.autoHide === true;
    const words: MinimapWords = { ...MINIMAP_WORDS, ...options.a11y?.words };

    let host: PluginHost | null = null;
    let lane: Lane | null = null;
    let picture: MinimapPicture | null = null;
    let controls: MinimapControls | null = null;
    const cleanups: (() => void)[] = [];

    /** The slider's value and words for the view (keys on). */
    function describe(): void {
        const frame = host;
        const element = lane?.element;

        if (!keys || frame === null || element === undefined) {
            return;
        }

        const { start, end } = frame.view;
        const duration = frame.duration;
        const at = (ratio: number): string => ratioText(ratio, duration);
        const room = 1 - (end - start);

        element.setAttribute(
            'aria-valuenow',
            String(room > 0 ? Math.round((start / room) * 100) : 0),
        );
        element.setAttribute(
            'aria-valuetext',
            words.value(at(start), at(end), duration === null ? '100%' : at(1)),
        );
    }

    /** Shows or hides the strip at the whole sound (autoHide), and says the new value. */
    function viewChanged(): void {
        const frame = host;

        if (frame !== null && autoHide) {
            lane?.setSize(isFullView(frame.view) ? 0 : laneSize);
        }

        describe();
    }

    return {
        name: 'minimap',
        layer: 'over',

        setup(frame): void {
            host = frame;
            lane = frame.addLane(
                side,
                autoHide && isFullView(frame.view) ? 0 : laneSize,
            );
            const element = lane.element;
            element.classList.add('sonicframe-minimap');
            picture = new MinimapPicture(look, side, gap);
            element.append(picture.canvas);
            controls = new MinimapControls(frame, element, settings);

            if (keys) {
                element.setAttribute('role', 'slider');
                element.setAttribute('tabindex', '0');
                element.setAttribute(
                    'aria-label',
                    options.a11y?.label ?? EN.minimap.label,
                );
                element.setAttribute('aria-valuemin', '0');
                element.setAttribute('aria-valuemax', '100');
            } else {
                element.setAttribute('aria-hidden', 'true');
            }

            cleanups.push(
                frame.on('viewchange', viewChanged),
                frame.on('durationchange', describe),
            );
            describe();
        },

        draw(paint): void {
            if (host !== null) {
                picture?.paint(paint, host.peaks);
            }
        },

        destroy(): void {
            controls?.destroy();

            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            lane?.remove();
            lane = null;
            picture = null;
            controls = null;
            host = null;
        },
    };
}
