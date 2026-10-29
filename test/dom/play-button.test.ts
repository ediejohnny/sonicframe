/**
 * The play button's keyboard focus ring takes the color through `outline-color` only: a user color
 * never goes into a shorthand.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { PlayButton } from '../../src/index';
import { fakeMedia, focusRing } from './helpers';

let button: PlayButton | null = null;

afterEach(() => {
    button?.destroy();
    button = null;
});

describe('the play button', () => {
    it('rings the focus with outline-color, never the outline shorthand', () => {
        const host = document.createElement('div');
        document.body.append(host);
        button = PlayButton.create({
            container: host,
            media: fakeMedia({ duration: 10 }),
        });

        const names = focusRing(button.element);

        expect(names).toContain('outline-color');
        expect(names).not.toContain('outline');
        host.remove();
    });
});
