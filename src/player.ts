/**
 * `sonicframe/player`: a ready-made player (play button, wave, time, speed, skip, volume) with looks,
 * palettes and fonts, built on SonicFrame. Kept apart from the main entry, so an app that only draws
 * waves never loads it. `loadWaveform` and `readWaveform` are here too, so a player can take a
 * waveform file without the main entry.
 */

export {
    createPlayer,
    Player,
    type ButtonAnimation,
    type ChaptersPlugin,
    type PlayerA11y,
    type PlayerChapterList,
    type PlayerChapters,
    type PlayerDecode,
    type PlayerDescription,
    type PlayerEvents,
    type PlayerListenButton,
    type PlayerOptions,
    type PlayerZoom,
} from './player/player';
export {
    loadWaveform,
    readWaveform,
    type LoadWaveformOptions,
    type ReadWaveformOptions,
    type WaveformData,
} from './core/waveform';
export {
    loadChapters,
    readChapters,
    type Chapter,
    type ChapterInput,
    type LoadChaptersOptions,
} from './core/chapters';
export { defineSonicPlayer, PLAYER_ATTRIBUTES } from './player/element';
export {
    PLAYER_LABELS,
    playerWords,
    type PlayerLabels,
    type PlayerWords,
} from './core/labels';
export {
    DEFAULT_LOOK,
    PART_NAMES,
    resolveLook,
    type Part,
    type PlayerLook,
} from './core/look';
export {
    defineTheme,
    findTheme,
    registerTheme,
    type Theme,
    type ThemeInput,
} from './core/theme';
export { THEME_NAMES, THEMES, type ThemeName } from './core/themes';
export {
    DEFAULT_PALETTE,
    PALETTE_NAMES,
    PALETTES,
    paletteVariables,
    pickPalette,
    type Palette,
    type PaletteChoice,
    type PaletteName,
} from './core/palettes';
export {
    FONT_NAMES,
    FONT_STACKS,
    resolveFont,
    safeFontUrl,
    type FontChoice,
    type FontName,
    type FontSource,
} from './core/fonts';
