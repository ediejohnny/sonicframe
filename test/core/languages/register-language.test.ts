/**
 * An app's own language: registered whole under a BCP 47 tag, found by every tag of that language,
 * cleaned and frozen like the built-in ones, and refused when it would replace a built-in language
 * or lacks a phrase or a mark.
 */

import { describe, expect, it } from 'vite-plus/test';
import { soundWords } from '../../../src/core/description/describe';
import { EN } from '../../../src/core/languages/en';
import {
    localeFor,
    registerLanguage,
    resolveLanguage,
    wordsFor,
} from '../../../src/core/languages/language';
import { languageProblems } from '../../../src/core/languages/language-check';
import { PT } from '../../../src/core/languages/pt';
import type { Words } from '../../../src/core/languages/words';
import { playerWords } from '../../../src/core/player/labels';

/** English with a few phrases changed, so the language is known by them. */
function language(play: string, extra: Partial<Words> = {}): Words {
    return {
        ...EN,
        playButton: { play, pause: 'Pause' },
        description: { ...EN.description, noPart: `${play}: no part.` },
        ...extra,
    };
}

describe('registering a language', () => {
    it('gives every piece the language under its tag, and under the longer tags of it', () => {
        expect(registerLanguage('ja', language('Saisei'))).toBe(true);

        expect(resolveLanguage('ja-JP')).toBe('ja');
        expect(wordsFor('ja-JP').playButton.play).toBe('Saisei');
        expect(playerWords('ja').labels.play).toBe('Saisei');
        expect(soundWords({ lang: 'ja' }).noPart()).toBe('Saisei: no part.');
        expect(localeFor('ja-JP', false)).toBe('ja-JP');
    });

    it('lets a longer tag of a built-in language have its own words', () => {
        expect(registerLanguage('pt-AO', language('Tocar'))).toBe(true);

        expect(wordsFor('pt-AO').playButton.play).toBe('Tocar');
        expect(wordsFor('pt-BR').playButton.play).toBe('Reproduzir');
    });

    it('never replaces a built-in language, whatever the spelling of its tag', () => {
        for (const tag of [
            'en',
            'EN',
            'en-US',
            'pt',
            'pt-br',
            'pt-PT',
            'es',
            'fr',
        ]) {
            expect(registerLanguage(tag, language('Hacked')), tag).toBe(false);
            expect(wordsFor(tag).playButton.play, tag).not.toBe('Hacked');
        }
    });

    it('refuses a tag that is not BCP 47', () => {
        for (const tag of ['', 'not a tag', 'x'.repeat(40), 'ja_JP']) {
            expect(registerLanguage(tag, language('Bad')), tag).toBe(false);
        }

        expect(wordsFor('ja_JP').playButton.play).not.toBe('Bad');
    });

    it('refuses words with a phrase missing, a mark changed or a name of its own', () => {
        const missing = language('Missing', {
            markers: {} as Words['markers'],
        });
        const marks = language('Marks', {
            markers: { more: 'and more', none: 'None' },
        });
        const extra = language('Extra', {
            markers: {
                more: '+{count}',
                none: 'None',
                other: 'x',
            } as unknown as Words['markers'],
        });

        expect(registerLanguage('ko', missing)).toBe(false);
        expect(registerLanguage('ko', marks)).toBe(false);
        expect(registerLanguage('ko', extra)).toBe(false);
        expect(wordsFor('ko').playButton.play).toBe('Play');
    });

    it('takes a language written for 1.0, saying the phrases added later in English', () => {
        // Portuguese as 1.1 had it: no track buttons, no playlist.
        const { previousTrack, nextTrack, ...player } = PT.player;
        const { playlist, ...older } = PT;
        const words: Words = { ...older, player };

        expect([previousTrack, nextTrack, playlist.shuffle]).not.toContain(
            undefined,
        );
        expect(languageProblems(words)).toEqual([]);
        expect(registerLanguage('gl', words)).toBe(true);

        const found = wordsFor('gl');

        expect(found.playButton.play).toBe('Reproduzir');
        expect(found.player.previousTrack).toBe('Previous track');
        expect(found.player.nextTrack).toBe('Next track');
        expect(found.playlist.shuffle).toBe('Shuffle');
        expect(found.playlist.playing).toBe(
            'Playing: {title}, {place} of {count}',
        );
    });

    it('still checks the marks of a later phrase a language does give', () => {
        const words = language('Marks', {
            playlist: { playing: 'Now: {title}' },
        });

        expect(languageProblems(words)).toEqual([
            'playlist.playing must have the marks {count} {place} {title}',
        ]);
        expect(registerLanguage('eu', words)).toBe(false);
    });

    it('replaces a language registered before under the same tag', () => {
        expect(registerLanguage('it', language('Riproduci'))).toBe(true);
        expect(registerLanguage('IT', language('Avvia'))).toBe(true);

        expect(wordsFor('it').playButton.play).toBe('Avvia');
    });

    it('keeps its own clean, frozen copy of the words', () => {
        const bell = String.fromCharCode(7);
        const words = language(`Spela${bell}\nnu`);

        expect(registerLanguage('sv', words)).toBe(true);
        words.playButton.play = 'Changed';

        const found = wordsFor('sv');

        expect(found.playButton.play).toBe('Spela nu');
        expect(Object.isFrozen(found)).toBe(true);
        expect(Object.isFrozen(found.playButton)).toBe(true);
    });
});
