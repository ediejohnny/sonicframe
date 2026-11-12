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
    type VolumeLook,
} from './controls/volume/volume';
export type { Mark } from './core/marks/markers';
export {
    markers,
    type MarkersA11y,
    type MarkersKeys,
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
export { regions } from './plugins/regions/regions';
export type {
    RegionsKeys,
    RegionsOptions,
    RegionsPlugin,
} from './plugins/regions/regions-options';
export type { Region } from './plugins/regions/region-store';
export type { RegionInput } from './core/marks/regions';
export type { CsvSeparator } from './core/marks/csv';
export {
    readMarkers,
    readRegions,
    type MarksReadOptions,
} from './core/marks/read-marks';
export {
    MARKS_FORMATS,
    writeMarkers,
    writeRegions,
    type MarkersWriteOptions,
    type MarksFormat,
    type MarksWriteOptions,
} from './core/marks/write-marks';
export { timeline, type TimelineOptions } from './plugins/timeline/timeline';
export { chapters } from './plugins/chapters/chapters';
export {
    type ChaptersA11y,
    type ChaptersKeys,
    type ChaptersOptions,
    type ChaptersPlugin,
} from './plugins/chapters/chapters-options';
export type { ChapterListLook, MediaListLook } from './dom/list/list-look';
export type {
    ChapterWords,
    DescriptionWords,
    MarkerWords,
    RecorderWords,
    RegionWords,
    Words,
    CompleteWords,
    PlaylistWords,
} from './core/languages/words';
export {
    LANGUAGE_NAMES,
    registerLanguage,
    wordsFor,
    type Language,
    type LanguageTag,
} from './core/languages/language';
export { languageProblems } from './core/languages/language-check';
export {
    minimap,
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
    describeSound,
    type DescribeOptions,
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
export { exportClip, type ClipOptions, type ClipResult } from './dom/clip/clip';
export {
    DEFAULT_CLIP_TYPES,
    DEFAULT_MAX_SOURCE_SECONDS,
} from './core/wave/clip';
export {
    loadPeaks,
    MAX_PEAKS,
    normalize as normalizePeaks,
    peaksFromChannel,
    readPeaks,
    resample as resamplePeaks,
    type LoadPeaksOptions,
    type PeaksFetcher,
} from './core/peaks/peaks';
export type { FetchedResponse, Fetcher } from './core/shared/fetch';
export {
    loadWaveform,
    readWaveform,
    type LoadWaveformOptions,
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
    type ChaptersSource,
    type LoadChaptersOptions,
} from './core/chapters/chapters';
export { safeUrl } from './core/shared/url';
export type { CssLength } from './core/shared/length';
export { DEFAULT_WAVE, WAVE_NAMES } from './core/wave/shapes';
export type { View, ViewState } from './core/view/view';
export {
    MAX_ZOOM,
    type ViewSource,
    type ZoomKey,
    type ZoomOptions,
    type ZoomWords,
} from './core/view/zoom';
export { formatPosition, formatTime } from './core/shared/timing';
export {
    formatClock,
    type ClockDigits,
    type ClockFormat,
    type ClockHours,
    type ClockPrecision,
} from './core/shared/clock';
export type { ValueText } from './core/frame/controller';
export type { KeyModifiers } from './core/frame/keys';
export type { TooltipA11y } from './dom/shared/tooltip';
export type {
    BarStyle,
    Colors,
    FrameGeometry,
    Lane,
    PaintContext,
    PeaksData,
    PeaksSource,
    Placement,
    Plugin,
    PluginHost,
    PointerClaim,
    SeekEvent,
    SeekSource,
    SonicFrameEvents,
    WaveName,
    WavePoint,
    WaveStyle,
} from './types';

/** The version of this build of SonicFrame. */
export const VERSION: string = '1.1.0';

// Names kept until 2.0: each works as before, and its note says what to use instead.

import { CHAPTER_WORDS as chapterWords } from './plugins/chapters/chapters-options';
import {
    soundWords as describeSoundWords,
    DESCRIPTION_WORDS as descriptionWords,
    type SoundWords as DescribeSoundWords,
} from './core/description/describe';
import { markerSpans as spans } from './core/marks/markers';
import { MINIMAP_WORDS as minimapWords } from './plugins/minimap/minimap';
import {
    normalize as peaksNormalize,
    resample as peaksResample,
} from './core/peaks/peaks';
import { ZOOM_WORDS as zoomWords } from './core/view/zoom';
import {
    clipPlan as planClip,
    pickMimeType as pickClipType,
} from './core/wave/clip';
import type { FetchedResponse, Fetcher } from './core/shared/fetch';
import type { MediaLike as FollowedMedia, PointerClaim } from './types';

/** @deprecated Use `normalizePeaks`; `normalize` goes in 2.0. */
export const normalize: typeof peaksNormalize = peaksNormalize;

/** @deprecated Use `resamplePeaks`; `resample` goes in 2.0. */
export const resample: typeof peaksResample = peaksResample;

/** @deprecated The 0.1 markers' spans, kept for the `times` form of `markers()`; goes in 2.0. */
export const markerSpans: typeof spans = spans;

/** @deprecated `exportClip` picks the type itself; goes in 2.0. */
export const pickMimeType: typeof pickClipType = pickClipType;

/** @deprecated `exportClip` plans the clip itself; goes in 2.0. */
export const clipPlan: typeof planClip = planClip;

/** @deprecated The description plugin's own pieces; goes in 2.0. */
export const soundWords: typeof describeSoundWords = describeSoundWords;

/** @deprecated The description plugin's own pieces; goes in 2.0. */
export type SoundWords = DescribeSoundWords;

/** @deprecated Use `wordsFor('en').chapters`; goes in 2.0. */
export const CHAPTER_WORDS: typeof chapterWords = chapterWords;

/** @deprecated Use `wordsFor('en').zoom`; goes in 2.0. */
export const ZOOM_WORDS: typeof zoomWords = zoomWords;

/** @deprecated Use `wordsFor('en').minimap`; goes in 2.0. */
export const MINIMAP_WORDS: typeof minimapWords = minimapWords;

/** @deprecated Use `wordsFor(tag).description`; goes in 2.0. */
export const DESCRIPTION_WORDS: typeof descriptionWords = descriptionWords;

/** @deprecated The frame's own view of the media; no public signature takes it. Goes in 2.0. */
export type MediaLike = FollowedMedia;

/** @deprecated Use `PointerClaim`; goes in 2.0. */
export type Claim = PointerClaim;

/** @deprecated Use `Fetcher`; goes in 2.0. */
export type WaveformFetcher = Fetcher;

/** @deprecated Use `Fetcher`; goes in 2.0. */
export type ChaptersFetcher = Fetcher;

/** @deprecated Use `FetchedResponse`; goes in 2.0. */
export type WaveformResponse = FetchedResponse;
