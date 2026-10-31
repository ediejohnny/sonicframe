/**
 * The system's media controls on a player: off until asked, named by the player, skipping by the
 * look's seconds, stepping through the chapters, and kept when the player builds again.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { playTo } from '../../support/events';
import { afterTest } from '../../support/helpers';
import { playableMedia, stubSession } from '../../support/media-session';
import { cleanUp, container } from './player-harness';

afterEach(cleanUp);

type Media = ReturnType<typeof playableMedia>;

const CHAPTERS = [
    { start: 0, title: 'Intro' },
    { start: 40, title: 'Talk' },
    { start: 70, title: 'Song' },
];

/** A player of a 100-second sound that plays. */
function make(options: Partial<PlayerOptions> = {}): {
    player: Player;
    media: Media;
} {
    const media = playableMedia(100);
    const player = afterTest(
        createPlayer({ container: container(), media, ...options }),
    );

    return { player, media };
}

describe('the media session on a player', () => {
    it('is off by default', async () => {
        const session = stubSession();
        const { player, media } = make({ label: 'Dusk' });
        await media.play();

        expect(player.mediaSession).toBeNull();
        expect(session.metadata).toBeNull();
    });

    it("shows the player's name as the title, unless the app gives one", async () => {
        const session = stubSession();
        const named = make({ label: 'Dusk', mediaSession: true });
        await named.media.play();

        expect(named.player.mediaSession?.active).toBe(true);
        expect(session.metadata?.title).toBe('Dusk');

        const own = make({
            label: 'Dusk',
            mediaSession: { title: 'Night drive', artist: 'Ana' },
        });
        await own.media.play();

        expect(session.metadata).toMatchObject({
            title: 'Night drive',
            artist: 'Ana',
        });
    });

    it("skips by the look's seconds, the ones it has now", async () => {
        const session = stubSession();
        const { player, media } = make({
            mediaSession: true,
            look: { skip: 5 },
        });
        await media.play();

        session.press('seekforward');
        expect(media.currentTime).toBe(5);

        player.setLook({ skip: 15 });
        session.press('seekforward');
        expect(media.currentTime).toBe(20);
    });

    it('skips by its own seconds when the app gives them', async () => {
        const session = stubSession();
        const { media } = make({
            mediaSession: { seekOffset: 30 },
            look: { skip: 5 },
        });
        await media.play();

        session.press('seekforward');
        expect(media.currentTime).toBe(30);
    });

    it('steps through the chapters with the previous and next track, and lists them', async () => {
        const session = stubSession();
        const { media } = make({ mediaSession: true, chapters: CHAPTERS });
        await media.play();
        playTo(media, 10);

        session.press('nexttrack');
        expect(media.currentTime).toBe(40);

        session.press('nexttrack');
        expect(media.currentTime).toBe(70);

        playTo(media, 75);
        session.press('previoustrack');
        expect(media.currentTime).toBe(70);

        expect(session.metadata?.chapterInfo).toEqual([
            { title: 'Intro', startTime: 0, artwork: [] },
            { title: 'Talk', startTime: 40, artwork: [] },
            { title: 'Song', startTime: 70, artwork: [] },
        ]);
    });

    it("leaves the chapters out when asked, and the app's own tracks win over them", async () => {
        const session = stubSession();
        const without = make({
            mediaSession: { chapters: false },
            chapters: CHAPTERS,
        });
        await without.media.play();

        expect(session.handlers.get('nexttrack')).toBeNull();
        expect(session.metadata?.chapterInfo).toEqual([]);

        const asked: string[] = [];
        const own = make({
            mediaSession: { onNext: () => asked.push('next') },
            chapters: CHAPTERS,
        });
        await own.media.play();
        session.press('nexttrack');

        expect(asked).toEqual(['next']);
        expect(own.media.currentTime).toBe(0);
    });

    it('keeps the session, and the same plugin, when the player builds again while playing', async () => {
        const session = stubSession();
        const { player, media } = make({ label: 'Dusk', mediaSession: true });
        const plugin = player.mediaSession;
        await media.play();

        player.setTheme('bubble');

        expect(player.mediaSession).toBe(plugin);
        expect(plugin?.active).toBe(true);
        expect(session.metadata?.title).toBe('Dusk');
        expect(session.playbackState).toBe('playing');
    });

    it('clears the session when the player goes', async () => {
        const session = stubSession();
        const { player, media } = make({ label: 'Dusk', mediaSession: true });
        await media.play();
        expect(session.metadata?.title).toBe('Dusk');

        player.destroy();

        expect(session.metadata).toBeNull();
        expect(session.playbackState).toBe('none');
    });
});
