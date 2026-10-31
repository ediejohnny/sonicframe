/**
 * What each piece says in the language the app picks (`a11y.lang`): the wave and the plugins it
 * holds, the play button and the volume control, a tag with a region finding its language, `'auto'`
 * following the page, and the app's own words still winning.
 */

import { describe, expect, it } from 'vite-plus/test';
import { PlayButton, regions, VolumeControl } from '../../../src/index';
import type { Plugin } from '../../../src/types';
import { pressKey } from '../../support/events';
import {
    afterTest,
    fakeMedia,
    mount,
    mountShown,
    pageHost,
} from '../../support/helpers';
import { HALVES } from '../frame/zoom-harness';

const BOX = { left: 0, top: 0, width: 200, height: 40 };

/** What the page's live region says now. */
function heard(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

describe('the wave in the language the app picks', () => {
    it('names the wave in that language, a tag with a region finding it', () => {
        const names: [string, string][] = [
            ['fr', 'Position dans l’audio'],
            ['es-MX', 'Posición en el audio'],
            ['pt-PT', 'Posição no áudio'],
            ['de', 'Audio position'],
        ];

        for (const [lang, name] of names) {
            const { container } = mount({
                media: fakeMedia({ duration: 10 }),
                a11y: { lang },
            });

            expect(container.getAttribute('aria-label'), lang).toBe(name);
        }
    });

    it("follows the page's language with 'auto'", () => {
        document.documentElement.setAttribute('lang', 'es');

        try {
            const { container } = mount({ a11y: { lang: 'auto' } });

            expect(container.getAttribute('aria-label')).toBe(
                'Posición en el audio',
            );
        } finally {
            document.documentElement.removeAttribute('lang');
        }
    });

    it('tells its plugins the tag, English without one', () => {
        const seen: string[] = [];
        const listener: Plugin = {
            name: 'listener',
            setup: (host) => {
                seen.push(host.lang);
            },
        };

        mount({ a11y: { lang: 'pt-br' }, plugins: [listener] });
        mount({ a11y: { lang: 'ja-JP' }, plugins: [listener] });
        mount({ plugins: [listener] });

        expect(seen).toEqual(['pt-BR', 'ja-JP', 'en']);
    });

    it("says a new view in the frame's language, with its numbers", () => {
        const { container } = mountShown(
            {
                zoom: { keys: true, step: 2.5, anchor: 'center' },
                media: fakeMedia({ duration: 320 }),
                peaks: HALVES,
                a11y: { lang: 'pt-PT', zoom: { announce: true } },
            },
            BOX,
        );

        pressKey(container, '+');

        // 2.5× around the middle of 320 s: from 96 s to 224 s.
        expect(heard()).toBe('Zoom 2,5×, de 1:36 a 3:44');
    });

    it("has the regions say where a region is and its loop in the frame's language, or the app's words", () => {
        const items = [{ start: 8, end: 16, label: 'Intro' }];
        const spanish = mount({
            media: fakeMedia({ duration: 40 }),
            a11y: { lang: 'es' },
            plugins: [regions({ items })],
        });

        pressKey(spanish.container, 'r');
        expect(heard()).toBe('Intro, de 0:08 a 0:16');

        pressKey(spanish.container, 'l');
        expect(heard()).toBe('repetición activada');

        const own = mount({
            media: fakeMedia({ duration: 40 }),
            a11y: { lang: 'fr' },
            plugins: [
                regions({ items, a11y: { words: { loopOn: 'en boucle' } } }),
            ],
        });

        pressKey(own.container, 'r');
        expect(heard()).toBe('Intro, de 0:08 à 0:16');

        pressKey(own.container, 'l');
        expect(heard()).toBe('en boucle');
    });
});

describe('the controls in the language the app picks', () => {
    it('names the play button in that language, its own labels winning', () => {
        const spanish = afterTest(
            PlayButton.create({
                container: pageHost(BOX),
                media: fakeMedia({ duration: 10 }),
                a11y: { lang: 'es' },
            }),
        );
        const own = afterTest(
            PlayButton.create({
                container: pageHost(BOX),
                media: fakeMedia({ duration: 10 }),
                labels: { play: 'Ouvir', pause: 'Parar' },
                a11y: { lang: 'fr' },
            }),
        );

        expect(spanish.element.getAttribute('aria-label')).toBe('Reproducir');
        expect(own.element.getAttribute('aria-label')).toBe('Ouvir');
    });

    it('names the volume control and its muted value in that language, its own labels winning', () => {
        const valueWhenMuted = (
            options: Partial<Parameters<typeof VolumeControl.create>[0]>,
        ): [string | null, string | null] => {
            const element = pageHost(BOX);
            afterTest(
                VolumeControl.create({
                    container: element,
                    media: fakeMedia({ duration: 10 }),
                    ...options,
                }),
            );
            const button = element.querySelector('button');
            const name = button?.getAttribute('aria-label') ?? null;
            button?.click();

            return [
                name,
                element
                    .querySelector('[role="slider"]')
                    ?.getAttribute('aria-valuetext') ?? null,
            ];
        };

        expect(valueWhenMuted({ a11y: { lang: 'fr' } })).toEqual([
            'Couper le son',
            'son coupé',
        ]);
        expect(
            valueWhenMuted({
                a11y: { lang: 'fr' },
                labels: { mute: 'Mudo', unmute: 'Som', volume: 'Nível' },
            }),
        ).toEqual(['Mudo', 'son coupé']);
        expect(
            valueWhenMuted({
                labels: {
                    mute: 'Mute',
                    unmute: 'Unmute',
                    volume: 'Volume',
                    muted: 'silent',
                },
            }),
        ).toEqual(['Mute', 'silent']);
    });
});
