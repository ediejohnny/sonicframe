/**
 * The play button's keyboard focus ring takes the color through `outline-color` only: a user color
 * never goes into a shorthand.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { PlayButton } from '../../../src/index';
import { fakeMedia, focusRing, pageHost } from '../../support/helpers';

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

    it("keeps its usual 32 px and its shape's corners when the size or radius is not a number, set up or changed", () => {
        for (const odd of [Number.NaN, '4' as unknown as number]) {
            button = PlayButton.create({
                container: pageHost({
                    left: 0,
                    top: 0,
                    width: 100,
                    height: 40,
                }),
                media: fakeMedia({ duration: 10 }),
                size: odd,
                radius: odd,
            });
            const style = button.element.style;

            expect(style.getPropertyValue('width')).toBe('32px');
            expect(style.getPropertyValue('border-radius')).toBe('50%');

            button.setLook({ size: odd, radius: odd });
            expect(style.getPropertyValue('width')).toBe('32px');
            expect(style.getPropertyValue('border-radius')).toBe('50%');
            button.destroy();
        }
    });
});
