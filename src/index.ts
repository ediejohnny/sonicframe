/**
 * SonicFrame.js: audio visualization and interaction framework for the web.
 * https://www.npmjs.com/package/sonicframe (MIT)
 */

export {
    DEFAULT_BAR,
    DEFAULT_COLORS,
    SonicFrame,
    type SonicFrameOptions,
} from './dom/frame';
export {
    DEFAULT_BUTTON_COLORS,
    PlayButton,
    type PlayButtonEvents,
    type PlayButtonOptions,
} from './controls/play-button';
export type {
    ButtonColors,
    ButtonFill,
    ButtonLook,
    ButtonShape,
} from './core/button';
export {
    markers,
    markerSpans,
    type Mark,
    type MarkersOptions,
    type MarkersPlugin,
} from './plugins/markers';
export {
    caption,
    type CaptionOptions,
    type CaptionPlugin,
    type TooltipContent,
    type TooltipSection,
} from './plugins/caption';
export {
    regions,
    type Region,
    type RegionsOptions,
    type RegionsPlugin,
} from './plugins/regions';
export { timeline, type TimelineOptions } from './plugins/timeline';
export {
    loadPeaks,
    MAX_PEAKS,
    normalize,
    peaksFromChannel,
    readPeaks,
    resample,
    type PeaksFetcher,
} from './core/peaks';
export { formatTime } from './core/timing';
export type { ValueText } from './core/controller';
export type {
    BarStyle,
    Colors,
    FrameGeometry,
    Lane,
    MediaLike,
    PaintContext,
    PeaksSource,
    Plugin,
    PluginHost,
    SeekEvent,
    SeekSource,
    SonicFrameEvents,
} from './types';

/** The version of this build of SonicFrame. */
export const VERSION: string = '0.1.0';
