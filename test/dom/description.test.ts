/**
 * The wave in words on the page: the description reaches screen readers through the slider's
 * `aria-describedby` (next to the page's own ids), an element the app gives, the live region on
 * demand, and keys that step between the parts. Everything beyond the description itself is off
 * until the app turns it on.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { soundDescription } from '../../src/index';
import { fakeMedia, mount, type Mounted } from './helpers';

let mounted: Mounted | null = null;

afterEach(() => {
    mounted?.frame.destroy();
    mounted?.unmount();
    mounted = null;
    document.documentElement.removeAttribute('lang');
});

/** 33 seconds: sound to 20 s with a loud spot at 12 s, a 4-second pause, then sound to the end. */
const NOTE = Array.from({ length: 330 }, (_, index) => {
    const time = index / 10;

    if (time >= 20 && time < 24) {
        return 0;
    }

    return time >= 11.75 && time < 12.45 ? 1 : 0.5;
});

const ENGLISH =
    '33 seconds. Sound until 20 seconds, a pause of 4 seconds, then sound to the end. ' +
    'Loudest at 12 seconds.';

function described(container: HTMLElement): string | null {
    const ids = (container.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter((id) => id !== '');
    const texts = ids.map((id) => document.getElementById(id)?.textContent);

    return texts.length === 0 ? null : texts.join(' | ');
}

function press(target: HTMLElement, key: string, shiftKey = false): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
    );
}

function spoken(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

describe('the description on the slider', () => {
    it("reaches screen readers through the slider's aria-describedby", () => {
        const plugin = soundDescription();
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            plugins: [plugin],
        });

        expect(described(mounted.container)).toBe(ENGLISH);
        expect(plugin.text).toBe(ENGLISH);
    });

    it("keeps the page's own ids and takes only its own out", () => {
        const help = document.createElement('p');
        help.id = 'page-help';
        help.textContent = 'Press space to play.';
        document.body.append(help);
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
        });
        mounted.container.setAttribute('aria-describedby', 'page-help');
        const remove = mounted.frame.use(soundDescription());

        expect(described(mounted.container)).toBe(
            `Press space to play. | ${ENGLISH}`,
        );

        remove();

        expect(mounted.container.getAttribute('aria-describedby')).toBe(
            'page-help',
        );
        expect(mounted.container.querySelector('[hidden]')).toBeNull();
        help.remove();
    });

    it('waits for both the peaks and the duration', () => {
        const plugin = soundDescription();
        mounted = mount({ plugins: [plugin] });

        expect(mounted.container.hasAttribute('aria-describedby')).toBe(false);
        expect(plugin.text).toBeNull();

        mounted.frame.setPeaks(NOTE);

        expect(plugin.text).toBeNull();

        mounted.frame.setDuration(33);

        expect(described(mounted.container)).toBe(ENGLISH);
    });

    it('speaks Portuguese, marking the text with its language', () => {
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            plugins: [soundDescription({ lang: 'pt' })],
        });

        expect(described(mounted.container)).toMatch(/^33 segundos\. Som até/);
        expect(
            mounted.container.querySelector('[hidden]')?.getAttribute('lang'),
        ).toBe('pt');
    });

    it("follows the page's language with 'auto'", () => {
        document.documentElement.setAttribute('lang', 'pt-BR');
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            plugins: [soundDescription({ lang: 'auto' })],
        });

        expect(described(mounted.container)).toMatch(/^33 segundos\./);
        expect(
            mounted.container.querySelector('[hidden]')?.getAttribute('lang'),
        ).toBe('pt-BR');
    });

    it("takes the app's own text, cleaned and only ever as text", () => {
        const plugin = soundDescription({
            text: 'A greeting <img src=x onerror=alert(1)>\u0007 from Ana.',
        });
        mounted = mount({ plugins: [plugin] });

        expect(plugin.text).toBe(
            'A greeting <img src=x onerror=alert(1)> from Ana.',
        );
        expect(mounted.container.querySelector('img')).toBeNull();
        expect(described(mounted.container)).toBe(plugin.text);

        plugin.set(null);

        expect(plugin.text).toBeNull();
        expect(mounted.container.hasAttribute('aria-describedby')).toBe(false);
    });
});

describe('the description elsewhere', () => {
    it("writes it into the app's element and gives the element back", () => {
        const target = document.createElement('p');
        target.textContent = 'Loading…';
        const changes: (string | null)[] = [];
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            plugins: [
                soundDescription({
                    target,
                    describedBy: false,
                    onChange: (text) => changes.push(text),
                }),
            ],
        });

        expect(target.textContent).toBe(ENGLISH);
        expect(target.getAttribute('lang')).toBe('en');
        expect(mounted.container.hasAttribute('aria-describedby')).toBe(false);
        expect(changes).toEqual([ENGLISH]);

        mounted.frame.destroy();

        expect(target.textContent).toBe('Loading…');
        expect(target.hasAttribute('lang')).toBe(false);
    });

    it('says it once when it arrives while the wave has focus, only when asked', async () => {
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            plugins: [soundDescription({ announceWhenReady: true })],
        });
        mounted.container.focus();
        document.querySelector('[role="status"]')?.replaceChildren();

        mounted.frame.setPeaks(NOTE);

        expect(spoken()).toBe(ENGLISH);
    });

    it('stays quiet when the description arrives, by default', () => {
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            plugins: [soundDescription()],
        });
        mounted.container.focus();
        document.querySelector('[role="status"]')?.replaceChildren();

        mounted.frame.setPeaks(NOTE);

        expect(spoken()).toBe('');
    });
});

describe('keys and the value, when turned on', () => {
    it('uses no key by default', () => {
        const media = fakeMedia({ duration: 33 });
        mounted = mount({
            media,
            peaks: NOTE,
            plugins: [soundDescription()],
        });
        document.querySelector('[role="status"]')?.replaceChildren();

        press(mounted.container, 'p');
        press(mounted.container, 'd');

        expect(media.currentTime).toBe(0);
        expect(spoken()).toBe('');
    });

    it('says the description again with D', () => {
        mounted = mount({
            media: fakeMedia({ duration: 33 }),
            peaks: NOTE,
            plugins: [soundDescription({ keys: true })],
        });
        document.querySelector('[role="status"]')?.replaceChildren();

        press(mounted.container, 'd');

        expect(spoken()).toBe(ENGLISH);
    });

    it('steps to the next part with P and back with Shift+P, Caps Lock or not', () => {
        const media = fakeMedia({ duration: 33 });
        mounted = mount({
            media,
            peaks: NOTE,
            plugins: [soundDescription({ keys: true, lang: 'pt' })],
        });

        press(mounted.container, 'P');

        expect(media.currentTime).toBeCloseTo(24, 5);
        expect(spoken()).toBe('Parte 2 de 2, 24 segundos.');

        press(mounted.container, 'p');

        expect(spoken()).toBe('Não há mais partes.');

        media.currentTime = 30;
        media.fire('timeupdate');
        press(mounted.container, 'p', true);

        expect(media.currentTime).toBeCloseTo(24, 5);

        press(mounted.container, 'P', true);

        expect(media.currentTime).toBe(0);
        expect(spoken()).toBe('Parte 1 de 2, no início.');
    });

    it('takes other letters, or none', () => {
        const media = fakeMedia({ duration: 33 });
        mounted = mount({
            media,
            peaks: NOTE,
            plugins: [soundDescription({ keys: { parts: 'n', again: false } })],
        });
        document.querySelector('[role="status"]')?.replaceChildren();

        press(mounted.container, 'd');

        expect(spoken()).toBe('');

        press(mounted.container, 'n');

        expect(media.currentTime).toBeCloseTo(24, 5);
    });

    it('adds "pause" to the value inside a silence, only when asked', () => {
        const media = fakeMedia({ duration: 33 });
        mounted = mount({
            media,
            peaks: NOTE,
            plugins: [soundDescription({ pauseInValue: true })],
        });

        media.currentTime = 22;
        media.fire('timeupdate');

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:22 / 0:33, pause',
        );

        media.currentTime = 25;
        media.fire('timeupdate');

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:25 / 0:33',
        );
    });

    it('says "silence" at the ends and never "pause" right where a step landed', () => {
        const media = fakeMedia({ duration: 33 });
        const quietStart = NOTE.map((peak, index) => (index < 20 ? 0 : peak));
        mounted = mount({
            media,
            peaks: quietStart,
            plugins: [soundDescription({ keys: true, pauseInValue: true })],
        });

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:00 / 0:33, silence',
        );

        press(mounted.container, 'p');

        expect(spoken()).toBe('Part 1 of 2, 2 seconds.');
        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:02 / 0:33',
        );
    });

    it('leaves the value alone by default', () => {
        const media = fakeMedia({ duration: 33 });
        mounted = mount({
            media,
            peaks: NOTE,
            plugins: [soundDescription()],
        });

        media.currentTime = 22;
        media.fire('timeupdate');

        expect(mounted.container.getAttribute('aria-valuetext')).toBe(
            '0:22 / 0:33',
        );
    });
});
