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
