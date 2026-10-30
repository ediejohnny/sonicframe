/**
 * A narrow player turns into a voice note: the play button and the wave keep the main line, the
 * time goes under the wave on the left and the other controls under it on the right, in the look's
 * order. It grows back into one line, keeps the same wave through every switch, and `narrow: 0`
 * keeps it on one line at any width.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { createPlayer, type Player } from '../../src/player';
import { boxOf, fakeMedia } from './helpers';
import { triggerResize } from './fakes';

let player: Player | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    player?.destroy();
    host?.remove();
    player = null;
    host = null;
});

const PEAKS = Array.from({ length: 200 }, (_, i) => (i % 7) / 7);

function make(look: Record<string, unknown> = {}): Player {
    host = document.createElement('div');
    document.body.append(host);
    boxOf(host, { left: 0, top: 0, width: 320, height: 48 });

    return createPlayer({
        container: host,
        media: fakeMedia({ duration: 60 }),
        peaks: PEAKS,
        zoom: { buttons: true },
        look: { line: ['play', 'wave', 'time', 'speed'], ...look },
    });
}

function root(): HTMLElement {
    return (host as HTMLElement).querySelector(
        '.sonicframe-player',
    ) as HTMLElement;
}

/** A row's children by class name; the wave's column reads `wave`, a bare spacer `spacer`. */
function names(row: Element | null): string[] {
    const wave = player?.frame.container.parentElement;

    return row === null
        ? []
        : [...row.children].map((child) =>
              child === wave ? 'wave' : child.className || 'spacer',
          );
}

/** The row under the wave, with its group of controls opened up after a `|`. */
function under(): string[] {
    return names(root().querySelector('.sonicframe-under')).flatMap((name) =>
        name === 'sonicframe-under-controls'
            ? [
                  '|',
                  ...names(root().querySelector('.sonicframe-under-controls')),
              ]
            : [name],
    );
}

function rows(): { line: string[]; under: string[] } {
    return {
        line: names(root().querySelector(':scope > div')),
        under: under(),
    };
}

/** Sets the player's width in CSS pixels (the page's rem is 16 px). */
function resize(width: number): void {
    triggerResize(root(), { width, height: 48 });
}

const WIDE = {
    line: [
        'sonicframe-play',
        'wave',
        'sonicframe-time',
        'sonicframe-speed',
        'sonicframe-zoom-out',
        'sonicframe-zoom-reset',
        'sonicframe-zoom-in',
    ],
    under: [],
};

describe('a narrow player', () => {
    it('turns into a voice note below 22rem: time under the wave on the left, controls on the right', () => {
        player = make();
        resize(320);

        expect(rows()).toEqual({
            line: ['sonicframe-play', 'wave'],
            under: [
                'sonicframe-time',
                '|',
                'sonicframe-speed',
                'sonicframe-zoom-out',
                'sonicframe-zoom-reset',
                'sonicframe-zoom-in',
            ],
        });
        expect(root().hasAttribute('data-narrow')).toBe(true);
    });

    it('puts the row under the wave right below it, before the look’s own small line', () => {
        player = make({ meta: ['duration'] });
        resize(320);
        const under = root().querySelector('.sonicframe-under');

        expect(under?.previousElementSibling).toBe(player.frame.container);
        expect(under?.nextElementSibling?.textContent).toBe('1:00');
    });

    it('grows back into one line, in the look’s order', () => {
        player = make();
        resize(320);
        resize(800);

        expect(rows()).toEqual(WIDE);
        expect(root().hasAttribute('data-narrow')).toBe(false);
    });

    it('puts each piece back in its own place, the look’s spacers included', () => {
        player = make({
            line: ['elapsed', 'play', 'speed', 'wave', 'spacer', 'duration'],
        });
        const wide = [
            'sonicframe-time',
            'sonicframe-play',
            'sonicframe-speed',
            'wave',
            'spacer',
            'sonicframe-time',
            'sonicframe-zoom-out',
            'sonicframe-zoom-reset',
            'sonicframe-zoom-in',
        ];

        expect(rows().line).toEqual(wide);

        resize(320);
        expect(rows()).toEqual({
            line: ['sonicframe-play', 'wave'],
            under: [
                'sonicframe-time',
                'sonicframe-time',
                '|',
                'sonicframe-speed',
                'sonicframe-zoom-out',
                'sonicframe-zoom-reset',
                'sonicframe-zoom-in',
            ],
        });

        resize(800);
        expect(rows().line).toEqual(wide);
    });

    it('gives the focus back to a control it moves', () => {
        player = make();
        const speed = root().querySelector<HTMLElement>(
            '.sonicframe-speed',
        ) as HTMLElement;
        speed.focus();
        resize(320);

        expect(document.activeElement).toBe(speed);
    });

    it('stays one line from 22rem up', () => {
        player = make();
        resize(352);

        expect(rows()).toEqual(WIDE);
    });

    it('keeps the same wave through every switch', () => {
        player = make();
        const wave = player.frame;
        resize(320);
        resize(800);
        resize(320);

        expect(player.frame).toBe(wave);
        expect(wave.container.isConnected).toBe(true);
    });

    it('stays a voice note when the look is changed and the player rebuilt', () => {
        player = make();
        resize(320);
        player.setLook({ gap: 1 });

        expect(rows().line).toEqual(['sonicframe-play', 'wave']);
    });

    it('never moves anything with narrow: 0', () => {
        player = make({ narrow: 0 });
        resize(200);

        expect(rows()).toEqual(WIDE);
    });

    it('keeps on the line the parts narrowLine names', () => {
        player = make({ narrowLine: ['play', 'wave', 'speed'] });
        resize(320);

        expect(rows()).toEqual({
            line: ['sonicframe-play', 'wave', 'sonicframe-speed'],
            under: [
                'sonicframe-time',
                '|',
                'sonicframe-zoom-out',
                'sonicframe-zoom-reset',
                'sonicframe-zoom-in',
            ],
        });
    });

    it('puts on the left, under the wave, the parts narrowStart names', () => {
        player = make({ narrowStart: ['speed', 'zoomReset'] });
        resize(320);

        expect(rows().under).toEqual([
            'sonicframe-speed',
            'sonicframe-zoom-reset',
            '|',
            'sonicframe-time',
            'sonicframe-zoom-out',
            'sonicframe-zoom-in',
        ]);
    });

    it('follows a narrow width of its own', () => {
        player = make({ narrow: 40 });
        resize(600);

        expect(rows().line).toEqual(['sonicframe-play', 'wave']);
    });
});
