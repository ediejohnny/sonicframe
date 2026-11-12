/**
 * A player inside a list of tracks: the tracks around its sound come from the app (`tracks`), and
 * with them the look can place the previous and next track buttons, the keys go from track to track
 * (N, Shift+N) and the system's media controls step through the tracks instead of the chapters.
 * Without tracks, nothing of this shows.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { pressKey } from '../../support/events';
import { afterTest } from '../../support/helpers';
import { playableMedia, stubSession } from '../../support/media-session';
import { cleanUp, container, root } from './player-harness';

afterEach(cleanUp);

type Media = ReturnType<typeof playableMedia>;

const TRACK_LINE: PlayerOptions['look'] = {
    line: ['previousTrack', 'play', 'nextTrack', 'wave', 'time'],
};

const CHAPTERS = [
    { start: 0, title: 'Intro' },
    { start: 40, title: 'Talk' },
];

/** A player of a 100-second sound, with the track buttons in its line, and what its tracks were asked. */
function make(options: Partial<PlayerOptions> = {}): {
    player: Player;
    media: Media;
    asked: string[];
} {
    const media = playableMedia(100);
    const asked: string[] = [];
    const player = afterTest(
        createPlayer({
            container: container(),
            media,
            look: TRACK_LINE,
            tracks: {
                previous: () => asked.push('previous'),
                next: () => asked.push('next'),
            },
            ...options,
        }),
    );

    return { player, media, asked };
}

function button(name: 'previous' | 'next'): HTMLButtonElement | null {
    return root().querySelector<HTMLButtonElement>(`.sonicframe-${name}-track`);
}

describe('the track buttons', () => {
    it('stay out without tracks, even where the look places them', () => {
        afterTest(
            createPlayer({
                container: container(),
                media: playableMedia(100),
                look: TRACK_LINE,
            }),
        );

        expect(button('previous')).toBeNull();
        expect(button('next')).toBeNull();
        expect(root().querySelectorAll('button')).toHaveLength(1);
    });

    it('go where the look places them, named, and play the track before and after', () => {
        const { asked } = make();
        const order = [...root().querySelectorAll('button')].map(
            (element) => element.className.split(' ')[0],
        );

        expect(order).toEqual([
            'sonicframe-previous-track',
            'sonicframe-play',
            'sonicframe-next-track',
        ]);
        expect(button('previous')?.getAttribute('aria-label')).toBe(
            'Previous track',
        );
        expect(button('next')?.getAttribute('aria-label')).toBe('Next track');

        button('next')?.click();
        button('previous')?.click();
        expect(asked).toEqual(['next', 'previous']);
    });

    it('show only the way the app gives', () => {
        const asked: string[] = [];
        make({ tracks: { next: () => asked.push('next') } });

        expect(button('previous')).toBeNull();
        expect(button('next')).not.toBeNull();
    });

    it('are marked unavailable at an end of the list, keep their place in the tab order, and do nothing', () => {
        const { asked } = make({
            tracks: {
                previous: () => asked.push('previous'),
                next: () => asked.push('next'),
                hasPrevious: () => false,
            },
        });
        const previous = button('previous');

        expect(previous?.getAttribute('aria-disabled')).toBe('true');
        expect(previous?.disabled).toBe(false);
        expect(button('next')?.getAttribute('aria-disabled')).toBe('false');

        previous?.click();
        expect(asked).toEqual([]);
    });

    it('follow new tracks given later', () => {
        const { player } = make();
        const asked: string[] = [];

        player.setTracks({
            next: () => asked.push('new next'),
            hasNext: () => false,
        });

        expect(button('previous')).toBeNull();
        expect(button('next')?.getAttribute('aria-disabled')).toBe('true');

        player.setTracks({ next: () => asked.push('new next') });
        button('next')?.click();
        expect(asked).toEqual(['new next']);

        player.setTracks(undefined);
        expect(button('next')).toBeNull();
    });

    it("speak the player's language", () => {
        make({ a11y: { lang: 'pt-BR' } });

        expect(button('previous')?.getAttribute('aria-label')).toBe(
            'Faixa anterior',
        );
        expect(button('next')?.getAttribute('aria-label')).toBe(
            'Próxima faixa',
        );
    });
});

describe('the track keys', () => {
    it('go to the next track with N and the one before with Shift+N', () => {
        const { asked } = make({ keys: true });
        const wave = root().querySelector('[role="slider"]') as HTMLElement;

        expect(pressKey(wave, 'n').defaultPrevented).toBe(true);
        pressKey(wave, 'N', { shiftKey: true });

        expect(asked).toEqual(['next', 'previous']);
    });

    it('leave the key to the page without tracks, or at an end of the list', () => {
        const media = playableMedia(100);
        afterTest(createPlayer({ container: container(), media, keys: true }));
        const wave = root().querySelector('[role="slider"]') as HTMLElement;

        expect(pressKey(wave, 'n').defaultPrevented).toBe(false);

        cleanUp();
        const { asked } = make({
            keys: true,
            tracks: {
                next: () => asked.push('next'),
                hasNext: () => false,
            },
        });
        const own = root().querySelector('[role="slider"]') as HTMLElement;

        expect(pressKey(own, 'n').defaultPrevented).toBe(false);
        expect(asked).toEqual([]);
    });

    it('take your own letter, or none', () => {
        const { asked } = make({ keys: { track: 'j' } });
        const wave = root().querySelector('[role="slider"]') as HTMLElement;

        pressKey(wave, 'n');
        pressKey(wave, 'j');
        expect(asked).toEqual(['next']);
    });
});

describe('the media controls with tracks', () => {
    it('step through the tracks rather than the chapters, by default', async () => {
        const session = stubSession();
        const { media, asked } = make({
            mediaSession: true,
            chapters: CHAPTERS,
        });
        await media.play();

        session.press('nexttrack');
        session.press('previoustrack');

        expect(asked).toEqual(['next', 'previous']);
        expect(media.currentTime).toBe(0);
    });

    it('step through the chapters when asked, even with tracks', async () => {
        const session = stubSession();
        const { media, asked } = make({
            mediaSession: { previousNext: 'chapters' },
            chapters: CHAPTERS,
        });
        await media.play();

        session.press('nexttrack');

        expect(media.currentTime).toBe(40);
        expect(asked).toEqual([]);
    });

    it('leave the previous and next buttons out when asked', async () => {
        const session = stubSession();
        const { media } = make({
            mediaSession: { previousNext: false },
            chapters: CHAPTERS,
        });
        await media.play();

        expect(session.handlers.get('nexttrack')).toBeNull();
        expect(session.handlers.get('previoustrack')).toBeNull();
    });

    it("follow the tracks given later, and let the app's own controls win", async () => {
        const session = stubSession();
        const { player, media } = make({ mediaSession: true });
        await media.play();
        const asked: string[] = [];

        player.setTracks({ next: () => asked.push('later') });
        session.press('nexttrack');
        expect(asked).toEqual(['later']);

        const own = make({
            mediaSession: { onNext: () => asked.push('own') },
        });
        await own.media.play();
        session.press('nexttrack');
        expect(asked).toEqual(['later', 'own']);
    });
});
