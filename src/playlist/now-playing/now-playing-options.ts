/**
 * The options of the now-playing bar (`nowPlaying`), and the options checked: unknown names fall back
 * to their defaults, numbers stay in their ranges, parts are kept once and in order.
 */

import type { LanguageTag } from '../../core/languages/language';
import type { NowPlayingWords } from '../../core/languages/words';
import type { FontChoice } from '../../core/player/fonts';
import type { PaletteChoice } from '../../core/player/palettes';
import { oneOf, within } from '../../core/shared/checked';
import type { PlayerChapterListStyle } from '../../player/player/player-options';

/** What the bar can hold. */
export type NowPlayingPart =
    | 'play'
    | 'title'
    | 'time'
    | 'progress'
    | 'close'
    | 'previousTrack'
    | 'nextTrack'
    | 'back'
    | 'speed';

export const NOW_PLAYING_PARTS: readonly NowPlayingPart[] = Object.freeze([
    'play',
    'title',
    'time',
    'progress',
    'close',
    'previousTrack',
    'nextTrack',
    'back',
    'speed',
] as const);

export type NowPlayingOptions = {
    /** The longest word or name of the bar, in characters: 120, from 1 to 1000; past either end, a `RangeError`. */
    maxText?: number;
    /**
     * When it shows: `'outOfView'` (the default: the player is playing and out of view), `'playing'`
     * (whenever it plays) or `'always'` (from the first play on, paused too).
     */
    when?: 'outOfView' | 'playing' | 'always';
    /** `'bottom'` (the default) or `'top'` of the window. */
    place?: 'bottom' | 'top';
    /** `'stretch'` (the default: the window's width), `'start'`, `'center'` or `'end'`. */
    align?: 'stretch' | 'start' | 'center' | 'end';
    /** Space from the window's edge, in rem: 0.5, from 0 to 20 (room for an app's own fixed bar). */
    offset?: number;
    /** The width when it does not stretch, in rem: 28, from 10 to 60. */
    width?: number;
    /** Its stacking order: 2147483640 (over the page, under SonicFrame's floating lists), from 0. */
    zIndex?: number;
    /** What it holds, in order: play, title, time, progress and close by default. */
    parts?: readonly NowPlayingPart[];
    /** `'player'` (the default: the colors of the player playing), a palette name, `'auto'` or your colors. */
    palette?: 'player' | PaletteChoice;
    /** Its own font; the player's by default. */
    font?: FontChoice;
    /** Its own box: corner, border, shadow, padding, text size. */
    box?: PlayerChapterListStyle;
    /** Closed, it stays away `'untilNextPlay'` (the default) or `'forPage'`. */
    close?: 'untilNextPlay' | 'forPage';
    /** It moves in as it shows, never for people who asked for less motion. Off by default. */
    animation?: boolean;
    /** `'slide'` (the default) or `'fade'`. */
    animationType?: 'slide' | 'fade';
    a11y?: {
        /** The bar's name as a region: its `bar` word ("Now playing") by default. */
        label?: string;
        /** Says the sound's name when the bar shows. Off by default. */
        announce?: boolean;
        lang?: LanguageTag;
        words?: Partial<NowPlayingWords>;
    };
};

export type NowPlayingSettings = {
    when: 'outOfView' | 'playing' | 'always';
    place: 'bottom' | 'top';
    align: 'stretch' | 'start' | 'center' | 'end';
    /** In rem. */
    offset: number;
    /** In rem. */
    width: number;
    zIndex: number;
    parts: readonly NowPlayingPart[];
    close: 'untilNextPlay' | 'forPage';
    animation: boolean;
    animationType: 'slide' | 'fade';
    announce: boolean;
};

const DEFAULT_PARTS: readonly NowPlayingPart[] = [
    'play',
    'title',
    'time',
    'progress',
    'close',
];

export function nowPlayingSettings(
    options: NowPlayingOptions,
): NowPlayingSettings {
    const parts = Array.isArray(options.parts)
        ? [...new Set(options.parts)].filter((part) =>
              NOW_PLAYING_PARTS.includes(part),
          )
        : DEFAULT_PARTS;

    return {
        when: oneOf(
            options.when,
            ['outOfView', 'playing', 'always'] as const,
            'outOfView',
        ),
        place: oneOf(options.place, ['bottom', 'top'] as const, 'bottom'),
        align: oneOf(
            options.align,
            ['stretch', 'start', 'center', 'end'] as const,
            'stretch',
        ),
        offset: within(options.offset, 0.5, 0, 20),
        width: within(options.width, 28, 10, 60),
        zIndex: within(options.zIndex, 2147483640, 0, 2147483647, Math.round),
        parts,
        close: oneOf(
            options.close,
            ['untilNextPlay', 'forPage'] as const,
            'untilNextPlay',
        ),
        animation: options.animation === true,
        animationType: oneOf(
            options.animationType,
            ['slide', 'fade'] as const,
            'slide',
        ),
        announce: options.a11y?.announce === true,
    };
}
