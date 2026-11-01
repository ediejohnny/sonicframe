/**
 * The player's own keys, off until the app turns them on: Space plays and pauses, M mutes, the arrows
 * skip and change the volume, and `>` / `<` change the speed. The control with the focus keeps the
 * keys it uses (the wave's arrows, a button's Space, a field being typed in), and with the `'page'`
 * scope the keys also reach the player that played last while nothing on the page has the focus.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { markers } from '../../../src/index';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { pressKey } from '../../support/events';
import { afterTest, pageHost } from '../../support/helpers';
import { playableMedia } from '../../support/media-session';
import { tag } from '../element/element-harness';
import { cleanUp, container, root } from '../player/player-harness';

type Media = ReturnType<typeof playableMedia>;

afterEach(() => {
    cleanUp();
});

/** A player of a 40-second sound with `keys`, its media, its wave and its play button. */
function keyed(
    keys: PlayerOptions['keys'] = true,
    more: Partial<PlayerOptions> = {},
): { player: Player; media: Media; wave: HTMLElement; button: HTMLElement } {
    const media = playableMedia(40);
    const player = afterTest(
        createPlayer({ container: container(), media, keys, ...more }),
    );

    return {
        player,
        media,
        wave: root().querySelector('[role="slider"]') as HTMLElement,
        button: root().querySelector('.sonicframe-play') as HTMLElement,
    };
}

/** A player of `keys` in a host of its own, beside any other on the page. */
function another(keys: PlayerOptions['keys']): {
    player: Player;
    media: Media;
} {
    const media = playableMedia(40);
    const player = afterTest(
        createPlayer({
            container: pageHost({ left: 0, top: 60, width: 320, height: 48 }),
            media,
            keys,
        }),
    );

    return { player, media };
}

function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

describe("the player's keys", () => {
    it('are off unless the app turns them on', () => {
        const media = playableMedia(40);
        afterTest(createPlayer({ container: container(), media }));
        const wave = root().querySelector('[role="slider"]') as HTMLElement;

        expect(pressKey(wave, ' ').defaultPrevented).toBe(false);
        pressKey(wave, 'm');
        expect(media.paused).toBe(true);
        expect(media.muted).toBe(false);
    });

    it('play and pause with Space anywhere in the player but on a button, which Space presses itself', () => {
        const { media, wave, button } = keyed();

        expect(pressKey(wave, ' ').defaultPrevented).toBe(true);
        expect(media.paused).toBe(false);

        pressKey(root(), ' ');
        expect(media.paused).toBe(true);

        expect(pressKey(button, ' ').defaultPrevented).toBe(false);
        expect(media.paused).toBe(true);
    });

    it('mute and unmute with M, bringing the level back, or half when it was silent', () => {
        const { media, wave } = keyed();
        media.volume = 0.6;

        pressKey(wave, 'm');
        expect(media.muted).toBe(true);

        pressKey(wave, 'M');
        expect(media.muted).toBe(false);
        expect(media.volume).toBe(0.6);

        media.volume = 0;
        pressKey(wave, 'm');
        expect(media.volume).toBe(0.5);
        expect(media.muted).toBe(false);
    });

    it('skip with the side arrows and change the volume with the others, while the wave keeps its own arrows', () => {
        const { media, wave, button } = keyed();
        media.volume = 0.5;

        pressKey(button, 'ArrowRight');
        expect(media.currentTime).toBe(5);

        pressKey(button, 'ArrowLeft');
        expect(media.currentTime).toBe(0);

        pressKey(button, 'ArrowUp');
        expect(media.volume).toBe(0.55);

        pressKey(button, 'ArrowDown');
        pressKey(button, 'ArrowDown');
        expect(media.volume).toBe(0.45);

        // On the focused wave, Up is the slider's: a step forward, the volume left alone.
        pressKey(wave, 'ArrowUp');
        expect(media.currentTime).toBe(5);
        expect(media.volume).toBe(0.45);
    });

    it('unmute as the volume goes up, as the volume bar does', () => {
        const { media, button } = keyed();
        media.volume = 0.6;
        media.muted = true;

        pressKey(button, 'ArrowUp');

        expect(media.muted).toBe(false);
        expect(media.volume).toBe(0.05);
    });

    it("step through the look's speeds in order with > and <, without going round", () => {
        const { media, wave } = keyed(true, {
            look: { speeds: [2, 0.75, 1, 1.5] },
        });

        pressKey(wave, '>');
        expect(media.playbackRate).toBe(1.5);

        pressKey(wave, '>');
        pressKey(wave, '>');
        expect(media.playbackRate).toBe(2);

        pressKey(wave, '<');
        pressKey(wave, '<');
        pressKey(wave, '<');
        pressKey(wave, '<');
        expect(media.playbackRate).toBe(0.75);
    });

    it('leave a key the wave or its plugins took', () => {
        const { media, wave } = keyed(true, {
            plugins: [markers({ items: [{ time: 10 }] })],
        });

        pressKey(wave, 'm');

        expect(media.currentTime).toBe(10);
        expect(media.muted).toBe(false);
    });

    it('leave the keys of the app part of the player to the app', () => {
        const slot = document.createElement('div');
        const widget = document.createElement('span');
        widget.tabIndex = 0;
        slot.append(widget);
        const { media } = keyed(true, {
            slot,
            look: { line: ['play', 'wave', 'slot'] },
        });

        expect(root().contains(widget)).toBe(true);
        expect(pressKey(widget, 'm').defaultPrevented).toBe(false);
        pressKey(widget, 'ArrowUp');
        media.volume = 0.5;
        pressKey(widget, 'ArrowUp');

        expect(media.muted).toBe(false);
        expect(media.volume).toBe(0.5);
    });

    it('do nothing while someone types in a field the app put in the player', () => {
        const { player, media } = keyed();
        const field = document.createElement('textarea');
        player.element.append(field);

        expect(pressKey(field, ' ').defaultPrevented).toBe(false);
        pressKey(field, 'm');

        expect(media.paused).toBe(true);
        expect(media.muted).toBe(false);
    });

    it('skip as the keyboard does, so a zoomed view follows', () => {
        const { player, button } = keyed(true, {
            zoom: { view: { start: 0, end: 0.1 } },
        });

        pressKey(button, 'ArrowRight');

        const { start, end } = player.frame.view;
        expect(start <= 5 / 40 && 5 / 40 <= end).toBe(true);
    });

    it('take your own keys, and let one be switched off', () => {
        const { media, wave } = keyed({ play: 'k', mute: false });

        pressKey(wave, ' ');
        expect(media.paused).toBe(true);

        pressKey(wave, 'K');
        expect(media.paused).toBe(false);

        pressKey(wave, 'm');
        expect(media.muted).toBe(false);
    });

    it('leave Ctrl, Alt and ⌘ to the browser, and play once for a held Space', () => {
        const { media, wave } = keyed();

        pressKey(wave, ' ', { ctrlKey: true });
        expect(media.paused).toBe(true);

        pressKey(wave, ' ');
        pressKey(wave, ' ', { repeat: true });
        expect(media.paused).toBe(false);
    });

    it('say what changed when asked, and nothing otherwise', () => {
        const quiet = keyed();
        document.querySelector('[role="status"]')?.replaceChildren();
        pressKey(quiet.wave, '>');
        expect(said()).toBe('');
        quiet.player.destroy();

        const { media, wave, button } = keyed(true, {
            a11y: { keys: { announce: true } },
        });
        media.volume = 0.5;

        pressKey(button, 'ArrowUp');
        expect(said()).toBe('Volume 55%');

        pressKey(wave, 'm');
        expect(said()).toBe('Volume muted');

        pressKey(wave, '>');
        expect(said()).toBe('Playback speed 1.5×');

        pressKey(button, 'ArrowRight');
        expect(said()).toBe('0:05 / 0:40');
    });
});

describe("the player's keys on the tag", () => {
    it('turn on with keys, and come back when the tag builds its player again', () => {
        defineSonicPlayer();
        const element = tag({ src: 'dusk.mp3', keys: '' });
        document.body.append(element);
        const audio = element.querySelector('audio') as HTMLAudioElement;
        const waveOf = (): HTMLElement =>
            element.querySelector('[role="slider"]') as HTMLElement;

        pressKey(waveOf(), 'm');
        expect(audio.muted).toBe(true);

        element.setAttribute('a11y-keys', 'announce');
        pressKey(waveOf(), 'm');
        expect(audio.muted).toBe(false);
        expect(said()).toBe('Volume 100%');

        element.removeAttribute('keys');
        pressKey(waveOf(), 'm');
        expect(audio.muted).toBe(false);
    });
});

describe("the player's keys on the whole page", () => {
    it('reach the player that played last while nothing has the focus, the first one before', async () => {
        const first = keyed({ scope: 'page' });
        const second = another({ scope: 'page' });

        pressKey(document.body, 'm');
        expect(first.media.muted).toBe(true);
        expect(second.media.muted).toBe(false);

        await second.media.play();
        second.media.volume = 0.5;
        pressKey(document.body, 'ArrowUp');

        expect(second.media.volume).toBe(0.55);
        expect(first.media.muted).toBe(true);
    });

    it('stay out of a page element that has the focus, and of a player whose keys are its own', () => {
        const { media } = keyed({ scope: 'page' });
        const page = pageHost({ left: 0, top: 200, width: 100, height: 20 });
        const button = document.createElement('button');
        page.append(button);

        pressKey(button, ' ');
        pressKey(button, 'm');
        expect(media.paused).toBe(true);
        expect(media.muted).toBe(false);

        const own = another(true);
        const ownWave = own.player.element.querySelector(
            '[role="slider"]',
        ) as HTMLElement;
        pressKey(ownWave, 'm');

        expect(own.media.muted).toBe(true);
        expect(media.muted).toBe(false);
    });

    it("stay in the player with the 'player' scope", () => {
        const { media } = keyed();

        pressKey(document.body, ' ');

        expect(media.paused).toBe(true);
    });

    it('stop when the player is destroyed, and the page goes on to the next one', () => {
        const { player, media } = keyed({ scope: 'page' });
        const next = another({ scope: 'page' });

        player.destroy();
        pressKey(player.element, ' ');
        expect(media.paused).toBe(true);

        pressKey(document.body, ' ');
        expect(media.paused).toBe(true);
        expect(next.media.paused).toBe(false);
    });
});
