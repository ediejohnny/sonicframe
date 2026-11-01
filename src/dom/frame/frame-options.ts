/** What a frame takes: its options, grouped by place, and the bars and colors it draws by default. */

import type { LanguageTag } from '../../core/languages/language';
import type { ValueText } from '../../core/frame/controller';
import { PROGRESS, WAVE } from '../../core/shared/variables';
import type { ZoomOptions, ZoomWords } from '../../core/view/zoom';
import type {
    BarStyle,
    Colors,
    PeaksSource,
    Plugin,
    WaveName,
    WaveStyle,
} from '../../types';

export type SonicFrameOptions = {
    /** The element to draw in. Its size comes from the page's CSS; give it a height. */
    container: HTMLElement;
    /**
     * Peaks (0..1), alone or with their duration (`{ peaks, duration }`, a waveform file's), or a
     * function that loads them when the frame comes near the screen.
     */
    peaks?: PeaksSource;
    /** An audio or video element to follow and control. */
    media?: HTMLMediaElement | null;
    /**
     * Duration in seconds, used until the media knows its own (or without media). It wins over the
     * duration the peaks came with.
     */
    duration?: number | null;
    bar?: Partial<BarStyle>;
    /** How the sound is drawn: a name (`'line'`, `'pulse'`, `'track'`…) or its details. Bars by default. */
    wave?: WaveName | Partial<WaveStyle>;
    colors?: Partial<Colors>;
    /** Width of the cursor line in CSS pixels (drawn only with a cursor color). */
    cursorWidth?: number;
    /** Click, drag and keys seek (a slider); false makes a picture only. */
    interact?: boolean;
    /** @deprecated Use `a11y.label`; `label` goes in 2.0. */
    label?: string;
    /** @deprecated Use `a11y.valueText`; `valueText` goes in 2.0. */
    valueText?: ValueText;
    /** Seconds moved by an arrow key. */
    stepSeconds?: number;
    /** Part of the sound moved by Page Up / Page Down. */
    largeStepRatio?: number;
    /** Show the start again when the media ends. */
    rewindOnEnd?: boolean;
    /** Keep pixels and load peaks only near the screen (many frames on one page). */
    lazy?: boolean;
    /** Let the bars grow in when peaks arrive (never with reduced motion). */
    animate?: boolean;
    /**
     * Zoom and scroll, off by default. `true` gives the view and its methods; each way of moving it
     * (keys, wheel, two fingers, following, edges) has its own switch in `ZoomOptions`.
     */
    zoom?: boolean | ZoomOptions;
    /** Accessibility options, by place and action. */
    a11y?: SonicFrameA11y;
    plugins?: readonly Plugin[];
};

export type SonicFrameA11y = {
    /**
     * The language of the wave's words and of its plugins': `'en'` (the default), `'pt'` (the
     * Portuguese of Brazil), `'pt-PT'`, `'es'`, `'fr'`, a registered one (`registerLanguage`), or
     * `'auto'` (the page's). A tag with a region finds its language (`'es-MX'` speaks Spanish).
     */
    lang?: LanguageTag;
    /** The wave's accessible name: `'Audio position'` in the frame's language. */
    label?: string;
    /** The position as words for screen readers; `0:12 / 0:45` by default. */
    valueText?: ValueText;
    zoom?: {
        /** Says the new view through the live region after a zoom by the keys, a button or two fingers. Off by default. */
        announce?: boolean;
        /** The words said; in the frame's language by default. */
        words?: Partial<ZoomWords>;
    };
};

export const DEFAULT_BAR: Readonly<BarStyle> = Object.freeze({
    width: 3,
    gap: 2,
    radius: 1.5,
    minHeight: 2,
    align: 'center',
    curve: 0.7,
});

export const DEFAULT_COLORS: Readonly<Colors> = Object.freeze({
    wave: WAVE,
    progress: PROGRESS,
    hover: 'auto',
    cursor: null,
    waveHover: null,
    progressHover: null,
    knob: null,
});
