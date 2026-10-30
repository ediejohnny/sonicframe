/**
 * `<sonic-player>`: nothing is registered on import; once defined, its attributes build the player,
 * a changed attribute updates it, untrusted attribute values fall back without injecting anything,
 * removing the element destroys the player and putting it back builds it again, and the player's
 * events reach the element.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineSonicPlayer, PALETTES } from '../../src/player';
import { triggerResize, triggerVisible } from './fakes';
import { boxOf } from './helpers';

const made: HTMLElement[] = [];

afterEach(() => {
    for (const element of made.splice(0)) {
        element.remove();
    }

    vi.unstubAllGlobals();
});

function tag(attributes: Record<string, string>): HTMLElement {
    const element = document.createElement('sonic-player');

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    made.push(element);

    return element;
}

function player(element: HTMLElement): HTMLElement | null {
    return element.querySelector<HTMLElement>('.sonicframe-player');
}

function surface(element: HTMLElement): string {
    return (
        player(element)?.style.getPropertyValue('--sonicframe-surface') ?? ''
    );
}

describe('the <sonic-player> tag', () => {
    it('does nothing until defined, then builds the player from its attributes', () => {
        const element = tag({
            src: 'note.ogg',
            peaks: '/peaks/note.json',
            palette: 'ocean',
        });
        document.body.append(element);
        expect(player(element)).toBeNull();

        expect(defineSonicPlayer()).toBe(true);

        expect(player(element)).not.toBeNull();
        expect(surface(element)).toBe(PALETTES.ocean.surface);
        expect(element.querySelector('audio')?.getAttribute('src')).toBe(
            'note.ogg',
        );
    });

    it('is defined once, and only under a valid custom element name', () => {
        expect(defineSonicPlayer()).toBe(false);
        expect(defineSonicPlayer('nodash')).toBe(false);
        expect(defineSonicPlayer('Bad-Name')).toBe(false);
    });

    it('follows a changed attribute', () => {
        const element = tag({
            src: 'note.ogg',
            peaks: '/p.json',
            palette: 'ocean',
        });
        document.body.append(element);

        element.setAttribute('palette', 'berry');
        expect(surface(element)).toBe(PALETTES.berry.surface);

        element.setAttribute('volume', '');
        expect(element.querySelector('.sonicframe-volume')).not.toBeNull();

        element.removeAttribute('volume');
        expect(element.querySelector('.sonicframe-volume')).toBeNull();
    });

    it('treats attribute values as untrusted', () => {
        const faces: string[] = [];
        vi.stubGlobal(
            'FontFace',
            class {
                constructor(family: string) {
                    faces.push(family);
                }

                load(): Promise<void> {
                    return Promise.resolve();
                }
            },
        );
        const element = tag({
            src: 'note.ogg',
            peaks: '/p.json',
            theme: '"><img src=x onerror=alert(1)>',
            palette: 'url(https://evil.example/x)',
            font: 'Brand',
            'font-src': 'javascript:alert(1)',
            label: '<b>hi</b>',
        });
        document.body.append(element);

        expect(document.querySelector('img')).toBeNull();
        expect(element.querySelector('b')).toBeNull();
        expect(surface(element)).toBe('');
        expect(faces).toEqual([]);
        expect(player(element)?.getAttribute('aria-label')).toBe('<b>hi</b>');
    });

    it('reads a .dat waveform file from peaks, and takes its duration before the sound has one', async () => {
        // Version 2, 16 bits, 100 samples per second, 4500 per point, one point: 45 seconds.
        const bytes = new Uint8Array(28);
        const view = new DataView(bytes.buffer);
        view.setInt32(0, 2, true);
        view.setInt32(8, 100, true);
        view.setInt32(12, 4500, true);
        view.setUint32(16, 1, true);
        view.setInt32(20, 1, true);
        view.setInt16(24, -16384, true);
        view.setInt16(26, 8192, true);
        const fetch = vi.fn((_address: string) =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: null,
                arrayBuffer: () => Promise.resolve(bytes.buffer),
            }),
        );
        vi.stubGlobal('fetch', fetch);
        const element = tag({ src: 'note.ogg', peaks: '/long.dat' });
        const durations: unknown[] = [];
        element.addEventListener('sonicframe:durationchange', (event) =>
            durations.push((event as CustomEvent<unknown[]>).detail[0]),
        );
        document.body.append(element);
        const canvas = element.querySelector('canvas') as HTMLCanvasElement;
        triggerResize(canvas, { width: 200, height: 40 });
        triggerVisible(canvas, true);

        await vi.waitFor(() => expect(durations).toEqual([45]));
        expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/long.dat']);
    });

    it('turns zoom on with the zoom attribute, its words picking the ways, and zoom-max capping it', () => {
        const element = tag({
            src: 'note.ogg',
            peaks: '/zoom.json',
            zoom: 'keys buttons flute',
            'zoom-max': '3',
        });
        const levels: number[] = [];
        element.addEventListener('sonicframe:viewchange', (event) =>
            levels.push(
                (event as CustomEvent<[{ level: number }]>).detail[0].level,
            ),
        );
        document.body.append(element);
        const slider = element.querySelector('[role="slider"]') as HTMLElement;

        for (const _ of [1, 2]) {
            slider.dispatchEvent(
                new KeyboardEvent('keydown', { key: '+', bubbles: true }),
            );
        }

        expect(element.querySelector('.sonicframe-zoom-in')).not.toBeNull();
        expect(levels.map((level) => Math.round(level * 1000) / 1000)).toEqual([
            2, 3,
        ]);
    });

    it('has no zoom without the attribute, and takes a strange zoom-max as the default', () => {
        const plain = tag({ src: 'note.ogg', peaks: '/plain.json' });
        const levels: number[] = [];
        plain.addEventListener('sonicframe:viewchange', () => levels.push(1));
        document.body.append(plain);

        (plain.querySelector('[role="slider"]') as HTMLElement).dispatchEvent(
            new KeyboardEvent('keydown', { key: '+', bubbles: true }),
        );

        expect(levels).toEqual([]);
        expect(plain.querySelector('.sonicframe-zoom-in')).toBeNull();

        const odd = tag({
            src: 'note.ogg',
            peaks: '/odd.json',
            zoom: 'keys',
            'zoom-max': 'lots',
        });
        const max: number[] = [];
        odd.addEventListener('sonicframe:viewchange', (event) =>
            max.push(
                (event as CustomEvent<[{ maxLevel: number }]>).detail[0]
                    .maxLevel,
            ),
        );
        document.body.append(odd);
        (odd.querySelector('[role="slider"]') as HTMLElement).dispatchEvent(
            new KeyboardEvent('keydown', { key: '+', bubbles: true }),
        );

        expect(max).toEqual([100]);
    });

    it('adds the minimap with the minimap attribute, a slider with a11y-minimap="keys"', () => {
        const element = tag({
            src: 'note.ogg',
            peaks: '/map.json',
            zoom: '',
            minimap: 'above autohide',
            'a11y-minimap': 'keys',
        });
        const always = tag({
            src: 'note.ogg',
            peaks: '/map2.json',
            zoom: '',
            minimap: 'above',
        });
        document.body.append(element, always);

        // Room for the wave and the strip in both, so the lanes are laid out.
        const strips = [element, always].map((player) => {
            const canvas = player.querySelector('canvas') as HTMLCanvasElement;
            boxOf(canvas.parentElement as HTMLElement, {
                left: 0,
                top: 0,
                width: 320,
                height: 80,
            });
            triggerResize(canvas, { width: 320, height: 56 });

            return player.querySelector<HTMLElement>('.sonicframe-minimap');
        });

        expect(strips[0]?.getAttribute('role')).toBe('slider');
        expect(strips[1]?.hasAttribute('role')).toBe(false);
        // With autohide, no room while the whole sound is in view; without it, the strip is there.
        expect(strips[0]?.style.getPropertyValue('display')).toBe('none');
        expect(strips[1]?.style.getPropertyValue('display')).toBe('block');
        // Above: the strip at the top (1.5rem, 24 px), the wave under it.
        expect(strips[1]?.style.getPropertyValue('top')).toBe('0px');
        expect(
            always.querySelector('canvas')?.style.getPropertyValue('top'),
        ).toBe('24px');
    });

    it('says a zoom with a11y-zoom="announce"', () => {
        const element = tag({
            src: 'note.ogg',
            peaks: '/say.json',
            zoom: 'keys',
            'a11y-zoom': 'announce',
        });
        document.body.append(element);

        (element.querySelector('[role="slider"]') as HTMLElement).dispatchEvent(
            new KeyboardEvent('keydown', { key: '+', bubbles: true }),
        );

        expect(
            document.querySelector('[aria-live="polite"]')?.textContent,
        ).toBe('Zoom 2×, 0% to 50%');
    });

    it('reads the peaks file with peaks-channel, peaks-max and peaks-normalize', async () => {
        // Two points, two channels of 8 bits: the second channel is 32 then 64 (0.25, 0.5).
        const file = {
            version: 2,
            channels: 2,
            sample_rate: 100,
            samples_per_pixel: 100,
            bits: 8,
            length: 2,
            data: [0, 64, 0, 32, 0, 32, 0, 64],
        };
        const bytes = new TextEncoder().encode(JSON.stringify(file));
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    body: null,
                    arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
                }),
            ),
        );
        const heard = async (attributes: Record<string, string>) => {
            const element = tag({ src: 'note.ogg', ...attributes });
            const peaks: unknown[] = [];
            element.addEventListener('sonicframe:peakschange', (event) =>
                peaks.push((event as CustomEvent<unknown[]>).detail[0]),
            );
            document.body.append(element);
            const canvas = element.querySelector('canvas') as HTMLCanvasElement;
            triggerResize(canvas, { width: 200, height: 40 });
            triggerVisible(canvas, true);
            await vi.waitFor(() =>
                expect(Array.isArray(peaks.at(-1))).toBe(true),
            );

            return peaks.at(-1);
        };

        expect(
            await heard({
                peaks: '/two.json',
                'peaks-channel': '1',
                'peaks-normalize': '',
            }),
        ).toEqual([0.5, 1]);
        expect(await heard({ peaks: '/two.json', 'peaks-max': '1' })).toEqual([
            0.5,
        ]);
    });

    it('is destroyed when taken out of the page and built again when put back', () => {
        const element = tag({ src: 'note.ogg', peaks: '/p.json' });
        document.body.append(element);
        expect(player(element)).not.toBeNull();

        element.remove();
        expect(player(element)).toBeNull();

        document.body.append(element);
        expect(player(element)).not.toBeNull();
    });

    it('dispatches the player events on the element', async () => {
        const element = tag({
            src: 'note.ogg',
            peaks: '/p.json',
            theme: 'lava',
        });
        const errors: unknown[] = [];
        element.addEventListener('sonicframe:error', (event) =>
            errors.push((event as CustomEvent<unknown[]>).detail[0]),
        );
        document.body.append(element);
        await Promise.resolve();

        expect(String(errors[0])).toContain('unknown theme');
    });
});
