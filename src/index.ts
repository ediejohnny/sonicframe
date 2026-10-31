/**
 * SonicFrame.js: audio visualization and interaction framework for the web.
 * https://www.npmjs.com/package/sonicframe (MIT)
 */

export { SonicFrame } from './dom/frame/frame';
export {
    DEFAULT_BAR,
    DEFAULT_COLORS,
    type SonicFrameA11y,
    type SonicFrameOptions,
} from './dom/frame/frame-options';
export {
    DEFAULT_BUTTON_COLORS,
    PlayButton,
    type PlayButtonEvents,
    type PlayButtonOptions,
} from './controls/play/play-button';
export type {
    ButtonColors,
    ButtonFill,
    ButtonLook,
    ButtonShape,
} from './core/controls/button';
export {
    DEFAULT_VOLUME_COLORS,
    VolumeControl,
    type VolumeColors,
    type VolumeControlEvents,
    type VolumeControlOptions,
} from './controls/volume/volume';
export { markerSpans, type Mark } from './core/marks/markers';
export {
    markers,
    type MarkersOptions,
    type MarkersPlugin,
} from './plugins/markers/markers';
export {
    caption,
    type CaptionOptions,
    type CaptionPlugin,
    type TooltipContent,
    type TooltipSection,
} from './plugins/caption/caption';
export {
    regions,
    type RegionsOptions,
    type RegionsPlugin,
} from './plugins/regions/regions';
export type { Region } from './plugins/regions/region-store';
export { timeline, type TimelineOptions } from './plugins/timeline/timeline';
export { chapters } from './plugins/chapters/chapters';
export {
    CHAPTER_WORDS,
    type ChaptersKeys,
    type ChaptersOptions,
    type ChaptersPlugin,
} from './plugins/chapters/chapters-options';
export type { ChapterListLook } from './plugins/chapters/chapter-list-look';
export type {
    ChapterWords,
    DescriptionWords,
    MarkerWords,
    RegionWords,
    Words,
} from './core/languages/words';
export {
    LANGUAGE_NAMES,
    registerLanguage,
    type Language,
} from './core/languages/language';
export { languageProblems } from './core/languages/language-check';
export {
    minimap,
    MINIMAP_WORDS,
    type MinimapOptions,
    type MinimapWords,
} from './plugins/minimap/minimap';
export {
    soundDescription,
    type SoundDescriptionKeys,
    type SoundDescriptionOptions,
    type SoundDescriptionPlugin,
} from './plugins/description/description';
export type { SpeechOptions } from './dom/a11y/speak';
export {
    MEDIA_SESSION_ACTIONS,
    mediaSession,
    type MediaSessionActionName,
    type MediaSessionOptions,
    type MediaSessionPlugin,
} from './plugins/media-session/media-session';
export type {
    MediaSessionArtwork,
    MediaSessionDetails,
} from './core/session/media-session';
export {
    skipSilences,
    type SkipSilencesOptions,
    type SkipSilencesPlugin,
} from './plugins/skip-silences/skip-silences';
export {
    findSilences,
    levels,
    mixdown,
    nextSkip,
    peakLevel,
    silencesFromPeaks,
    type ChannelSource,
    type Silence,
} from './core/analysis/analysis';
export {
    DESCRIPTION_WORDS,
    describeSound,
    soundWords,
    type DescribeOptions,
    type SoundWords,
} from './core/description/describe';
export {
    nextPart,
    outlineSound,
    partAt,
    silenceAt,
    type OutlineOptions,
    type SoundLevel,
    type SoundOutline,
    type SoundPart,
} from './core/description/outline';
export {
    spectrogram,
    type ColorStops,
    type DecodedAudio,
    type SpectrogramPluginOptions,
} from './plugins/spectrogram/spectrogram';
export {
    createSpectrogram,
    type SpectrogramJob,
    type SpectrogramOptions,
} from './core/analysis/spectrogram';
export {
    buildColormap,
    colormap,
    type ColormapName,
} from './core/analysis/colormap';
export { liveFrequency, type LiveFrequencyOptions } from './plugins/live/live';
export { frequencyBands, MAX_BANDS } from './core/analysis/bands';
export { canTapMedia } from './core/analysis/origin';
export { exportClip, type ClipOptions } from './dom/clip/clip';
export {
    clipPlan,
    DEFAULT_CLIP_TYPES,
    DEFAULT_MAX_SOURCE_SECONDS,
    pickMimeType,
} from './core/wave/clip';
export {
    loadPeaks,
    MAX_PEAKS,
    normalize,
    peaksFromChannel,
    readPeaks,
    resample,
    type PeaksFetcher,
} from './core/peaks/peaks';
export {
    loadWaveform,
    readWaveform,
    type LoadWaveformOptions,
    type WaveformFetcher,
    type WaveformResponse,
} from './core/peaks/read-waveform';
export type {
    ReadWaveformOptions,
    WaveformData,
    WaveformFormat,
} from './core/peaks/waveform';
export {
    writeWaveform,
    type WaveformJson,
    type WriteWaveformOptions,
} from './core/peaks/write-waveform';
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
} from './core/chapters/chapters';
export { safeUrl } from './core/shared/url';
export { DEFAULT_WAVE, WAVE_NAMES } from './core/wave/shapes';
export type { View, ViewState } from './core/view/view';
export {
    MAX_ZOOM,
    ZOOM_WORDS,
    type ViewSource,
    type ZoomKey,
    type ZoomOptions,
    type ZoomWords,
} from './core/view/zoom';
export { formatPosition, formatTime } from './core/shared/timing';
export type { ValueText } from './core/frame/controller';
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
export const VERSION: string = '0.5.0';
