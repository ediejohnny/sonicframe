/**
 * The parts of the now-playing bar, each a real button or text, its words from the bar's language:
 * play and pause, the sound's name, the time, a thin progress bar, the tracks around the sound, the
 * speed, back to the player, and close. Each part shows the player it is given in `show`.
 */

import { DEFAULT_LOOK } from '../../core/player/look';
import { nextSpeed, speedText } from '../../core/player/part-text';
import { PROGRESS } from '../../core/shared/variables';
import { formatTime } from '../../core/shared/timing';
import { css } from '../../dom/shared/css';
import { iconButton } from '../../player/parts/part-buttons';
import type { Player } from '../../player/player/player';
import type { NowPlayingPart } from './now-playing-options';

/** The words the parts say. */
export type PartWords = {
    play: string;
    pause: string;
    close: string;
    back: string;
    previousTrack: string;
    nextTrack: string;
};

/** A part on the bar, and how it shows the player now. */
export type BarPart = {
    readonly element: HTMLElement;
    show(player: Player): void;
};

const ICONS = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
    close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z',
    back: 'M12 4l-8 8h5v8h6v-8h5z',
    previousTrack: 'M4 6h2v12H4zm9.5 0v12L7 12zM20 6v12l-6.5-6z',
    nextTrack: 'M4 6l6.5 6L4 18zm6.5 0l6.5 6-6.5 6zM18 6h2v12h-2z',
} as const;

function button(name: string, icon: string, label: string): HTMLButtonElement {
    return iconButton(
        DEFAULT_LOOK,
        `sonicframe-now-playing-${name}`,
        icon,
        label,
    );
}

function playPart(words: PartWords): BarPart {
    const element = button('play', ICONS.play, words.play);
    let current: Player | null = null;
    element.addEventListener('click', () => {
        const media = current?.media;

        if (media?.paused === false) {
            media.pause();
        } else {
            media?.play()?.catch(() => undefined);
        }
    });

    return {
        element,
        show(player) {
            current = player;
            const playing = player.media?.paused === false;
            const label = playing ? words.pause : words.play;
            element.setAttribute('aria-label', label);
            element.title = label;
            element
                .querySelector('path')
                ?.setAttribute('d', playing ? ICONS.pause : ICONS.play);
        },
    };
}

function textPart(name: string, read: (player: Player) => string): BarPart {
    const element = document.createElement('span');
    element.className = `sonicframe-now-playing-${name}`;
    css(element, [
        ['min-width', '0'],
        ['overflow', 'hidden'],
        ['text-overflow', 'ellipsis'],
        ['white-space', 'nowrap'],
    ]);

    return {
        element,
        show(player) {
            element.textContent = read(player);
        },
    };
}

function progressPart(): BarPart {
    const element = document.createElement('span');
    element.className = 'sonicframe-now-playing-progress';
    element.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'sonicframe-now-playing-progress-fill';
    css(element, [
        ['position', 'absolute'],
        ['left', '0'],
        ['right', '0'],
        ['bottom', '0'],
        ['height', '0.1875rem'],
    ]);
    css(fill, [
        ['display', 'block'],
        ['height', '100%'],
        ['width', '0%'],
        ['background-color', PROGRESS],
    ]);
    element.append(fill);

    return {
        element,
        show(player) {
            const media = player.media;
            const duration = media?.duration ?? Number.NaN;
            const share =
                media !== null && Number.isFinite(duration) && duration > 0
                    ? Math.min(1, Math.max(0, media.currentTime / duration))
                    : 0;
            fill.style.setProperty('width', `${Math.round(share * 100)}%`);
        },
    };
}

function trackPart(way: 'previous' | 'next', words: PartWords): BarPart {
    const name = way === 'previous' ? 'previousTrack' : 'nextTrack';
    const element = button(`${way}-track`, ICONS[name], words[name]);
    let current: Player | null = null;
    element.addEventListener('click', () => {
        const tracks = current?.tracks;

        if (element.getAttribute('aria-disabled') !== 'true') {
            tracks?.[way]?.();
        }
    });

    return {
        element,
        show(player) {
            current = player;
            const tracks = player.tracks;
            const can =
                tracks?.[way] !== undefined &&
                (way === 'previous'
                    ? (tracks.hasPrevious?.() ?? true)
                    : (tracks.hasNext?.() ?? true));
            element.setAttribute('aria-disabled', String(!can));
        },
    };
}

function speedPart(): BarPart {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'sonicframe-now-playing-speed';
    css(element, [
        ['border-width', '0'],
        ['background-color', 'transparent'],
        ['color', 'inherit'],
        ['font', 'inherit'],
        ['cursor', 'pointer'],
    ]);
    let current: Player | null = null;
    element.addEventListener('click', () => {
        const media = current?.media;

        if (media) {
            media.playbackRate = nextSpeed(
                media.playbackRate,
                DEFAULT_LOOK.speeds,
            );
        }
    });

    return {
        element,
        show(player) {
            current = player;
            element.textContent = speedText(player.media?.playbackRate ?? 1);
        },
    };
}

/**
 * The part `name`; `back` and `close` call `onBack` and `onClose`.
 */
export function barPart(
    name: NowPlayingPart,
    words: PartWords,
    onBack: () => void,
    onClose: () => void,
): BarPart {
    switch (name) {
        case 'play':
            return playPart(words);
        case 'title':
            return textPart(
                'title',
                (player) => player.element.getAttribute('aria-label') ?? '',
            );
        case 'time':
            return textPart('time', (player) => {
                const media = player.media;

                return `${formatTime(media?.currentTime ?? 0)} / ${formatTime(media?.duration ?? 0)}`;
            });
        case 'progress':
            return progressPart();
        case 'previousTrack':
            return trackPart('previous', words);
        case 'nextTrack':
            return trackPart('next', words);
        case 'speed':
            return speedPart();
        case 'back': {
            const element = button('back', ICONS.back, words.back);
            element.addEventListener('click', onBack);

            return { element, show: () => undefined };
        }
        default: {
            const element = button('close', ICONS.close, words.close);
            element.addEventListener('click', onClose);

            return { element, show: () => undefined };
        }
    }
}
