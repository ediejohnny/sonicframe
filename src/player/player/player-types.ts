/**
 * The types the player's options and getters reach that are defined outside the player (the wave,
 * the plugins, the controls), so `sonicframe/player` names every one of them without the main entry.
 */

export type { ZoomOptions } from '../../core/view/zoom';
export type { SonicFrame } from '../../dom/frame/frame';
export type { SpeechOptions } from '../../dom/a11y/speak';
export type { TooltipA11y } from '../../dom/shared/tooltip';
export type { PlayButton } from '../../controls/play/play-button';
export type { VolumeControl } from '../../controls/volume/volume';
export type { ButtonFill, ButtonShape } from '../../core/controls/button';
export type {
    ChaptersA11y,
    ChaptersOptions,
} from '../../plugins/chapters/chapters-options';
export type { SoundDescriptionOptions } from '../../plugins/description/description';
export type { MinimapOptions } from '../../plugins/minimap/minimap';
export type {
    BarStyle,
    PeaksSource,
    Plugin,
    WaveName,
    WaveStyle,
} from '../../types';
