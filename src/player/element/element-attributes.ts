/**
 * The attributes of `<sonic-player>` read into the player's options. They are untrusted input: a
 * word turns a choice on and any other word is ignored, a number counts only when it is one, and
 * every name and value is checked again by the player.
 */

import { loadWaveform } from '../../core/peaks/read-waveform';
import type { ReadWaveformOptions } from '../../core/peaks/waveform';
import type { FontChoice } from '../../core/player/fonts';
import type { PaletteChoice } from '../../core/player/palettes';
import type { MinimapOptions } from '../../plugins/minimap/minimap';
import type { WaveName } from '../../types';
import type {
    PlayerA11y,
    PlayerChapters,
    PlayerDescription,
    PlayerMediaSession,
    PlayerOptions,
    PlayerZoom,
} from '../player/player-options';
import type { MediaSessionDetails } from '../../core/session/media-session';
import { attributeNumber } from '../../dom/shared/custom-element';
import { backgroundLookOf } from './background-attributes';

/** The words of an attribute, lowercase. */
/** The tag's older short words, each read as the option's name in kebab-case until 2.0. */
const OLD_WORDS: Readonly<Record<string, string>> = {
    edges: 'edge-scroll',
    autohide: 'auto-hide',
    pauses: 'pause-in-value',
    stay: 'stay-open',
};

function wordsOf(value: string): Set<string> {
    return new Set(
        value
            .toLowerCase()
            .split(/\s+/)
            .map((word) => OLD_WORDS[word] ?? word),
    );
}

/**
 * The zoom from the `zoom` attribute: present turns it on, and its words turn on its ways (`wheel`,
 * `scroll`, `pinch`, `keys`, `follow`, `center`, `edge-scroll`) and the `buttons`; `max` is `zoom-max`.
 */
function zoomOf(
    value: string | null,
    max: string | null,
): PlayerZoom | undefined {
    if (value === null) {
        return undefined;
    }

    const words = wordsOf(value);

    return {
        wheel: words.has('wheel'),
        scroll: words.has('scroll'),
        pinch: words.has('pinch'),
        keys: words.has('keys'),
        follow: words.has('follow'),
        followType: words.has('center') ? 'center' : 'page',
        edgeScroll: words.has('edge-scroll'),
        buttons: words.has('buttons'),
        max: attributeNumber(max),
    };
}

/** The minimap from the `minimap` attribute: present adds it; `above`, `auto-hide` and `wheel` change it. */
function minimapOf(value: string | null): MinimapOptions | undefined {
    if (value === null) {
        return undefined;
    }

    const words = wordsOf(value);

    return {
        side: words.has('above') ? 'above' : 'below',
        autoHide: words.has('auto-hide'),
        controls: { wheel: words.has('wheel') },
    };
}

/**
 * The description from the `a11y-description` attribute: present turns it on, and its words turn on
 * the extras (`keys`, `pause-in-value`, `speech`, `button`, `announce`) and the button's `animation`, of the
 * type `pulse` (the default) or `fade`; any other word is ignored.
 */
function descriptionOf(value: string | null): PlayerDescription | undefined {
    if (value === null) {
        return undefined;
    }

    const words = wordsOf(value);

    return {
        keys: words.has('keys'),
        pauseInValue: words.has('pause-in-value'),
        speech: words.has('speech'),
        button: words.has('button')
            ? {
                  animation: words.has('animation'),
                  animationType: words.has('fade') ? 'fade' : 'pulse',
              }
            : false,
        announce: words.has('announce'),
    };
}

/**
 * The chapters from the `chapters` attribute (the address of a WebVTT or JSON file) and the words of
 * `chapters-options` (or its old name, `chapter-options`): `list` (in the player, or `popover` or
 * `drawer` with `left`, `backdrop`), with
 * `open`, `stay-open`, `animation`, `slide` and `swipe`; `lane` (a strip of titles under the wave) or
 * `above`, `images`, `links`, `no-keys` and `no-lines`; and the words of `a11y-chapters`: `announce`,
 * `readable` (the tooltip's text in black or white, whichever reads) and `no-value-note`. Any other word
 * is ignored; `announce` and `readable` are still read from the options attribute too.
 */
function chaptersOf(
    src: string | null,
    value: string | null,
    access: string | null,
): PlayerChapters | undefined {
    if (src === null) {
        return undefined;
    }

    const words = wordsOf(value ?? '');
    const heard = wordsOf(access ?? '');

    return {
        src,
        list: words.has('list')
            ? {
                  type: words.has('drawer')
                      ? 'drawer'
                      : words.has('popover')
                        ? 'popover'
                        : 'inline',
                  open: words.has('open'),
                  side: words.has('left') ? 'left' : 'right',
                  stayOpen: words.has('stay-open'),
                  backdrop: words.has('backdrop'),
                  animation: words.has('animation'),
                  animationType: words.has('slide') ? 'slide' : 'fade',
                  swipe: words.has('swipe'),
              }
            : false,
        lane: words.has('above')
            ? 'above'
            : words.has('lane')
              ? 'below'
              : false,
        images: words.has('images'),
        links: words.has('links'),
        keys: !words.has('no-keys'),
        lines: !words.has('no-lines'),
        a11y: {
            announce: heard.has('announce') || words.has('announce'),
            tooltip: {
                readable: heard.has('readable') || words.has('readable'),
            },
            ...(heard.has('no-value-note') ? { valueNote: false } : {}),
        },
    };
}

/**
 * What the system's media controls show, from `media-title` (or `label`), `media-artist`,
 * `media-album` and `media-artwork` (one picture's address); each one missing is empty.
 */
export function sessionDetailsOf(
    element: Element,
): Omit<MediaSessionDetails, 'chapters'> {
    return {
        title:
            element.getAttribute('media-title') ??
            element.getAttribute('a11y-label') ??
            element.getAttribute('label') ??
            '',
        artist: element.getAttribute('media-artist') ?? '',
        album: element.getAttribute('media-album') ?? '',
        artwork: element.getAttribute('media-artwork') ?? [],
    };
}

/** The media controls: on with `media-session`, showing the `media-` attributes. */
function sessionOf(element: Element): PlayerMediaSession | undefined {
    return element.hasAttribute('media-session')
        ? sessionDetailsOf(element)
        : undefined;
}

export function paletteOf(element: Element): PaletteChoice | undefined {
    return (element.getAttribute('palette') ?? undefined) as
        | PaletteChoice
        | undefined;
}

export function waveOf(element: Element): WaveName | undefined {
    return (element.getAttribute('wave') ?? undefined) as WaveName | undefined;
}

export function fontOf(element: Element): FontChoice | undefined {
    const family = element.getAttribute('font');
    const src = element.getAttribute('font-src') ?? undefined;
    const stylesheet = element.getAttribute('font-stylesheet') ?? undefined;

    if (family === null) {
        return undefined;
    }

    return src !== undefined || stylesheet !== undefined
        ? { family, src, stylesheet }
        : family;
}

/** How the peaks file is read: `peaks-channel` (`all` or a number), `peaks-max`, `peaks-normalize`. */
function peaksReading(element: Element): ReadWaveformOptions {
    const channel = element.getAttribute('peaks-channel');

    return {
        channel:
            channel?.trim().toLowerCase() === 'all'
                ? 'all'
                : attributeNumber(channel),
        maxPeaks: attributeNumber(element.getAttribute('peaks-max')),
        normalize: element.hasAttribute('peaks-normalize'),
    };
}

/** The accessibility attributes: the language, the description, the zoom's and the minimap's. */
function a11yOf(element: Element): PlayerA11y {
    const zoom = element.getAttribute('a11y-zoom');
    const strip = element.getAttribute('a11y-minimap');

    return {
        lang: element.getAttribute('a11y-lang') ?? undefined,
        label: element.getAttribute('a11y-label') ?? undefined,
        description: descriptionOf(element.getAttribute('a11y-description')),
        zoom:
            zoom === null
                ? undefined
                : { announce: wordsOf(zoom).has('announce') },
        minimap:
            strip === null ? undefined : { keys: wordsOf(strip).has('keys') },
    };
}

/** Everything the tag's attributes say, as the player's options (all but the container). */
export function optionsOf(element: Element): Omit<PlayerOptions, 'container'> {
    const peaks = element.getAttribute('peaks');
    const reading = peaksReading(element);

    return {
        src: element.getAttribute('src') ?? undefined,
        // The player keeps only a known value; anything else loads the metadata.
        preload: (element.getAttribute('preload') ??
            undefined) as PlayerOptions['preload'],
        peaks: peaks === null ? undefined : () => loadWaveform(peaks, reading),
        theme: element.getAttribute('theme') ?? undefined,
        palette: paletteOf(element),
        wave: waveOf(element),
        font: fontOf(element),
        label: element.getAttribute('label') ?? undefined,
        volume: element.hasAttribute('volume'),
        spectrogram: element.hasAttribute('spectrogram'),
        zoom: zoomOf(
            element.getAttribute('zoom'),
            element.getAttribute('zoom-max'),
        ),
        minimap: minimapOf(element.getAttribute('minimap')),
        chapters: chaptersOf(
            element.getAttribute('chapters'),
            element.getAttribute('chapters-options') ??
                element.getAttribute('chapter-options'),
            element.getAttribute('a11y-chapters'),
        ),
        mediaSession: sessionOf(element),
        a11y: a11yOf(element),
        look: backgroundLookOf(element),
    };
}
