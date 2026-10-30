/**
 * Zoom on the ready-made player: off unless asked; on, the wave zooms by the ways switched on, and
 * buttons come only when asked, placed by the look (or at the end of the line), named in the
 * player's language and marked `aria-disabled` at the limits so focus is never lost. A minimap
 * strip comes when asked, sized by the look and a slider only with `a11y.minimap.keys`. The
 * decoded peaks can be counted per second of sound, and the view's moves reach the player's
 * listeners.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createPlayer, type Player } from '../../src/player';
import { boxOf, fakeMedia } from './helpers';
import { triggerResize, triggerVisible } from './fakes';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
    vi.unstubAllGlobals();
});

function container(): HTMLElement {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 320, height: 48 });

    return host;
}

const PEAKS = Array.from({ length: 2000 }, (_, i) => (i % 9) / 9);

function button(name: string): HTMLButtonElement | null {
    return (host as HTMLElement).querySelector<HTMLButtonElement>(
        `.sonicframe-${name}`,
    );
}

/** The class names of the main line's children that are zoom buttons, in order. */
function lineButtons(): string[] {
    return [...(host as HTMLElement).querySelectorAll('button')]
        .map((element) => element.className)
        .filter((name) => name.startsWith('sonicframe-zoom'));
}

describe('zoom on the player', () => {
    it('is off by default: no buttons, and the wave keeps the whole sound', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            look: { line: ['play', 'wave', 'zoomIn'] },
        });
        player.frame.zoomTo(4);

        expect(lineButtons()).toEqual([]);
        expect(player.frame.view.level).toBe(1);
    });

    it('zooms the wave when on, with no buttons unless asked', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: { keys: true },
        });
        player.frame.zoomTo(4, 0.5);

        expect(player.frame.view.level).toBeCloseTo(4, 9);
        expect(lineButtons()).toEqual([]);
    });

    it('puts the three buttons at the end of the line when asked, or where the look says', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: { buttons: true },
        });

        expect(lineButtons()).toEqual([
            'sonicframe-zoom-out',
            'sonicframe-zoom-reset',
            'sonicframe-zoom-in',
        ]);

        player.setLook({ line: ['zoomIn', 'play', 'wave', 'zoomOut'] });

        expect(lineButtons()).toEqual([
            'sonicframe-zoom-in',
            'sonicframe-zoom-out',
        ]);
    });

    it('keeps the wave at least 8rem wide beside the buttons, the line wrapping below it on a phone', () => {
        const shapes = (): { wrap: string; wave: string } => {
            const line = (host as HTMLElement).querySelector<HTMLElement>(
                '.sonicframe-player > div',
            );
            const wave = player?.frame.container.parentElement;

            return {
                wrap: line?.style.getPropertyValue('flex-wrap') ?? '',
                wave: wave?.style.getPropertyValue('min-width') ?? '',
            };
        };

        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: { buttons: true },
        });

        expect(shapes()).toEqual({ wrap: 'wrap', wave: '8rem' });

        player.destroy();
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: { keys: true },
        });

        // Without the buttons, the line is as it always was: the wave gives up the room.
        expect(shapes()).toEqual({ wrap: 'nowrap', wave: '0' });
    });

    it('zooms in, out and back with its buttons, marked aria-disabled at the limits', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: { buttons: true, max: 4, step: 2 },
        });
        const zoomIn = button('zoom-in') as HTMLButtonElement;
        const zoomOut = button('zoom-out') as HTMLButtonElement;
        const reset = button('zoom-reset') as HTMLButtonElement;

        expect(zoomOut.getAttribute('aria-disabled')).toBe('true');
        expect(reset.getAttribute('aria-disabled')).toBe('true');
        expect(zoomIn.getAttribute('aria-disabled')).toBe('false');

        zoomIn.click();
        zoomIn.click();

        expect(player.frame.view.level).toBeCloseTo(4, 9);
        expect(zoomIn.getAttribute('aria-disabled')).toBe('true');
        expect(zoomOut.getAttribute('aria-disabled')).toBe('false');
        expect(zoomIn.disabled).toBe(false);

        zoomIn.click();
        expect(player.frame.view.level).toBeCloseTo(4, 9);

        zoomOut.click();
        expect(player.frame.view.level).toBeCloseTo(2, 9);

        reset.click();
        expect(player.frame.view.level).toBe(1);
        expect(reset.getAttribute('aria-disabled')).toBe('true');
    });

    it('names its buttons in the player language, and says a zoom by them when asked', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 120 }),
            peaks: PEAKS,
            zoom: { buttons: true, anchor: 'center' },
            a11y: { lang: 'pt', zoom: { announce: true } },
        });

        expect(button('zoom-in')?.getAttribute('aria-label')).toBe('Aproximar');
        expect(button('zoom-out')?.getAttribute('aria-label')).toBe('Afastar');
        expect(button('zoom-reset')?.getAttribute('aria-label')).toBe(
            'Mostrar o som inteiro',
        );

        button('zoom-in')?.click();

        expect(
            document.querySelector('[aria-live="polite"]')?.textContent,
        ).toBe('Zoom 2×, de 0:30 a 1:30');
    });

    it('tells its listeners when the view moves', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: true,
        });
        const heard: string[] = [];
        player.on('viewchange', (_view, source) => heard.push(source));

        player.frame.setView(0.25, 0.5);

        expect(heard).toEqual(['api']);
    });
});

describe('the minimap on the player', () => {
    it('comes when asked, its height from the look in rem, hidden from screen readers by default', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: true,
            minimap: true,
            look: { minimapHeight: 2, minimapGap: 0.5 },
        });
        // Room for the wave and the strip, so the lanes are laid out.
        boxOf(player.frame.container, {
            left: 0,
            top: 0,
            width: 320,
            height: 80,
        });
        triggerResize(
            (host as HTMLElement).querySelector('canvas') as HTMLCanvasElement,
            { width: 200, height: 48 },
        );
        const strip = (host as HTMLElement).querySelector<HTMLElement>(
            '.sonicframe-minimap',
        );

        expect(strip).not.toBeNull();
        expect(strip?.getAttribute('aria-hidden')).toBe('true');
        // 2 rem of strip and 0.5 rem of space.
        expect(strip?.style.getPropertyValue('height')).toBe('40px');
        // The strip adds to the wave's 2.5 rem instead of taking from it.
        expect(player.frame.container.style.getPropertyValue('height')).toBe(
            'calc(2.5rem + 40px)',
        );
    });

    it('is a slider named in the player language with a11y.minimap.keys', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 120 }),
            peaks: PEAKS,
            zoom: true,
            minimap: true,
            a11y: { lang: 'pt', minimap: { keys: true } },
        });
        player.frame.setView(0, 0.5);
        const strip = (host as HTMLElement).querySelector<HTMLElement>(
            '.sonicframe-minimap',
        );

        expect(strip?.getAttribute('role')).toBe('slider');
        expect(strip?.getAttribute('aria-label')).toBe('Parte visível');
        expect(strip?.getAttribute('aria-valuetext')).toBe(
            '0:00 a 1:00 de 2:00',
        );
    });

    it('is not there unless asked', () => {
        player = createPlayer({
            container: container(),
            media: fakeMedia({ duration: 60 }),
            peaks: PEAKS,
            zoom: true,
        });

        expect(
            (host as HTMLElement).querySelector('.sonicframe-minimap'),
        ).toBeNull();
        expect(player.frame.container.style.getPropertyValue('height')).toBe(
            '2.5rem',
        );
    });
});

describe('decoding on the player', () => {
    /** A sound `seconds` long at 1000 samples per second, decoded by a stand-in. */
    function decodable(seconds: number): void {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(new Response(new Uint8Array(8)))),
        );
        vi.stubGlobal(
            'OfflineAudioContext',
            class {
                decodeAudioData(): Promise<AudioBuffer> {
                    const data = Float32Array.from(
                        { length: seconds * 1000 },
                        (_, i) => Math.sin(i),
                    );

                    return Promise.resolve({
                        length: data.length,
                        duration: seconds,
                        sampleRate: 1000,
                        numberOfChannels: 1,
                        getChannelData: () => data,
                    } as unknown as AudioBuffer);
                }
            },
        );
    }

    async function peaksOf(options: object): Promise<number> {
        player = createPlayer({
            container: container(),
            src: 'a.ogg',
            ...options,
        });
        const canvas = (host as HTMLElement).querySelector(
            'canvas',
        ) as HTMLCanvasElement;
        triggerResize(canvas, { width: 200, height: 40 });
        triggerVisible(canvas, true);
        const frame = player.frame;
        await vi.waitFor(() => expect(frame.peaks).not.toBeNull(), {
            timeout: 3_000,
            interval: 10,
        });

        return frame.peaks?.length ?? 0;
    }

    it('decodes 1000 peaks by default, or as many as asked', async () => {
        decodable(30);
        expect(await peaksOf({})).toBe(1000);

        player?.destroy();
        host?.remove();
        decodable(30);
        expect(await peaksOf({ decode: { peaks: 300 } })).toBe(300);
    });

    it('decodes peaks per second of sound with zoom on, never fewer than the count', async () => {
        decodable(30);
        expect(await peaksOf({ zoom: true })).toBe(3000);

        player?.destroy();
        host?.remove();
        decodable(30);
        expect(
            await peaksOf({ zoom: true, decode: { peaksPerSecond: 10 } }),
        ).toBe(1000);
    });
});
