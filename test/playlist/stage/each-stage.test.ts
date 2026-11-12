/**
 * A player for each track (`layout: 'each'`): one player per track, one under the other, each on its
 * own media; one plays at a time and hands its volume, mute and speed to the next, a player started
 * from its own button becomes the current one, the end of one plays the next, and tracks added
 * around the one playing never stop it.
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { cleanUp, make, settle } from '../playlist/playlist-harness';

afterEach(cleanUp);

/** The media asked to play and to pause, in order. */
let played: HTMLMediaElement[] = [];
let paused: HTMLMediaElement[] = [];

beforeEach(() => {
    played = [];
    paused = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
        this: HTMLMediaElement,
    ) {
        played.push(this);

        return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
        this: HTMLMediaElement,
    ) {
        paused.push(this);
    });
});

/** A playlist of a player for each track, and each player's media in order. */
function stack(): {
    playlist: ReturnType<typeof make>['playlist'];
    media: HTMLMediaElement[];
} {
    const { playlist } = make({ layout: 'each', media: undefined });

    return {
        playlist,
        media: [...playlist.element.querySelectorAll('audio')],
    };
}

describe('a player for each track', () => {
    it('makes one player per track, named by its track, each on its own media', () => {
        const { playlist, media } = stack();
        const players = playlist.element.querySelectorAll('.sonicframe-player');

        expect(
            [...players].map((player) => player.getAttribute('aria-label')),
        ).toEqual(['One', 'Track 2', 'Three']);
        expect(media.map((one) => one.getAttribute('src'))).toEqual([
            'https://site.test/one.mp3',
            'https://site.test/two.mp3',
            'https://site.test/three.mp3',
        ]);
    });

    it('plays one at a time, the next taking the volume, the mute and the speed', () => {
        const { playlist, media } = stack();
        media[0].volume = 0.3;
        media[0].muted = true;
        media[0].playbackRate = 2;

        playlist.play(1);

        expect(played).toEqual([media[1]]);
        expect(paused).toContain(media[0]);
        expect(media[1].volume).toBe(0.3);
        expect(media[1].muted).toBe(true);
        expect(media[1].playbackRate).toBe(2);
    });

    it('follows a player started from its own button', () => {
        const { playlist, media } = stack();

        media[2].dispatchEvent(new Event('play'));

        expect(playlist.index).toBe(2);
        expect(paused).toContain(media[0]);
    });

    it('plays the next track when one ends, and never for a track that is not current', async () => {
        const { playlist, media } = stack();

        media[2].dispatchEvent(new Event('ended'));
        await settle();

        expect(playlist.index).toBe(0);

        media[0].dispatchEvent(new Event('ended'));
        await settle();

        expect(playlist.index).toBe(1);
        expect(played).toEqual([media[1]]);
    });

    it('keeps the player playing when tracks are added before it', () => {
        const { playlist } = stack();
        const player = playlist.player;

        playlist.add([{ src: 'https://site.test/zero.mp3' }], 0);

        expect(playlist.player).toBe(player);
        expect(playlist.index).toBe(1);
        expect(
            playlist.element.querySelectorAll('.sonicframe-player'),
        ).toHaveLength(4);
    });
});
