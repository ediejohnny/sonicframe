/**
 * A playlist playing: one media element and a new player for each track, the volume, the mute and the
 * speed carried from track to track, the next track at the end (or the list over, or the same track
 * again), the pause between tracks, "previous" starting a track over, the shuffle, and the tracks
 * changed while it plays.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { Track } from '../../../src/core/playlist/tracks';
import { cleanUp, items, make, marked, said, settle } from './playlist-harness';

afterEach(cleanUp);

describe('the playlist', () => {
    it('starts on the first track, its player playing that address', () => {
        const { playlist, media } = make();

        expect(playlist.index).toBe(0);
        expect(media.src).toBe('https://site.test/one.mp3');
        expect(media.loads).toEqual(['https://site.test/one.mp3']);
        expect(playlist.player?.media).toBe(media);
        expect(
            playlist.element
                .querySelector('.sonicframe-player')
                ?.getAttribute('aria-label'),
        ).toBe('One');
        expect(marked()).toBe(0);
    });

    it('starts on the track the app asks for, and on the first one for a strange start', () => {
        expect(make({ start: 2 }).playlist.index).toBe(2);
        cleanUp();
        expect(make({ start: 9 }).playlist.index).toBe(0);
        cleanUp();
        expect(make({ start: -1 }).playlist.index).toBe(0);
    });

    it('plays a track chosen in the list, as a new player on the same media', async () => {
        const { playlist, media } = make();
        const first = playlist.player;
        const changes: [string, number][] = [];
        playlist.on('trackchange', (track, index) =>
            changes.push([track.src, index]),
        );

        items()[2].click();
        await settle();

        expect(playlist.index).toBe(2);
        expect(media.src).toBe('https://site.test/three.mp3');
        expect(media.paused).toBe(false);
        expect(playlist.player).not.toBe(first);
        expect(document.querySelectorAll('.sonicframe-player')).toHaveLength(1);
        expect(changes).toEqual([['https://site.test/three.mp3', 2]]);
        expect(marked()).toBe(2);
    });

    it('plays the current track on where it is, never loading it again', () => {
        const { playlist, media } = make();
        media.currentTime = 30;

        playlist.play();

        expect(media.loads).toHaveLength(1);
        expect(media.currentTime).toBe(30);
        expect(media.paused).toBe(false);
    });

    it('only makes a chosen track current with playOnSelect off', async () => {
        const { playlist, media } = make({ playOnSelect: false });

        items()[1].click();
        await settle();

        expect(playlist.index).toBe(1);
        expect(media.paused).toBe(true);
    });

    it('carries the volume, the mute and the speed to the next track', async () => {
        const { playlist, media } = make();
        media.volume = 0.4;
        media.muted = true;
        media.playbackRate = 1.5;

        playlist.next();
        await settle();

        expect(media.loads).toHaveLength(2);
        expect(media.volume).toBe(0.4);
        expect(media.muted).toBe(true);
        expect(media.playbackRate).toBe(1.5);
    });

    it('says the track that starts, with its place in the list', async () => {
        const { playlist } = make();

        playlist.select(2);

        expect(said()).toBe('Playing: Three, 3 of 3');
    });

    it('stays quiet with announce off', () => {
        const { playlist } = make({ a11y: { announce: false } });

        playlist.select(2);

        expect(said()).toBe('');
    });
});

describe('the end of a track', () => {
    it('goes on to the next track and plays it', async () => {
        const { playlist, media } = make();

        media.end();
        await settle();

        expect(playlist.index).toBe(1);
        expect(media.src).toBe('https://site.test/two.mp3');
        expect(media.paused).toBe(false);
    });

    it('stays on the track with advance off', async () => {
        const { playlist, media } = make({ advance: false });

        media.end();
        await settle();

        expect(playlist.index).toBe(0);
        expect(media.loads).toHaveLength(1);
    });

    it('ends the list after the last track, and starts it over with repeat all', async () => {
        const { playlist, media } = make({ start: 2 });
        let ends = 0;
        playlist.on('listend', () => (ends += 1));

        media.end();
        await settle();

        expect(ends).toBe(1);
        expect(playlist.index).toBe(2);

        playlist.setRepeat('all');
        media.end();
        await settle();

        expect(playlist.index).toBe(0);
        expect(ends).toBe(1);
    });

    it('plays the same track again with repeat one', async () => {
        const { playlist, media } = make({ repeat: 'one', start: 1 });

        media.end();
        await settle();

        expect(playlist.index).toBe(1);
        expect(media.currentTime).toBe(0);
        expect(media.paused).toBe(false);
    });

    it('waits the gap before the next track', async () => {
        vi.useFakeTimers();
        const { playlist, media } = make({ gap: 2 });

        media.end();
        await vi.advanceTimersByTimeAsync(1900);

        expect(playlist.index).toBe(0);

        await vi.advanceTimersByTimeAsync(200);

        expect(playlist.index).toBe(1);
        expect(media.paused).toBe(false);
    });

    it('drops the wait when the person picks a track during the gap', async () => {
        vi.useFakeTimers();
        const { playlist, media } = make({ gap: 2 });

        media.end();
        await vi.advanceTimersByTimeAsync(1000);
        playlist.play(2);
        await vi.advanceTimersByTimeAsync(2000);

        expect(playlist.index).toBe(2);
    });
});

describe('previous', () => {
    it('starts the track over once it has played past previousRestarts', async () => {
        const { playlist, media } = make({ start: 1 });
        media.currentTime = 3.5;

        playlist.previous();
        await settle();

        expect(playlist.index).toBe(1);
        expect(media.currentTime).toBe(0);
    });

    it('goes to the track before when it has played less', async () => {
        const { playlist, media } = make({ start: 1 });
        media.currentTime = 2.5;

        playlist.previous();
        await settle();

        expect(playlist.index).toBe(0);
    });

    it('always goes back with previousRestarts 0, and starts the first track over', async () => {
        const { playlist, media } = make({ start: 1, previousRestarts: 0 });
        media.currentTime = 50;

        playlist.previous();
        await settle();

        expect(playlist.index).toBe(0);

        media.currentTime = 1;
        playlist.previous();
        await settle();

        expect(playlist.index).toBe(0);
        expect(media.currentTime).toBe(0);
    });
});

describe('the player’s track buttons', () => {
    it('go through the list, and the one past an end is unavailable', async () => {
        const { playlist } = make({
            player: { look: { line: ['previousTrack', 'play', 'nextTrack'] } },
        });
        const button = (name: string): HTMLButtonElement =>
            playlist.element.querySelector(
                `.sonicframe-${name}-track`,
            ) as HTMLButtonElement;

        expect(button('previous').getAttribute('aria-disabled')).toBe('true');

        button('next').click();
        await settle();

        expect(playlist.index).toBe(1);
        expect(button('previous').getAttribute('aria-disabled')).toBe('false');
    });
});

describe('the shuffle', () => {
    it('plays every track once, the one playing first, in the order the random numbers give', async () => {
        // Fisher-Yates over [1, 2] with 0 every time swaps the two: 2 comes before 1.
        const { playlist } = make({ shuffle: true, random: () => 0 });

        expect(playlist.order).toEqual([0, 2, 1]);

        playlist.next();
        await settle();

        expect(playlist.index).toBe(2);
    });

    it('goes back to the written order when turned off', () => {
        const { playlist } = make({ shuffle: true, random: () => 0 });

        playlist.setShuffle(false);

        expect(playlist.order).toEqual([0, 1, 2]);
        expect(playlist.shuffle).toBe(false);
    });
});

describe('changing the tracks', () => {
    it('keeps to maxTracks when given, set and added, and refuses one past 10 000', () => {
        const four = [1, 2, 3, 4].map((at) => ({
            src: `https://site.test/${at}.mp3`,
        }));
        const { playlist } = make({ tracks: four, maxTracks: 2 });

        expect(playlist.tracks).toHaveLength(2);

        playlist.add(four);
        expect(playlist.tracks).toHaveLength(2);

        playlist.setTracks(four);
        expect(playlist.tracks).toHaveLength(2);

        expect(() => make({ maxTracks: 10_001 })).toThrow(
            'maxTracks goes past its most, 10000',
        );
    });

    it('keeps the track playing when tracks are added before it', () => {
        const { playlist, media } = make({ start: 1 });
        const changes: (readonly Track[])[] = [];
        playlist.on('trackschange', (tracks) => changes.push(tracks));

        playlist.add([{ src: 'https://site.test/zero.mp3' }], 0);

        expect(playlist.tracks.map((track) => track.src)[0]).toBe(
            'https://site.test/zero.mp3',
        );
        expect(playlist.index).toBe(2);
        expect(media.loads).toHaveLength(1);
        expect(changes).toHaveLength(1);
        expect(items()).toHaveLength(4);
        expect(marked()).toBe(2);
    });

    it('keeps the track playing when one moves', () => {
        const { playlist, media } = make();

        playlist.move(0, 2);
        expect(media.loads).toHaveLength(1);

        expect(playlist.tracks.map((track) => track.src)).toEqual([
            'https://site.test/two.mp3',
            'https://site.test/three.mp3',
            'https://site.test/one.mp3',
        ]);
        expect(playlist.index).toBe(2);
    });

    it('goes to the track in its place when the one playing is removed', () => {
        const { playlist, media } = make({ start: 1 });

        playlist.remove(1);

        expect(playlist.tracks).toHaveLength(2);
        expect(playlist.index).toBe(1);
        expect(media.src).toBe('https://site.test/three.mp3');
    });

    it('takes a whole new list', () => {
        const { playlist, media } = make({ start: 2 });

        playlist.setTracks([{ src: 'https://site.test/new.mp3' }]);

        expect(playlist.index).toBe(0);
        expect(media.src).toBe('https://site.test/new.mp3');
        expect(items()).toHaveLength(1);
    });

    it('drops tracks with an address that is not a web address', () => {
        const { playlist } = make({
            tracks: [
                { src: 'javascript:alert(1)' },
                { src: 'https://site.test/ok.mp3' },
            ],
        });

        expect(playlist.tracks.map((track) => track.src)).toEqual([
            'https://site.test/ok.mp3',
        ]);
    });
});

describe('destroying', () => {
    it('takes the playlist off the page and leaves the app’s media', () => {
        const { playlist, media } = make();
        const element = playlist.element;

        playlist.destroy();

        expect(element.isConnected).toBe(false);
        expect(playlist.player).toBeNull();
        expect(media.src).toBe('https://site.test/one.mp3');
    });

    it('does nothing when asked to play after it is gone', () => {
        const { playlist, media } = make();

        playlist.destroy();
        playlist.play(2);

        expect(media.loads).toHaveLength(1);
        expect(playlist.index).toBe(0);
    });

    it('never plays the next track after it is gone', async () => {
        vi.useFakeTimers();
        const { playlist, media } = make({ gap: 1 });

        media.end();
        playlist.destroy();
        await vi.advanceTimersByTimeAsync(2000);

        expect(media.loads).toHaveLength(1);
    });
});
