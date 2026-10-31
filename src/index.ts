/**
 * SonicFrame.js: audio visualization and interaction framework for the web.
 * https://www.npmjs.com/package/sonicframe (MIT)
 */

export {
    DEFAULT_BAR,
    DEFAULT_COLORS,
    SonicFrame,
    type SonicFrameA11y,
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
    DEFAULT_VOLUME_COLORS,
    VolumeControl,
    type VolumeColors,
    type VolumeControlEvents,
    type VolumeControlOptions,
} from './controls/volume';
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
    CHAPTER_WORDS,
    chapters,
    type ChaptersKeys,
    type ChaptersOptions,
    type ChaptersPlugin,
    type ChapterWords,
} from './plugins/chapters';
export {
    minimap,
    MINIMAP_WORDS,
    type MinimapOptions,
    type MinimapWords,
} from './plugins/minimap';
export {
    soundDescription,
    type SoundDescriptionKeys,
    type SoundDescriptionOptions,
    type SoundDescriptionPlugin,
} from './plugins/description';
export type { SpeechOptions } from './dom/speak';
export {
    skipSilences,
    type SkipSilencesOptions,
    type SkipSilencesPlugin,
} from './plugins/skip-silences';
export {
    findSilences,
    levels,
    mixdown,
    nextSkip,
    peakLevel,
    silencesFromPeaks,
    type ChannelSource,
    type Silence,
} from './core/analysis';
export {
    DESCRIPTION_WORDS,
    describeSound,
    nextPart,
    outlineSound,
    partAt,
    silenceAt,
    soundWords,
    type DescribeOptions,
    type DescriptionWords,
    type OutlineOptions,
    type SoundLevel,
    type SoundOutline,
    type SoundPart,
    type SoundWords,
} from './core/describe';
export {
    spectrogram,
    type ColorStops,
    type DecodedAudio,
    type SpectrogramPluginOptions,
} from './plugins/spectrogram';
export {
    createSpectrogram,
    type SpectrogramJob,
    type SpectrogramOptions,
} from './core/spectrogram';
export { buildColormap, colormap, type ColormapName } from './core/colormap';
export { liveFrequency, type LiveFrequencyOptions } from './plugins/live';
export { frequencyBands, MAX_BANDS } from './core/bands';
export { canTapMedia } from './core/origin';
export { exportClip, type ClipOptions } from './dom/clip';
export {
    clipPlan,
    DEFAULT_CLIP_TYPES,
    DEFAULT_MAX_SOURCE_SECONDS,
    pickMimeType,
} from './core/clip';
export {
    loadPeaks,
    MAX_PEAKS,
    normalize,
    peaksFromChannel,
    readPeaks,
    resample,
    type PeaksFetcher,
} from './core/peaks';
export {
    loadWaveform,
    readWaveform,
    writeWaveform,
    type LoadWaveformOptions,
    type ReadWaveformOptions,
    type WaveformData,
    type WaveformFetcher,
    type WaveformFormat,
    type WaveformJson,
    type WaveformResponse,
    type WriteWaveformOptions,
} from './core/waveform';
export {
    chapterAt,
    chapterEnds,
    loadChapters,
    MAX_CHAPTERS,
    nextChapter,
    readChapters,
    type Chapter,
    type ChapterInput,
    type ChaptersFetcher,
    type LoadChaptersOptions,
} from './core/chapters';
export { safeUrl } from './core/url';
export { DEFAULT_WAVE, WAVE_NAMES } from './core/shapes';
export type { View, ViewState } from './core/view';
export {
    MAX_ZOOM,
    ZOOM_WORDS,
    type ViewSource,
    type ZoomKey,
    type ZoomOptions,
    type ZoomWords,
} from './core/zoom';
export { formatTime } from './core/timing';
export type { ValueText } from './core/controller';
export type {
    BarStyle,
    Colors,
    FrameGeometry,
    Lane,
    MediaLike,
    PaintContext,
    PeaksData,
    PeaksSource,
    Plugin,
    PluginHost,
    SeekEvent,
    SeekSource,
    SonicFrameEvents,
    WaveName,
    WaveStyle,
} from './types';

/** The version of this build of SonicFrame. */
export const VERSION: string = '0.4.1';
