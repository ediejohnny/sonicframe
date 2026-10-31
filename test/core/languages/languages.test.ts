/**
 * The language files: every language has every phrase English has and the same marks, a tag finds
 * its language the BCP 47 way, an app's words count only under the names SonicFrame has, and every
 * language's words stay SonicFrame's own, so no app can change what the players on a page say.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { DESCRIPTION_WORDS } from '../../../src/core/description/describe';
import { EN } from '../../../src/core/languages/en';
import {
    LANGUAGE_NAMES,
    resolveLanguage,
    wordsFor,
} from '../../../src/core/languages/language';
import type { PlayerLabels } from '../../../src/core/languages/words';
import { PLAYER_LABELS, playerWords } from '../../../src/core/player/labels';

/** The files of the languages folder that are not a language. */
const NOT_LANGUAGES = [
    'language-check.ts',
    'language.ts',
    'merge-words.ts',
    'words.ts',
];

const folder = fileURLToPath(
    new URL('../../../src/core/languages/', import.meta.url),
);

/** A phrase's marks, each once, sorted. */
function marks(phrase: string): string[] {
    return [...new Set(phrase.match(/\{\w+\}/g) ?? [])].sort();
}

describe('the built-in languages', () => {
    it('registers every language file in the folder, under the name of its file', () => {
        const files = readdirSync(folder).filter(
            (file) => !NOT_LANGUAGES.includes(file),
        );

        expect(files.sort()).toEqual(
            LANGUAGE_NAMES.map((name) => `${name.toLowerCase()}.ts`).sort(),
        );
    });

    it('gives each language every phrase of English, nothing more, with the same marks', () => {
        const english = EN as unknown as Record<string, Record<string, string>>;

        for (const name of LANGUAGE_NAMES) {
            const words = wordsFor(name) as unknown as Record<
                string,
                Record<string, string>
            >;

            expect(resolveLanguage(name), name).toBe(name);
            expect(Object.keys(words).sort(), name).toEqual(
                Object.keys(english).sort(),
            );

            for (const group of Object.keys(english)) {
                expect(
                    Object.keys(words[group]).sort(),
                    `${name} ${group}`,
                ).toEqual(Object.keys(english[group]).sort());

                for (const [key, phrase] of Object.entries(english[group])) {
                    const place = `${name} ${group}.${key}`;

                    expect(typeof words[group][key], place).toBe('string');
                    expect(marks(words[group][key]), place).toEqual(
                        marks(phrase),
                    );
                }
            }
        }
    });

    it('falls back to English for a tag that names something every object has', () => {
        for (const tag of [
            'constructor',
            '__proto__',
            'toString-BR',
            'valueOf',
        ]) {
            expect(resolveLanguage(tag), tag).toBe('en');
        }
    });

    it('takes from the app only the words it has a name for', () => {
        const own = {
            play: 'Tocar',
            invented: 'Nada',
        } as Partial<PlayerLabels>;
        const labels = playerWords('pt', own).labels;

        expect(labels.play).toBe('Tocar');
        expect(labels).not.toHaveProperty('invented');
    });

    it("keeps every language's words frozen, so an app cannot change them for the page", () => {
        for (const words of [PLAYER_LABELS, DESCRIPTION_WORDS]) {
            expect(Object.isFrozen(words)).toBe(true);
            expect(Object.keys(words).sort()).toEqual([
                'en',
                'es',
                'fr',
                'pt',
                'pt-PT',
            ]);

            for (const language of Object.values(words)) {
                expect(Object.isFrozen(language)).toBe(true);
            }
        }
    });
});

describe('finding the language of a tag', () => {
    it('takes the whole tag first, then shorter ones, then English', () => {
        const players: [string | null | undefined, string][] = [
            ['en', 'Audio player'],
            ['en-US', 'Audio player'],
            ['en-GB', 'Audio player'],
            ['pt', 'Player de áudio'],
            ['pt-BR', 'Player de áudio'],
            ['PT_br', 'Player de áudio'],
            ['pt-AO', 'Player de áudio'],
            ['pt-PT', 'Leitor de áudio'],
            ['pt-pt', 'Leitor de áudio'],
            ['pt_PT', 'Leitor de áudio'],
            ['pt-PT-x-old', 'Leitor de áudio'],
            [' es ', 'Reproductor de audio'],
            ['es-MX', 'Reproductor de audio'],
            ['es-419', 'Reproductor de audio'],
            ['fr', 'Lecteur audio'],
            ['fr-CA', 'Lecteur audio'],
            ['de', 'Audio player'],
            ['zh-Hant-TW', 'Audio player'],
            ['', 'Audio player'],
            [null, 'Audio player'],
            [undefined, 'Audio player'],
            [`pt-${'x'.repeat(40)}`, 'Audio player'],
        ];

        for (const [tag, player] of players) {
            expect(wordsFor(tag).player.player, String(tag)).toBe(player);
        }
    });

    it('formats numbers in the language it found', () => {
        expect(playerWords('pt-PT').number(1.5)).toBe('1,5');
        expect(playerWords('es').number(1.5)).toBe('1,5');
        expect(playerWords('fr-CA').number(1.5)).toBe('1,5');
        expect(playerWords('en').number(1.5)).toBe('1.5');
    });
});
