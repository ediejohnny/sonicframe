/**
 * The language files: a language is picked only by its own name, an app's words count only under
 * the names SonicFrame has, and every language's words stay SonicFrame's own, so no app can change
 * what the players on a page say.
 */

import { describe, expect, it } from 'vite-plus/test';
import { DESCRIPTION_WORDS } from '../../../src/core/description/describe';
import { resolveLanguage } from '../../../src/core/languages/language';
import type { PlayerLabels } from '../../../src/core/languages/words';
import { PLAYER_LABELS, playerWords } from '../../../src/core/player/labels';

describe('the built-in languages', () => {
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

            for (const language of Object.values(words)) {
                expect(Object.isFrozen(language)).toBe(true);
            }
        }
    });
});
