/**
 * A player that remembers, off until the app turns it on: where each sound was left (it resumes
 * there next time, unless near the end), the volume and the speed, kept in the page's storage or the
 * app's own. A storage that fails or holds something odd changes nothing, and `forget()` clears it.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
    createPlayer,
    defineSonicPlayer,
    type Player,
    type PlayerOptions,
} from '../../../src/player';
import { playTo } from '../../support/events';
import { afterTest } from '../../support/helpers';
import { playableMedia } from '../../support/media-session';
import { tag } from '../element/element-harness';
import { cleanUp, container } from '../player/player-harness';

type Media = ReturnType<typeof playableMedia>;

afterEach(() => {
    cleanUp();
});

/** A storage that keeps its items in a map, like `localStorage`. */
class MemoryStore {
    readonly items = new Map<string, string>();

    getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.items.set(key, value);
    }

    removeItem(key: string): void {
        this.items.delete(key);
    }
}

/** A player of a 100-second sound at `src` that remembers into `store`, and its media. */
function remembering(
    store: MemoryStore,
    remember: PlayerOptions['remember'] = {},
    more: Partial<PlayerOptions> = {},
): { player: Player; media: Media; resumed: number[] } {
    const media = playableMedia(100);
    const resumed: number[] = [];
    const player = afterTest(
        createPlayer({
            container: container(),
            media,
            src: 'talk.mp3',
            remember:
                typeof remember === 'object'
                    ? { store, ...remember }
                    : remember,
            ...more,
        }),
    );
    player.on('resume', (time) => resumed.push(time));

    return { player, media, resumed };
}

/** What the store holds under the player's usual name, read as JSON. */
function kept(store: MemoryStore, name = 'sonicframe:player'): unknown {
    return JSON.parse(store.getItem(name) ?? 'null');
}

/** The positions the store holds under the player's usual name. */
function positionsOf(store: MemoryStore): { sound: string; time: number }[] {
    return (
        (kept(store) as { positions?: { sound: string; time: number }[] })
            ?.positions ?? []
    );
}

describe('a tag that remembers', () => {
    it("resumes from the page's storage and tells sonicframe:resume", async () => {
        defineSonicPlayer();
        localStorage.setItem(
            'sonicframe:talks',
            JSON.stringify({ positions: [{ sound: 'dusk.mp3', time: 30 }] }),
        );
        const element = tag({
            src: 'dusk.mp3',
            remember: 'position',
            'remember-key': 'talks',
        });
        const heard: unknown[] = [];
        element.addEventListener('sonicframe:resume', (event) =>
            heard.push((event as CustomEvent<unknown[]>).detail[0]),
        );
        document.body.append(element);

        element.player?.frame.setDuration(100);
        await Promise.resolve();

        expect(heard).toEqual([30]);
        expect(element.player?.frame.time).toBe(30);

        // Taken off the page, the tag keeps the position a last time; then the page's storage is cleared.
        element.remove();
        await Promise.resolve();
        localStorage.removeItem('sonicframe:talks');
    });
});

describe('a player that remembers', () => {
    it("keeps nothing in the page's storage unless the app turns it on", () => {
        localStorage.clear();
        const media = playableMedia(100);
        afterTest(
            createPlayer({ container: container(), media, src: 'talk.mp3' }),
        );
        afterTest({ destroy: () => localStorage.clear() });

        playTo(media, 30);
        media.volume = 0.4;
        media.fire('volumechange');
        media.fire('pause');

        expect(localStorage.length).toBe(0);
    });

    it('resumes a sound where it was left, kept at a pause', async () => {
        const store = new MemoryStore();
        const first = remembering(store);
        playTo(first.media, 30);
        first.media.currentTime = 32;
        first.media.fire('pause');

        expect(positionsOf(store)).toEqual([{ sound: 'talk.mp3', time: 32 }]);
        first.player.destroy();

        const second = remembering(store);
        await Promise.resolve();

        expect(second.media.currentTime).toBe(32);
        expect(second.resumed).toEqual([32]);
    });

    it('keeps the position when the player goes, and leaves a sound already under way where it is', () => {
        const store = new MemoryStore();
        const first = remembering(store);
        playTo(first.media, 3);
        expect(positionsOf(store)).toEqual([]);

        first.player.destroy();
        expect(positionsOf(store)).toEqual([{ sound: 'talk.mp3', time: 3 }]);

        const media = playableMedia(100);
        media.currentTime = 45;
        afterTest(
            createPlayer({
                container: container(),
                media,
                src: 'talk.mp3',
                remember: { store },
            }),
        );

        expect(media.currentTime).toBe(45);
    });

    it('starts over a sound left near its end, or one that ended', async () => {
        const store = new MemoryStore();
        const nearEnd = remembering(store);
        playTo(nearEnd.media, 97);
        nearEnd.media.fire('pause');
        nearEnd.player.destroy();

        expect(remembering(store).media.currentTime).toBe(0);

        const ended = remembering(store, { sound: 'ends.mp3' });
        playTo(ended.media, 50);
        ended.media.fire('pause');
        expect(positionsOf(store)).toContainEqual({
            sound: 'ends.mp3',
            time: 50,
        });

        playTo(ended.media, 100);
        ended.media.fire('ended');
        expect(positionsOf(store).map((saved) => saved.sound)).not.toContain(
            'ends.mp3',
        );

        ended.player.destroy();
        const after = remembering(store, { sound: 'ends.mp3', nearEnd: 0 });
        await Promise.resolve();
        expect(after.media.currentTime).toBe(0);
    });

    it('keeps the position while playing, about every 5 seconds, and when the page goes', () => {
        const store = new MemoryStore();
        const { media } = remembering(store);

        playTo(media, 3);
        expect(kept(store)).toBeNull();

        playTo(media, 6);
        expect(kept(store)).toMatchObject({
            positions: [{ sound: 'talk.mp3', time: 6 }],
        });

        playTo(media, 8);
        window.dispatchEvent(new Event('pagehide'));
        expect(kept(store)).toMatchObject({
            positions: [{ sound: 'talk.mp3', time: 8 }],
        });
    });

    it('brings back the volume, the mute and the speed', () => {
        const store = new MemoryStore();
        const first = remembering(store);
        first.media.volume = 0.4;
        first.media.muted = true;
        first.media.fire('volumechange');
        first.media.playbackRate = 1.5;
        first.media.fire('ratechange');
        first.player.destroy();

        const { media } = remembering(store);

        expect(media.volume).toBe(0.4);
        expect(media.muted).toBe(true);
        expect(media.playbackRate).toBe(1.5);
        expect(
            (media as unknown as { defaultPlaybackRate: number })
                .defaultPlaybackRate,
        ).toBe(1.5);
    });

    it('keeps only what it is asked to', async () => {
        const store = new MemoryStore();
        const first = remembering(store, { position: false, speed: false });
        first.media.volume = 0.4;
        first.media.fire('volumechange');
        first.media.playbackRate = 2;
        first.media.fire('ratechange');
        playTo(first.media, 30);
        first.media.fire('pause');
        first.player.destroy();

        const { media } = remembering(store);
        await Promise.resolve();

        expect(media.volume).toBe(0.4);
        expect(media.playbackRate).toBe(1);
        expect(media.currentTime).toBe(0);

        // What is kept but not asked for stays where it is.
        media.playbackRate = 1.5;
        media.fire('ratechange');
        const quiet = remembering(store, { speed: false, volume: false });
        expect(quiet.media.playbackRate).toBe(1);
        expect(quiet.media.volume).toBe(1);
    });

    it('names a sound by its own name over its address, and keeps only the last sounds', async () => {
        const store = new MemoryStore();

        for (const [sound, time] of [
            ['one', 10],
            ['two', 20],
            ['three', 30],
        ] as const) {
            const played = remembering(store, { sound, sounds: 2 });
            playTo(played.media, time);
            played.media.fire('pause');
            played.player.destroy();
        }

        expect(kept(store)).toMatchObject({
            positions: [
                { sound: 'three', time: 30 },
                { sound: 'two', time: 20 },
            ],
        });

        const two = remembering(store, { sound: 'two' });
        await Promise.resolve();
        expect(two.media.currentTime).toBe(20);
    });

    it('keeps players of different keys apart', () => {
        const store = new MemoryStore();
        const music = remembering(store, { key: 'music' });
        music.media.volume = 0.3;
        music.media.fire('volumechange');
        music.player.destroy();

        expect(remembering(store, { key: 'talks' }).media.volume).toBe(1);
        expect(kept(store, 'sonicframe:music')).toMatchObject({ volume: 0.3 });
    });

    it('goes on without remembering when the storage fails or holds something odd', () => {
        const failing = {
            getItem: (): string | null => {
                throw new Error('blocked');
            },
            setItem: (): void => {
                throw new Error('full');
            },
            removeItem: (): void => {
                throw new Error('blocked');
            },
        };
        const { media } = remembering(failing as unknown as MemoryStore);
        media.volume = 0.4;
        media.fire('volumechange');
        playTo(media, 30);
        media.fire('pause');

        const odd = new MemoryStore();
        odd.setItem(
            'sonicframe:player',
            JSON.stringify({ volume: 'loud', positions: 'all' }),
        );
        expect(remembering(odd).media.volume).toBe(1);
    });

    it('forgets everything kept under its key with forget()', () => {
        const store = new MemoryStore();
        const { player, media } = remembering(store);
        media.volume = 0.4;
        media.fire('volumechange');

        player.forget();

        expect(store.items.size).toBe(0);
    });

    it('says where it resumes at the first play when asked, and nothing otherwise', async () => {
        const store = new MemoryStore();
        const said = (): string =>
            document.querySelector('[role="status"]')?.textContent ?? '';
        const first = remembering(store);
        playTo(first.media, 30);
        first.media.fire('pause');
        first.player.destroy();

        const quiet = remembering(store);
        await Promise.resolve();
        document.querySelector('[role="status"]')?.replaceChildren();
        await quiet.media.play();
        expect(said()).toBe('');
        quiet.player.destroy();

        const { media } = remembering(
            store,
            {},
            {
                a11y: { remember: { announce: true } },
            },
        );
        await Promise.resolve();
        await media.play();

        expect(said()).toBe('Resuming at 0:30');
    });
});
