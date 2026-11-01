/**
 * `sonicframe/analysis`: the pure sound-analysis functions on their own entry, safe to import in
 * Node or a worker with no DOM in the graph (a server can write a sound's description or its
 * waveform file ahead, or check a chapters file, say). The same functions are on the main entry too.
 * Every published name is listed here, so nothing a module shares inside the package leaks out.
 */

export {
    findSilences,
    levels,
    mixdown,
    nextSkip,
    peakLevel,
    silencesFromPeaks,
    type ChannelSource,
    type FindSilencesOptions,
    type Levels,
    type LevelsOptions,
    type PeakLevel,
    type Silence,
    type SilencesFromPeaksOptions,
} from './core/analysis/analysis';
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
    type SilenceKind,
    type SoundLevel,
    type SoundOutline,
    type SoundPart,
} from './core/description/outline';
export type {
    DescriptionWords,
    RecorderWords,
    Words,
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
    loadWaveform,
    readWaveform,
    type LoadWaveformOptions,
} from './core/peaks/read-waveform';
export { resample as resamplePeaks } from './core/peaks/peaks';
export type { FetchedResponse, Fetcher } from './core/shared/fetch';
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

// Names kept until 2.0: each works as before, and its note says what to use instead.

import {
    soundWords as describeSoundWords,
    DESCRIPTION_WORDS as descriptionWords,
    type SoundWords as DescribeSoundWords,
} from './core/description/describe';
import type { FetchedResponse, Fetcher } from './core/shared/fetch';

/** @deprecated The description plugin's own pieces; goes in 2.0. */
export const soundWords: typeof describeSoundWords = describeSoundWords;

/** @deprecated The description plugin's own pieces; goes in 2.0. */
export type SoundWords = DescribeSoundWords;

/** @deprecated Use `wordsFor(tag).description`; goes in 2.0. */
export const DESCRIPTION_WORDS: typeof descriptionWords = descriptionWords;

/** @deprecated Use `Fetcher`; goes in 2.0. */
export type WaveformFetcher = Fetcher;

/** @deprecated Use `Fetcher`; goes in 2.0. */
export type ChaptersFetcher = Fetcher;

/** @deprecated Use `FetchedResponse`; goes in 2.0. */
export type WaveformResponse = FetchedResponse;
