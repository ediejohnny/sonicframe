/**
 * A playlist under test: a 320 px host on the page, a media element that takes an address and loads
 * it (as the browser does, `load()` puts the speed back to the default one), three tracks, and the
 * list's parts searched by what a person sees.
 */

import { vi } from 'vite-plus/test';
import type { TrackInput } from '../../../src/core/playlist/tracks';
import {
    createPlaylist,
    type Playlist,
    type PlaylistOptions,
} from '../../../src/playlist';
import { afterTest, pageHost } from '../../support/helpers';
import { PlayableMedia } from '../../support/media-session';

export let host: HTMLElement | null = null;

/** Makes `element` (a tag's host, say) the host taken off after the test. */
export function keep(element: HTMLElement): void {
    host = element;
}

/** Takes the host off the page, and gives back the globals and the methods. */
export function cleanUp(): void {
    host?.remove();
    host = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelector('[role="status"]')?.replaceChildren();
    document.documentElement.removeAttribute('lang');
}

/** A media element that loads the address it is given. */
export class ListMedia extends PlayableMedia {
    src = '';
    defaultPlaybackRate = 1;
    /** Each address loaded, in order. */
    readonly loads: string[] = [];

    load(): void {
        this.loads.push(this.src);
        this.pause();
        this.currentTime = 0;
        this.playbackRate = this.defaultPlaybackRate;
    }

    /** The sound ends by itself. */
    end(): void {
        this.currentTime = this.duration;
        this.pause();
        this.fire('ended');
    }
}

export function listMedia(): HTMLMediaElement & ListMedia {
    return new ListMedia({ duration: 100 }) as HTMLMediaElement & ListMedia;
}

export const TRACKS: readonly TrackInput[] = [
    {
        src: 'https://site.test/one.mp3',
        title: 'One',
        artist: 'Ana',
        duration: 61,
    },
    { src: 'https://site.test/two.mp3' },
    { src: 'https://site.test/three.mp3', title: 'Three', id: 'ep-3' },
];

/** A playlist of `TRACKS` on `media` (a new one by default). */
export function make(
    options: Partial<PlaylistOptions> = {},
    media: HTMLMediaElement & ListMedia = listMedia(),
): { playlist: Playlist; media: HTMLMediaElement & ListMedia } {
    host = pageHost({ left: 0, top: 0, width: 320, height: 200 });
    const playlist = afterTest(
        createPlaylist({
            container: host,
            tracks: TRACKS,
            media,
            ...options,
        }),
    );

    return { playlist, media };
}

/** The buttons of the list's tracks, in order. */
export function items(): HTMLButtonElement[] {
    return [
        ...document.querySelectorAll<HTMLButtonElement>(
            'button.sonicframe-track',
        ),
    ];
}

/** The titles the list shows, in order. */
export function titles(): string[] {
    return items().map(
        (item) =>
            item.querySelector('.sonicframe-track-title')?.textContent ?? '',
    );
}

/** The index of the track the list marks as current, or -1. */
export function marked(): number {
    return items().findIndex(
        (item) => item.getAttribute('aria-current') === 'true',
    );
}

/** What the page's live region says now. */
export function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}

/** A button of the bar over the list. */
export function barButton(
    name: 'shuffle' | 'repeat' | 'toggle',
): HTMLButtonElement {
    const button = document.querySelector<HTMLButtonElement>(
        `.sonicframe-playlist-${name}`,
    );

    if (button === null) {
        throw new Error(`test: no ${name} button`);
    }

    return button;
}

/** Lets the promises waiting now run. */
export async function settle(): Promise<void> {
    for (let round = 0; round < 5; round += 1) {
        await Promise.resolve();
    }
}
