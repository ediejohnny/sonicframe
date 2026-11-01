/**
 * The plugins a player adds from its options, after the app's own: a spectrogram in the palette's
 * colors (first, under everything), the chapters, the media controls, the minimap and the sound in
 * words, each only when asked. The minimap's room is added to the wave's box, so the strip never takes from the wave.
 */

import type { PlayerWords } from '../../core/player/labels';
import type { PlayerLook } from '../../core/player/look';
import { PROGRESS, WAVE } from '../../core/shared/variables';
import { remPixels } from '../../dom/shared/units';
import type { ChaptersPlugin } from '../../plugins/chapters/chapters-options';
import type { MediaSessionPlugin } from '../../plugins/media-session/media-session';
import {
    soundDescription,
    type SoundDescriptionPlugin,
} from '../../plugins/description/description';
import {
    minimap,
    minimapSize,
    type MinimapOptions,
} from '../../plugins/minimap/minimap';
import {
    spectrogram,
    type ColorStops,
    type DecodedAudio,
} from '../../plugins/spectrogram/spectrogram';
import type { Plugin } from '../../types';
import type {
    PlayerDescription,
    PlayerListenButton,
    PlayerOptions,
} from './player-options';

/** The spectrogram's colors: from the player's surface, through the wave, to the played color. */
const SPECTRUM: ColorStops = {
    from: 'var(--sonicframe-surface, #ffffff)',
    via: WAVE,
    to: PROGRESS,
};

/** What the plugins take from the player, for one build. */
export type PluginParts = {
    look: PlayerLook;
    words: PlayerWords;
    media: HTMLMediaElement | null;
    chapters: ChaptersPlugin | null;
    /** The system's media controls, made once, or null while they are off. */
    session: MediaSessionPlugin | null;
    /** The sound decoded once, shared with the peaks. */
    decoded: () => Promise<DecodedAudio>;
    /** Hears the description's new text (or null). */
    described: (text: string | null) => void;
};

/** The description's settings, or null while it is off. */
export function descriptionSettings(
    options: PlayerOptions,
): PlayerDescription | null {
    const asked = options.a11y?.description;

    if (!asked) {
        return null;
    }

    return asked === true ? {} : asked;
}

/** The reading button's settings, or null while there is none. */
export function listenSettings(
    options: PlayerOptions,
): PlayerListenButton | null {
    const button = descriptionSettings(options)?.button;

    if (!button) {
        return null;
    }

    return button === true ? {} : button;
}

/** The minimap's options: the look's height and space, then the app's own; null while it is off. */
function minimapOptions(
    options: PlayerOptions,
    look: PlayerLook,
): MinimapOptions | null {
    const strip = options.minimap;

    if (!strip) {
        return null;
    }

    return {
        height: remPixels(look.minimapHeight),
        gap: remPixels(look.minimapGap),
        ...(strip === true ? {} : strip),
    };
}

/**
 * The wave box's height: the wave, plus the minimap's room so the strip never takes from the wave.
 * A strip that hides itself at the whole sound adds none: it takes from the wave while it shows.
 */
export function boxHeight(options: PlayerOptions, look: PlayerLook): string {
    const strip = minimapOptions(options, look);
    const wave = `${look.waveHeight}rem`;

    if (strip === null || strip.autoHide === true) {
        return wave;
    }

    const { height, gap } = minimapSize(strip);

    return `calc(${wave} + ${height + gap}px)`;
}

/** The plugins for a new wave, and the description among them (null while it is off). */
export function playerPlugins(
    options: PlayerOptions,
    parts: PluginParts,
): { plugins: Plugin[]; description: SoundDescriptionPlugin | null } {
    const plugins = [...(options.plugins ?? [])];

    if (parts.chapters !== null) {
        plugins.push(parts.chapters);
    }

    if (parts.session !== null) {
        plugins.push(parts.session);
    }

    if (options.spectrogram && parts.media !== null) {
        plugins.unshift(spectrogram({ source: parts.decoded, map: SPECTRUM }));
    }

    const own = minimapOptions(options, parts.look);

    if (own !== null) {
        const words = parts.words;
        plugins.push(
            minimap({
                ...own,
                a11y: {
                    label: words.labels.minimap,
                    words: {
                        value: (from, to, total) =>
                            words.say('minimapValue', { from, to, total }),
                    },
                    ...own.a11y,
                    keys: options.a11y?.minimap?.keys ?? own.a11y?.keys,
                },
            }),
        );
    }

    const settings = descriptionSettings(options);

    if (settings === null) {
        return { plugins, description: null };
    }

    const description = soundDescription({
        ...settings,
        lang: settings.lang ?? options.a11y?.lang,
        // The button reads aloud, so asking for it asks for the voice.
        speech: settings.speech ?? listenSettings(options) !== null,
        onChange: (text) => {
            settings.onChange?.(text);
            parts.described(text);
        },
    });
    plugins.push(description);

    return { plugins, description };
}
