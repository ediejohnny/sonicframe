/** What the tag's attributes turn into: the player's options. */

import { describe, expect, it } from 'vite-plus/test';
import { optionsOf } from '../../../src/player/element/element-attributes';
import type { PlayerChapters } from '../../../src/player/player/player-options';

/** The chapters' options of a `sonic-player` with chapters and these words in `chapter-options`. */
function chaptersOf(words: string): PlayerChapters {
    const element = document.createElement('sonic-player');
    element.setAttribute('chapters', '/talk.vtt');
    element.setAttribute('chapter-options', words);

    return optionsOf(element).chapters as PlayerChapters;
}

describe('chapter-options', () => {
    it('writes the tooltip of the chapters in black or white that reads with readable, and not without', () => {
        expect(chaptersOf('list readable').a11y?.tooltip?.readable).toBe(true);
        expect(chaptersOf('list').a11y?.tooltip?.readable).not.toBe(true);
    });
});

/** The options of a tag with these attributes. */
function options(
    attributes: Record<string, string>,
): ReturnType<typeof optionsOf> {
    const element = document.createElement('sonic-player');

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    return optionsOf(element);
}

describe('keys and a11y-keys', () => {
    /** The keys and their accessibility from a tag with these attributes. */
    function keysOf(attributes: Record<string, string>): unknown[] {
        const read = options(attributes);

        return [read.keys, read.a11y?.keys];
    }

    it("turn the player's keys on, reach the page with the word page, and say what changed with announce", () => {
        expect(keysOf({})).toEqual([undefined, undefined]);
        expect(keysOf({ keys: '' })).toEqual([true, undefined]);
        expect(keysOf({ keys: 'PAGE' })).toEqual([
            { scope: 'page' },
            undefined,
        ]);
        expect(keysOf({ keys: 'everywhere', 'a11y-keys': 'announce' })).toEqual(
            [true, { announce: true }],
        );
        expect(keysOf({ 'a11y-keys': '' })).toEqual([
            undefined,
            { announce: false },
        ]);
    });
});

describe('remember, remember-key and a11y-remember', () => {
    /** What a tag with these attributes remembers, and whether it says where it resumes. */
    function rememberOf(attributes: Record<string, string>): unknown[] {
        const read = options(attributes);

        return [read.remember, read.a11y?.remember];
    }

    it('keep all three without words, only those named with them, under the key given', () => {
        const all = { position: true, volume: true, speed: true };

        expect(rememberOf({})).toEqual([undefined, undefined]);
        expect(rememberOf({ remember: '' })).toEqual([
            { ...all, key: undefined },
            undefined,
        ]);
        expect(rememberOf({ remember: 'unknown' })[0]).toMatchObject(all);
        expect(
            rememberOf({
                remember: 'Volume speed',
                'remember-key': 'podcast',
                'a11y-remember': 'announce',
            }),
        ).toEqual([
            { position: false, volume: true, speed: true, key: 'podcast' },
            { announce: true },
        ]);
        expect(rememberOf({ 'a11y-remember': '' })[1]).toEqual({
            announce: false,
        });
    });
});

describe('time-precision, time-fps, time-hours and time-decimal', () => {
    it('give the look its clock, names in any case and spacing, the look keeping only what it knows', () => {
        expect(options({}).look).toBeUndefined();
        expect(
            options({
                'time-precision': ' Frames ',
                'time-fps': '29.97',
                'time-hours': 'PADDED',
                'time-decimal': ',',
            }).look,
        ).toEqual({
            timePrecision: 'frames',
            timeFps: 29.97,
            timeHours: 'padded',
            timeDecimal: ',',
        });
        expect(options({ 'time-decimal': 'Auto' }).look).toEqual({
            timeDecimal: 'auto',
        });
    });

    it('leave the background the background attributes give', () => {
        const background = { 'background-color': '#123456' };

        expect(
            options({ ...background, 'time-precision': 'tenths' }).look,
        ).toEqual({
            ...options(background).look,
            timePrecision: 'tenths',
        });
    });
});

describe('the words the tag reads', () => {
    it('names each switch after its option, in kebab-case, and still reads the older short words', () => {
        const kebab = {
            src: 'a.ogg',
            zoom: 'edge-scroll',
            minimap: 'auto-hide',
            chapters: '/talk.vtt',
            'chapters-options': 'list stay-open',
            'a11y-description': 'pause-in-value',
            'background-color': '#123456',
            'background-animation': 'zoom pause-on-hover',
        };
        const old = {
            src: 'a.ogg',
            zoom: 'edges',
            minimap: 'autohide',
            chapters: '/talk.vtt',
            'chapter-options': 'list stay',
            'a11y-description': 'pauses',
            'background-color': '#123456',
            'background-animation': 'zoom hover-pause',
        };

        for (const attributes of [kebab, old]) {
            const read = options(attributes);

            expect(read.zoom).toMatchObject({ edgeScroll: true });
            expect(read.minimap).toMatchObject({ autoHide: true });
            expect((read.chapters as PlayerChapters).list).toMatchObject({
                stayOpen: true,
            });
            expect(read.a11y?.description).toMatchObject({
                pauseInValue: true,
            });
            expect(read.look?.backgroundAnimation).toMatchObject({
                pauseOnHover: true,
            });
        }
    });

    it('takes chapters-options over its old name chapter-options', () => {
        const read = options({
            chapters: '/talk.vtt',
            'chapter-options': 'lane',
            'chapters-options': 'list',
        });

        expect((read.chapters as PlayerChapters).list).not.toBe(false);
        expect((read.chapters as PlayerChapters).lane).toBe(false);
    });

    it('turns the strip of titles on with lane, under the wave, or over it with above', () => {
        for (const [words, lanePlacement] of [
            ['lane', 'below'],
            ['above', 'above'],
            ['lane above', 'above'],
        ]) {
            expect(
                options({ chapters: '/talk.vtt', 'chapters-options': words })
                    .chapters,
            ).toMatchObject({ lane: true, lanePlacement });
        }
    });
});

describe('a11y-chapters', () => {
    /** The chapters' options with these words in `a11y-chapters` (and `chapter-options`, if given). */
    function a11yOf(words: string, options = 'list'): PlayerChapters['a11y'] {
        const element = document.createElement('sonic-player');
        element.setAttribute('chapters', '/talk.vtt');
        element.setAttribute('chapter-options', options);
        element.setAttribute('a11y-chapters', words);

        return (optionsOf(element).chapters as PlayerChapters).a11y;
    }

    it('turns the announcement, the readable tooltip and the slider note on and off', () => {
        expect(a11yOf('announce readable')).toMatchObject({
            announce: true,
            tooltip: { readable: true },
        });
        expect(a11yOf('no-value-note')?.valueNote).toBe(false);
        expect(a11yOf('')?.announce).not.toBe(true);
    });

    it('takes over the words the chapter-options attribute used to carry', () => {
        expect(a11yOf('', 'list announce readable')).toMatchObject({
            announce: true,
            tooltip: { readable: true },
        });
    });
});
