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
    PlayerChapters,
    PlayerDecode,
    PlayerDescription,
    PlayerEvents,
    PlayerListenButton,
    PlayerOptions,
    PlayerZoom,
} from './player/player/player-options';
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
    type LoadChaptersOptions,
} from './core/chapters/chapters';
export { defineSonicPlayer, PLAYER_ATTRIBUTES } from './player/element/element';
export type { PlayerLabels, Words } from './core/languages/words';
export {
    LANGUAGE_NAMES,
    registerLanguage,
    type Language,
} from './core/languages/language';
export { languageProblems } from './core/languages/language-check';
export {
    PLAYER_LABELS,
    playerWords,
    type PlayerWords,
} from './core/player/labels';
export {
    DEFAULT_LOOK,
    PART_NAMES,
    resolveLook,
    type Part,
    type PlayerLook,
} from './core/player/look';
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
    pickPalette,
    type Palette,
    type PaletteChoice,
    type PaletteName,
} from './core/player/palettes';
export {
    FONT_NAMES,
    FONT_STACKS,
    resolveFont,
    safeFontUrl,
    type FontChoice,
    type FontName,
    type FontSource,
} from './core/player/fonts';
