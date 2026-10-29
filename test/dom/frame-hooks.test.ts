/**
 * What the frame tells plugins and asks of them for the description of a sound: when its peaks
 * arrive or change, and the notes plugins add to the slider's value in words.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { Plugin, PluginHost } from '../../src/index';
import { fakeMedia, mount, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

describe('peaks arriving', () => {
    it('tells listeners when the peaks load, change or go', async () => {
        mounted = mount({
            peaks: () => Promise.resolve([0.5, 1]),
            lazy: false,
        });
        const heard: (readonly number[] | null)[] = [];
        mounted.frame.on('peakschange', (peaks) => heard.push(peaks));

        await new Promise((resolve) => setTimeout(resolve, 0));
        mounted.frame.setPeaks([0.25]);
        mounted.frame.setPeaks(null);

        expect(heard).toEqual([[0.5, 1], [0.25], null]);
    });
});

describe("a plugin's note on the slider's value", () => {
    it('is added after the position, in words', () => {
        mounted = mount({ media: fakeMedia({ duration: 10 }) });
        mounted.frame.use({ name: 'note', valueNote: () => 'pause' });

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:10, pause',
        );
    });

    it('is asked again when the plugin says it changed, and leaves with the plugin', () => {
        let note = '';
        let host: PluginHost | null = null;
        const plugin: Plugin = {
            name: 'note',
            setup: (frame) => {
                host = frame;
            },
            valueNote: () => note,
        };
        mounted = mount({ media: fakeMedia({ duration: 10 }) });
        const remove = mounted.frame.use(plugin);

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:10',
        );

        note = 'pause';
        (host as PluginHost | null)?.updateValueText();

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:10, pause',
        );

        remove();

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:10',
        );
    });

    it('never breaks the value when the plugin throws', () => {
        const errors: unknown[] = [];
        mounted = mount({ media: fakeMedia({ duration: 10 }) });
        mounted.frame.on('error', (error) => errors.push(error));
        mounted.frame.use({
            name: 'broken',
            valueNote: () => {
                throw new Error('broken note');
            },
        });

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:10',
        );
        expect(errors).toHaveLength(1);
    });
});
