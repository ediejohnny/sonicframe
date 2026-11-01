/**
 * The published names of the four entries: the types an app or a plugin needs to name, the old names
 * that still work until 2.0 (each marked `@deprecated` where the entry declares it), and the words
 * of a language as a frozen copy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';
import * as analysis from '../src/analysis';
import type {
    FindSilencesOptions,
    Levels,
    LevelsOptions,
    PeakLevel,
    SilenceKind,
    SilencesFromPeaksOptions,
} from '../src/analysis';
import * as main from '../src/index';
import type {
    ClipResult,
    FetchedResponse,
    Fetcher,
    KeyModifiers,
    Placement,
    PointerClaim,
    RecorderWords,
    TooltipA11y,
    VolumeLook,
    WavePoint,
} from '../src/index';
import type {
    BarStyle,
    ButtonFill,
    ButtonShape,
    ChaptersOptions,
    MinimapOptions,
    PeaksSource,
    PlayerChapterListStyle,
    PlayerOptions,
    Plugin,
    SoundDescriptionOptions,
    SpeechOptions,
    WaveName,
    WaveStyle,
    ZoomOptions,
} from '../src/player';
import * as record from '../src/record';
import type {
    LevelTrack,
    RecorderAfterSend,
    RecorderLive,
    RecorderScreenOptions,
} from '../src/record';

const root = join(import.meta.dirname, '..');

/** Whether `name` is declared in the entry file right under a `@deprecated` note. */
function deprecatedIn(entry: string, name: string): boolean {
    const text = readFileSync(join(root, 'src', entry), 'utf8');
    const declared = new RegExp(
        String.raw`@deprecated[^/]*\*/\s*export (?:const|type|function) ${name}\b`,
    );

    return declared.test(text);
}

describe('the names an app or a plugin needs', () => {
    it('names the plugin contract', () => {
        expectTypeOf<PointerClaim>().toEqualTypeOf<'take' | 'drag'>();
        expectTypeOf<Placement>().toEqualTypeOf<'above' | 'below'>();
        expectTypeOf<WavePoint['pointerType']>().toEqualTypeOf<
            'mouse' | 'touch' | 'pen'
        >();
        expectTypeOf<KeyModifiers>().toEqualTypeOf<{
            ctrlKey?: boolean;
            altKey?: boolean;
            metaKey?: boolean;
            repeat?: boolean;
        }>();
        expectTypeOf<TooltipA11y>().toEqualTypeOf<{
            tooltip?: { readable?: boolean };
        }>();
    });

    it('names what the loaders fetch and what a clip gives', () => {
        expectTypeOf<Fetcher>().toEqualTypeOf<
            (url: string) => Promise<FetchedResponse>
        >();
        expectTypeOf<FetchedResponse['arrayBuffer']>().toEqualTypeOf<
            () => Promise<ArrayBuffer>
        >();
        expectTypeOf<ClipResult>().toEqualTypeOf<{
            blob: Blob;
            mimeType: string;
            duration: number;
        }>();
        expectTypeOf<
            Parameters<main.VolumeControl['setLook']>[0]
        >().toEqualTypeOf<VolumeLook>();
    });

    it('names, on the player entry, every type its options reach', () => {
        expectTypeOf<PlayerOptions['minimap']>().toEqualTypeOf<
            boolean | MinimapOptions | undefined
        >();
        expectTypeOf<WaveName>().toEqualTypeOf<main.WaveName>();
        expectTypeOf<WaveStyle>().toEqualTypeOf<main.WaveStyle>();
        expectTypeOf<BarStyle>().toEqualTypeOf<main.BarStyle>();
        expectTypeOf<PeaksSource>().toEqualTypeOf<main.PeaksSource>();
        expectTypeOf<Plugin>().toEqualTypeOf<main.Plugin>();
        expectTypeOf<ZoomOptions>().toEqualTypeOf<main.ZoomOptions>();
        expectTypeOf<ChaptersOptions>().toEqualTypeOf<main.ChaptersOptions>();
        expectTypeOf<SpeechOptions>().toEqualTypeOf<main.SpeechOptions>();
        expectTypeOf<ButtonShape>().toEqualTypeOf<main.ButtonShape>();
        expectTypeOf<ButtonFill>().toEqualTypeOf<main.ButtonFill>();
        expectTypeOf<SoundDescriptionOptions>().toEqualTypeOf<main.SoundDescriptionOptions>();
        expectTypeOf<PlayerChapterListStyle>().toHaveProperty('border');
    });

    it('names the options and results of the analysis functions', () => {
        expectTypeOf<LevelsOptions>().toEqualTypeOf<{
            windowSeconds?: number;
        }>();
        expectTypeOf<Levels>().toEqualTypeOf<{
            rms: number[];
            peak: number[];
            windowSeconds: number;
        }>();
        expectTypeOf<SilencesFromPeaksOptions>().toEqualTypeOf<{
            threshold?: number;
            minDuration?: number;
        }>();
        expectTypeOf<FindSilencesOptions>().toHaveProperty('thresholdDb');
        expectTypeOf<PeakLevel>().toEqualTypeOf<{
            peak: number;
            peakDb: number;
            clipped: boolean;
            clipRuns: number;
        }>();
        expectTypeOf<SilenceKind>().toEqualTypeOf<'pause' | 'silence'>();
        expectTypeOf<analysis.RecorderWords>().toEqualTypeOf<RecorderWords>();
    });

    it('names the recorder screen choices, with their lists', () => {
        expectTypeOf<RecorderAfterSend>().toEqualTypeOf<'reset' | 'keep'>();
        expectTypeOf<RecorderLive>().toEqualTypeOf<'scroll' | 'fit'>();
        expectTypeOf<RecorderScreenOptions['afterSend']>().toEqualTypeOf<
            RecorderAfterSend | undefined
        >();
        expectTypeOf<record.Recorder['levels']>().toEqualTypeOf<LevelTrack>();
        expect(record.RECORDER_AFTER_SEND).toEqual(['reset', 'keep']);
        expect(record.RECORDER_LIVE).toEqual(['scroll', 'fit']);
        expect(record.RECORDER_ICONS).toEqual([
            'record',
            'stop',
            'pause',
            'resume',
            'discard',
            'send',
            'cancel',
        ]);
        expect(Object.isFrozen(record.RECORDER_ICONS)).toBe(true);
    });
});

describe('the words of a language', () => {
    it('gives every word of the language a tag finds', () => {
        expect(main.wordsFor('pt-BR').playButton.play).toBe('Reproduzir');
        expect(main.wordsFor('de').playButton.play).toBe('Play');
        expect(analysis.wordsFor).toBe(main.wordsFor);
    });

    it('never lets an app change the built-in words', () => {
        const words = main.wordsFor('en');

        expect(() => {
            (words.playButton as { play: string }).play = 'Go';
        }).toThrow(TypeError);
        expect(main.wordsFor('en').playButton.play).toBe('Play');
    });
});

describe('the old names, kept until 2.0', () => {
    it('keeps each renamed function as the same function', () => {
        expect(main.normalize).toBe(main.normalizePeaks);
        expect(main.resample).toBe(main.resamplePeaks);
        expect(analysis.resamplePeaks).toBe(main.resamplePeaks);
        expect(deprecatedIn('index.ts', 'normalize')).toBe(true);
        expect(deprecatedIn('index.ts', 'resample')).toBe(true);
    });

    it('keeps the renamed types as the new ones', () => {
        expectTypeOf<main.Claim>().toEqualTypeOf<PointerClaim>();
        expectTypeOf<main.WaveformFetcher>().toEqualTypeOf<Fetcher>();
        expectTypeOf<main.ChaptersFetcher>().toEqualTypeOf<Fetcher>();
        expectTypeOf<main.WaveformResponse>().toEqualTypeOf<FetchedResponse>();

        for (const name of [
            'Claim',
            'WaveformFetcher',
            'ChaptersFetcher',
            'WaveformResponse',
        ]) {
            expect(deprecatedIn('index.ts', name), name).toBe(true);
        }
    });

    it('marks every name that leaves in 2.0 where its entry declares it', () => {
        const leaving: Record<string, readonly string[]> = {
            'index.ts': [
                'markerSpans',
                'pickMimeType',
                'clipPlan',
                'MediaLike',
                'soundWords',
                'SoundWords',
                'CHAPTER_WORDS',
                'ZOOM_WORDS',
                'MINIMAP_WORDS',
                'DESCRIPTION_WORDS',
            ],
            'analysis.ts': [
                'soundWords',
                'SoundWords',
                'DESCRIPTION_WORDS',
                'ChaptersFetcher',
                'WaveformFetcher',
                'WaveformResponse',
            ],
            'player.ts': [
                'playerWords',
                'PlayerWords',
                'pickPalette',
                'resolveFont',
                'safeFontUrl',
            ],
            'record.ts': ['RecorderEvent', 'RECORDER_EVENTS'],
        };

        for (const [entry, names] of Object.entries(leaving)) {
            for (const name of names) {
                expect(deprecatedIn(entry, name), `${entry} ${name}`).toBe(
                    true,
                );
            }
        }
    });

    it('still gives the old values', () => {
        expect(main.markerSpans).toBeTypeOf('function');
        expect(main.soundWords).toBeTypeOf('function');
        expect(main.CHAPTER_WORDS).toEqual(main.wordsFor('en').chapters);
        expect(record.RECORDER_EVENTS.length).toBeGreaterThan(0);
    });
});
