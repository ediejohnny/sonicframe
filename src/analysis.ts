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
    type Silence,
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
    type ChaptersFetcher,
    type LoadChaptersOptions,
} from './core/chapters/chapters';
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
export type { DescriptionWords, Words } from './core/languages/words';
export {
    LANGUAGE_NAMES,
    registerLanguage,
    type Language,
} from './core/languages/language';
export { languageProblems } from './core/languages/language-check';
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
