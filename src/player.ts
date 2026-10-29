/**
 * `sonicframe/player`: a ready-made player (play button, wave, time, speed, skip, volume) with looks,
 * palettes and fonts, built on SonicFrame. Kept apart from the main entry, so an app that only draws
 * waves never loads it.
 */

export { createPlayer, Player, type PlayerOptions } from './player/player';
export {
    DEFAULT_LOOK,
    PART_NAMES,
    resolveLook,
    type Part,
    type PlayerLook,
} from './core/look';
export {
    PALETTE_NAMES,
    PALETTES,
    paletteVariables,
    pickPalette,
    type Palette,
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
