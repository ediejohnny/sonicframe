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
    markers,
    markerSpans,
    type MarkersOptions,
    type MarkersPlugin,
} from './plugins/markers';
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
export const VERSION: string = '0.0.0';
