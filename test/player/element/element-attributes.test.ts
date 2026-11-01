/** What the tag's attributes turn into: the player's options. */

import { describe, expect, it } from 'vite-plus/test';
import { optionsOf } from '../../../src/player/element/element-attributes';
import type { PlayerChapters } from '../../../src/player/player/player-options';

/** The chapters' options of a `sonic-player` with chapters and these words in `chapter-options`. */
function chaptersOf(words: string): PlayerChapters {
    const element = document.createElement('sonic-player');
    element.setAttribute('chapters', '/talk.vtt');
    element.setAttribute('chapter-options', words);

    return optionsOf(element).chapters as PlayerChapters;
}

describe('chapter-options', () => {
    it('writes the tooltip of the chapters in black or white that reads with readable, and not without', () => {
        expect(chaptersOf('list readable').a11y?.tooltip?.readable).toBe(true);
        expect(chaptersOf('list').a11y?.tooltip?.readable).not.toBe(true);
    });
});

describe('a11y-chapters', () => {
    /** The chapters' options with these words in `a11y-chapters` (and `chapter-options`, if given). */
    function a11yOf(words: string, options = 'list'): PlayerChapters['a11y'] {
        const element = document.createElement('sonic-player');
        element.setAttribute('chapters', '/talk.vtt');
        element.setAttribute('chapter-options', options);
        element.setAttribute('a11y-chapters', words);

        return (optionsOf(element).chapters as PlayerChapters).a11y;
    }

    it('turns the announcement, the readable tooltip and the slider note on and off', () => {
        expect(a11yOf('announce readable')).toMatchObject({
            announce: true,
            tooltip: { readable: true },
        });
        expect(a11yOf('no-value-note')?.valueNote).toBe(false);
        expect(a11yOf('')?.announce).not.toBe(true);
    });

    it('takes over the words the chapter-options attribute used to carry', () => {
        expect(a11yOf('', 'list announce readable')).toMatchObject({
            announce: true,
            tooltip: { readable: true },
        });
    });
});
