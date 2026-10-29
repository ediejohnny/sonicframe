/**
 * Every color a plugin draws can be themed through a custom property on the page, so a palette (or
 * plain CSS) reaches the region band, the dimmed silences, the marker pill's text and the caption's
 * badges, not only the bars.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { caption, markers, regions, skipSilences } from '../../src/index';
import { fakeMedia, mount, nextFrame, type Mounted } from './helpers';
import { recordingOf, triggerResize, triggerVisible } from './fakes';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
});

async function draw(): Promise<string[]> {
    const frame = mounted as Mounted;
    triggerResize(frame.canvas, { width: 200, height: 40 });
    triggerVisible(frame.canvas, true);
    frame.frame.invalidate();
    await nextFrame();

    return recordingOf(frame.canvas).fills;
}

describe('theme variables', () => {
    it('paints the region band from --sonicframe-region', async () => {
        mounted = mount({
            lazy: false,
            duration: 40,
            plugins: [regions({ items: [{ start: 4, end: 12 }] })],
        });
        mounted.container.style.setProperty('--sonicframe-region', '#123456');

        expect(await draw()).toContain('#123456');
    });

    it('dims the silences with --sonicframe-dim', async () => {
        mounted = mount({
            lazy: false,
            duration: 40,
            plugins: [
                skipSilences({ silences: [{ start: 4, end: 12 }], dim: true }),
            ],
        });
        mounted.container.style.setProperty('--sonicframe-dim', '#654321');

        expect(await draw()).toContain('#654321');
    });

    it('writes the marker count with --sonicframe-on-progress', async () => {
        mounted = mount({
            lazy: false,
            media: fakeMedia({ duration: 40 }),
            plugins: [markers({ marks: [{ time: 5 }, { time: 5.2 }] })],
        });
        mounted.container.style.setProperty(
            '--sonicframe-on-progress',
            '#abcdef',
        );

        expect(await draw()).toContain('#abcdef');
    });

    it('colors the caption badges from --sonicframe-badge', () => {
        mounted = mount({
            plugins: [caption({ text: 'hello', badges: ['auto'] })],
        });

        const badge = [...mounted.container.querySelectorAll('span')].find(
            (span) => span.textContent === 'auto',
        );

        expect(badge?.style.backgroundColor).toContain('--sonicframe-badge');
    });
});
