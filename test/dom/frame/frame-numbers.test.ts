/** The frame's numbers from outside: anything that is not a number takes the default. */

import { describe, expect, it } from 'vite-plus/test';
import { pressKey } from '../../support/events';
import { fakeMedia, mount, mountShown, repainted } from '../../support/helpers';

/** Not numbers: NaN, and a number written as text. */
const ODD = [Number.NaN, '20' as unknown as number];

describe('numbers that are not numbers', () => {
    it('steps by the usual 5 seconds and a tenth of the sound with the keys', () => {
        for (const odd of ODD) {
            const media = fakeMedia({ duration: 40 });
            const { container } = mount({
                media,
                stepSeconds: odd,
                largeStepRatio: odd,
            });

            pressKey(container, 'ArrowRight');
            expect(media.currentTime).toBe(5);

            pressKey(container, 'PageUp');
            expect(media.currentTime).toBe(9);
        }
    });

    it('keeps the large step at least a hundredth of the sound, so Page Up never goes back', () => {
        const media = fakeMedia({ duration: 40 });
        const { container } = mount({ media, largeStepRatio: -0.2 });

        pressKey(container, 'PageUp');

        expect(media.currentTime).toBe(0.4);
    });

    it('draws the cursor 2 pixels wide', async () => {
        for (const odd of ODD) {
            const shown = mountShown({
                peaks: [0.5, 0.5],
                colors: { cursor: 'red' },
                cursorWidth: odd,
            });
            shown.frame.setProgress(0.5);

            expect(
                (await repainted(shown, 'red')).map((box) => box.width),
            ).toEqual([2]);
        }
    });
});
