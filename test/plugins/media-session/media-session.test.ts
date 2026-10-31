/**
 * The system's media controls for a frame: what they show, what each control does to the right
 * media, the position they get, and which frame owns the page's one session.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    mediaSession,
    type MediaSessionOptions,
    type MediaSessionPlugin,
} from '../../../src/index';
import { playTo } from '../../support/events';
import { mount, takeOff, type Mounted } from '../../support/helpers';
import {
    ALL_ACTIONS,
    playableMedia,
    stubSession,
} from '../../support/media-session';

type Media = ReturnType<typeof playableMedia>;

type Shown = Mounted & { media: Media; plugin: MediaSessionPlugin };

/** A frame of a sound of `duration` seconds with a media session plugin of `options`. */
function showSession(
    options: MediaSessionOptions = {},
    duration: number = 100,
): Shown {
    const media = playableMedia(duration);
    const plugin = mediaSession(options);

    return { ...mount({ media, plugins: [plugin] }), media, plugin };
}

/** Two frames, titled "First" and "Second", whose media played in that order. */
async function playedInTurn(): Promise<{ first: Shown; second: Shown }> {
    const first = showSession({ title: 'First' });
    const second = showSession({ title: 'Second' });
    await first.media.play();
    await second.media.play();

    return { first, second };
}

describe('the media session plugin', () => {
    it('does nothing where the browser has no session', async () => {
        const { media, plugin } = showSession({ title: 'Dusk' });
        await media.play();

        expect(plugin.active).toBe(false);
        expect('mediaSession' in navigator).toBe(false);
    });

    it('tells the controls nothing before its media plays', () => {
        const session = stubSession();
        showSession({ title: 'Dusk' });

        expect(session.metadata).toBeNull();
        expect(session.handlers.size).toBe(0);
    });

    it('shows the details, checked, once its media plays', async () => {
        const session = stubSession();
        const { media, plugin } = showSession({
            title: 'Dusk\u0007 song',
            artist: 'Ana',
            album: 'Live',
            artwork: [{ src: 'javascript:alert(1)' }, { src: 'dusk.png' }],
        });
        await media.play();

        expect(plugin.active).toBe(true);
        expect(session.metadata).toMatchObject({
            title: 'Dusk song',
            artist: 'Ana',
            album: 'Live',
            artwork: [{ src: 'dusk.png' }],
        });
        expect(session.playbackState).toBe('playing');
        expect(session.positions.at(-1)).toEqual({
            duration: 100,
            position: 0,
            playbackRate: 1,
        });
    });

    it('says paused when its media pauses, with where it stopped', async () => {
        const session = stubSession();
        const { media } = showSession();
        await media.play();
        playTo(media, 42);
        media.pause();

        expect(session.playbackState).toBe('paused');
        expect(session.positions.at(-1)?.position).toBe(42);
    });

    it('sends the position again after a seek and a new speed', async () => {
        const session = stubSession();
        const { media } = showSession();
        await media.play();
        media.currentTime = 30;
        media.fire('seeked');

        expect(session.positions.at(-1)).toEqual({
            duration: 100,
            position: 30,
            playbackRate: 1,
        });

        media.playbackRate = 2;
        media.fire('ratechange');

        expect(session.positions.at(-1)?.playbackRate).toBe(2);
    });

    it('sends no position for a sound of unknown length', async () => {
        const session = stubSession();
        const { media } = showSession(
            { title: 'Live' },
            Number.POSITIVE_INFINITY,
        );
        await media.play();

        expect(session.metadata?.title).toBe('Live');
        expect(session.positions).toEqual([]);
    });

    it('plays and pauses its media from the controls', async () => {
        const session = stubSession();
        const { media } = showSession();
        await media.play();

        session.press('pause');
        expect(media.paused).toBe(true);

        session.press('play');
        expect(media.paused).toBe(false);
    });

    it('reports a play the browser refuses as the frame error', async () => {
        const session = stubSession();
        const { media, frame } = showSession();
        const errors: unknown[] = [];
        frame.on('error', (error) => errors.push(error));
        await media.play();
        media.pause();
        const refused = new Error('NotAllowedError');
        media.refuse = refused;

        session.press('play');
        await Promise.resolve();

        expect(errors).toEqual([refused]);
    });

    it('skips 10 seconds, or the step the controls ask for', async () => {
        const session = stubSession();
        const { media } = showSession();
        await media.play();
        playTo(media, 30);

        session.press('seekforward');
        expect(media.currentTime).toBe(40);

        session.press('seekbackward', { seekOffset: 5 });
        expect(media.currentTime).toBe(35);

        session.press('seekbackward', { seekOffset: 50 });
        expect(media.currentTime).toBe(0);
    });

    it('skips its own seconds, kept from 1 to 120, or asks a function at each skip', async () => {
        for (const [seekOffset, expected] of [
            [300, 120],
            [0.2, 1],
            [Number.NaN, 10],
            [() => 7, 7],
        ] as const) {
            const session = stubSession();
            const mounted = showSession({ seekOffset }, 500);
            await mounted.media.play();

            session.press('seekforward');
            expect(mounted.media.currentTime).toBe(expected);
            takeOff(mounted);
        }
    });

    it('goes to the time the controls ask for, fast when they ask and the media can', async () => {
        const session = stubSession();
        const { media } = showSession();
        await media.play();

        session.press('seekto', { seekTime: 61 });
        expect(media.currentTime).toBe(61);
        expect(media.fastSeeks).toEqual([]);

        session.press('seekto', { seekTime: 20, fastSeek: true });
        expect(media.fastSeeks).toEqual([20]);

        session.press('seekto', { seekTime: 900 });
        expect(media.currentTime).toBe(100);

        session.press('seekto', { seekTime: 900, fastSeek: true });
        session.press('seekto', { seekTime: -5, fastSeek: true });
        expect(media.fastSeeks).toEqual([20, 100, 0]);
    });

    it('stops: pauses and goes back to the start', async () => {
        const session = stubSession();
        const { media } = showSession();
        await media.play();
        playTo(media, 50);

        session.press('stop');

        expect(media.paused).toBe(true);
        expect(media.currentTime).toBe(0);
    });

    it('offers the previous and next track only to an app that handles them', async () => {
        const session = stubSession();
        const asked: string[] = [];
        const { media } = showSession({ onNext: () => asked.push('next') });
        await media.play();

        expect(session.handlers.get('previoustrack')).toBeNull();
        session.press('nexttrack');
        expect(asked).toEqual(['next']);
    });

    it('offers only the actions asked for, ignoring unknown names', async () => {
        const session = stubSession();
        const { media } = showSession({
            actions: ['play', 'pause', 'shuffle' as 'play'],
        });
        await media.play();

        const offered = ALL_ACTIONS.filter(
            (action) => typeof session.handlers.get(action) === 'function',
        );
        expect(offered).toEqual(['play', 'pause']);
    });

    it('still offers the rest when the browser does not know an action', async () => {
        const session = stubSession(
            ALL_ACTIONS.filter((action) => action !== 'stop'),
        );
        const { media } = showSession({ title: 'Dusk' });
        await media.play();

        expect(session.metadata?.title).toBe('Dusk');
        expect(typeof session.handlers.get('seekto')).toBe('function');
        expect(session.playbackState).toBe('playing');
    });

    it('gives the session to the media that played last, and the other leaves it alone', async () => {
        const session = stubSession();
        const { first, second } = await playedInTurn();

        expect(first.plugin.active).toBe(false);
        expect(second.plugin.active).toBe(true);
        expect(session.metadata?.title).toBe('Second');

        first.media.pause();
        expect(session.playbackState).toBe('playing');

        session.press('pause');
        expect(second.media.paused).toBe(true);
    });

    it('clears a control the media before it offered', async () => {
        const session = stubSession();
        const first = showSession({ onNext: () => undefined });
        const second = showSession();
        await first.media.play();
        await second.media.play();

        expect(session.handlers.get('nexttrack')).toBeNull();
    });

    it('changes the details at once while it owns the session, keeping those left out', async () => {
        const session = stubSession();
        const { media, plugin } = showSession({ title: 'One', artist: 'Ana' });
        await media.play();

        plugin.set({
            title: 'Two',
            chapters: [
                {
                    start: 0,
                    end: null,
                    title: 'Intro',
                    image: null,
                    url: null,
                    toc: true,
                },
            ],
        });

        expect(session.metadata).toMatchObject({
            title: 'Two',
            artist: 'Ana',
            chapterInfo: [{ title: 'Intro', startTime: 0, artwork: [] }],
        });

        plugin.set({ title: undefined, album: 'Live' });

        expect(session.metadata).toMatchObject({ title: 'Two', album: 'Live' });
    });

    it('keeps new details for later while another media owns the session', async () => {
        const session = stubSession();
        const first = showSession({ title: 'First' });
        const second = showSession({ title: 'Second' });
        await second.media.play();

        first.plugin.set({ title: 'Later' });
        expect(session.metadata?.title).toBe('Second');

        await first.media.play();
        expect(session.metadata?.title).toBe('Later');
    });

    it('clears the session when it is removed, only when it owns it', async () => {
        const session = stubSession();
        const { first, second } = await playedInTurn();

        first.frame.destroy();
        expect(session.metadata?.title).toBe('Second');

        second.frame.destroy();
        expect(session.metadata).toBeNull();
        expect(session.playbackState).toBe('none');
        expect([...session.handlers.values()].every((h) => h === null)).toBe(
            true,
        );
        expect(session.positions.at(-1)).toBeUndefined();
    });

    it('takes the session back when set up again while its media plays', async () => {
        const session = stubSession();
        const media = playableMedia();
        const plugin = mediaSession({ title: 'Dusk' });
        const before = mount({ media, plugins: [plugin] });
        await media.play();
        takeOff(before);

        expect(session.metadata).toBeNull();

        mount({ media, plugins: [plugin] });

        expect(plugin.active).toBe(true);
        expect(session.metadata?.title).toBe('Dusk');
        expect(session.playbackState).toBe('playing');
    });
});
