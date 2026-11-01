/**
 * `sonicframe/player`: a ready-made player (play button, wave, time, speed, skip, volume) with looks,
 * palettes and fonts, built on SonicFrame. Kept apart from the main entry, so an app that only draws
 * waves never loads it. `loadWaveform` and `readWaveform` are here too, so a player can take a
 * waveform file without the main entry.
 */

export { createPlayer, Player } from './player/player/player';
export type {
    ButtonAnimation,
    ChapterListLook,
    ChaptersPlugin,
    PlayerA11y,
    PlayerChapterList,
    PlayerChapterListStyle,
    PlayerChapters,
    PlayerDecode,
    PlayerDescription,
    PlayerEvents,
    MediaSessionOptions,
    MediaSessionPlugin,
    PlayerListenButton,
    PlayerMediaSession,
    PlayerOptions,
    PlayerZoom,
} from './player/player/player-options';
export type {
    BarStyle,
    ButtonFill,
    ButtonShape,
    ChaptersA11y,
    ChaptersOptions,
    MinimapOptions,
    PeaksSource,
    PlayButton,
    Plugin,
    SonicFrame,
    SoundDescriptionOptions,
    SpeechOptions,
    TooltipA11y,
    VolumeControl,
    WaveName,
    WaveStyle,
    ZoomOptions,
} from './player/player/player-types';
export {
    loadWaveform,
    readWaveform,
    type LoadWaveformOptions,
} from './core/peaks/read-waveform';
export type { ReadWaveformOptions, WaveformData } from './core/peaks/waveform';
export {
    loadChapters,
    readChapters,
    type Chapter,
    type ChapterInput,
    type ChaptersSource,
    type LoadChaptersOptions,
} from './core/chapters/chapters';
export { defineSonicPlayer, PLAYER_ATTRIBUTES } from './player/element/element';
export type { PlayerLabels, Words } from './core/languages/words';
export {
    LANGUAGE_NAMES,
    registerLanguage,
    wordsFor,
    type Language,
    type LanguageTag,
} from './core/languages/language';
export { languageProblems } from './core/languages/language-check';
export { PLAYER_LABELS } from './core/player/labels';
export {
    DEFAULT_LOOK,
    PART_NAMES,
    resolveLook,
    type Part,
    type PlayerLook,
} from './core/player/look';
export {
    BACKGROUND_EFFECTS,
    type Background,
    type BackgroundEffect,
    type BackgroundEffectName,
    type BackgroundFilters,
    type BackgroundGradient,
    type BackgroundImage,
    type BackgroundPosition,
    type BackgroundType,
} from './core/player/background';
export type {
    BackgroundAnimation,
    BackgroundAnimationType,
} from './core/player/background-animation';
export {
    defineTheme,
    findTheme,
    registerTheme,
    type Theme,
    type ThemeInput,
} from './core/player/theme';
export { THEME_NAMES, THEMES, type ThemeName } from './core/player/themes';
export {
    DEFAULT_PALETTE,
    PALETTE_NAMES,
    PALETTES,
    paletteVariables,
    type Palette,
    type PaletteChoice,
    type PaletteName,
} from './core/player/palettes';
export {
    FONT_NAMES,
    FONT_STACKS,
    type FontChoice,
    type FontName,
    type FontSource,
} from './core/player/fonts';

// Names kept until 2.0: each works as before, and its note says what to use instead.

import {
    playerWords as labelWords,
    type PlayerWords as LabelWords,
} from './core/player/labels';
import { pickPalette as choosePalette } from './core/player/palettes';
import {
    resolveFont as fontStack,
    safeFontUrl as fontUrl,
} from './core/player/fonts';

/** @deprecated The player's own words come from `wordsFor(tag).player`; goes in 2.0. */
export const playerWords: typeof labelWords = labelWords;

/** @deprecated The player's own words come from `wordsFor(tag).player`; goes in 2.0. */
export type PlayerWords = LabelWords;

/** @deprecated Use `PALETTES[name]`; the player picks the dark variant itself. Goes in 2.0. */
export const pickPalette: typeof choosePalette = choosePalette;

/** @deprecated The player resolves its `font` itself; goes in 2.0. */
export const resolveFont: typeof fontStack = fontStack;

/** @deprecated The player checks a font's address itself; goes in 2.0. */
export const safeFontUrl: typeof fontUrl = fontUrl;
