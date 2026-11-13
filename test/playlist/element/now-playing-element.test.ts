/**
 * `<sonic-now-playing>` and the playlist's `nowPlaying`: the bar lives while the tag is on the page
 * (with its attributes as options) or while the playlist does.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vite-plus/test';
import {
    defineSonicNowPlaying,
    defineSonicPlaylist,
} from '../../../src/playlist';
import { pageHost } from '../../support/helpers';
import { cleanUp, make } from '../playlist/playlist-harness';

beforeAll(() => {
    defineSonicNowPlaying();
    defineSonicPlaylist();
});

afterEach(cleanUp);

function bars(): HTMLElement[] {
    return [
        ...document.querySelectorAll<HTMLElement>('.sonicframe-now-playing'),
    ];
}

describe('<sonic-now-playing>', () => {
    it('puts the bar on the page with its attributes, and takes it off with the tag', () => {
        const host = pageHost({ left: 0, top: 0, width: 320, height: 48 });
        const tag = document.createElement('sonic-now-playing');
        tag.setAttribute('place', 'top');
        tag.setAttribute('a11y-label', 'Listening');
        tag.setAttribute('parts', 'title close');
        host.append(tag);

        expect(bars()).toHaveLength(1);
        expect(bars()[0].getAttribute('aria-label')).toBe('Listening');
        expect(bars()[0].style.getPropertyValue('top')).not.toBe('');
        expect(
            bars()[0].querySelector('.sonicframe-now-playing-play'),
        ).toBeNull();

        tag.setAttribute('place', 'bottom');
        expect(bars()).toHaveLength(1);
        expect(bars()[0].style.getPropertyValue('bottom')).not.toBe('');

        host.remove();
        expect(bars()).toHaveLength(0);
    });
});

describe('a playlist with nowPlaying', () => {
    it('has a bar that goes with it, and none without the option', () => {
        make();
        expect(bars()).toHaveLength(0);
        cleanUp();

        const { playlist } = make({ nowPlaying: { when: 'always' } });
        expect(bars()).toHaveLength(1);

        playlist.destroy();
        expect(bars()).toHaveLength(0);
    });

    it('turns on with the now-playing attribute of the tag', () => {
        const host = pageHost({ left: 0, top: 0, width: 320, height: 200 });
        const tag = document.createElement('sonic-playlist');
        tag.setAttribute('now-playing', 'playing');
        const link = document.createElement('a');
        link.href = 'https://site.test/one.mp3';
        tag.append(link);
        host.append(tag);

        expect(bars()).toHaveLength(1);
        host.remove();
        expect(bars()).toHaveLength(0);
    });
});
