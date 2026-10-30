/**
 * `<sonic-player>`: nothing is registered on import; once defined, its attributes build the player,
 * a changed attribute updates it, untrusted attribute values fall back without injecting anything,
 * removing the element destroys the player and putting it back builds it again, and the player's
 * events reach the element.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineSonicPlayer, PALETTES } from '../../src/player';
import { triggerResize, triggerVisible } from './fakes';

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
