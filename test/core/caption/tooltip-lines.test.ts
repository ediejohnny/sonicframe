/** What a caption's tooltip says: the caption itself, the app's text, or labelled sections. */

import { describe, expect, it } from 'vite-plus/test';
import { tooltipLines } from '../../../src/core/caption/tooltip-lines';

describe('tooltipLines', () => {
    it('repeats the caption without content of its own, and says nothing for no caption', () => {
        expect(tooltipLines(null, 'hello there', 280)).toEqual(['hello there']);
        expect(tooltipLines(null, '', 280)).toEqual([]);
        expect(tooltipLines(null, null, 280)).toEqual([]);
    });

    it('gives one line per section, its label before its text', () => {
        expect(
            tooltipLines(
                [{ label: 'Auto-transcript', text: 'hello' }, { text: 'bye' }],
                'caption',
                280,
            ),
        ).toEqual(['Auto-transcript: hello', 'bye']);
    });

    it("takes the app's text over the caption", () => {
        expect(tooltipLines('the whole story', 'short', 280)).toEqual([
            'the whole story',
        ]);
    });
});
