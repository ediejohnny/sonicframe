/**
 * The player's buttons besides play and volume: round icon buttons (skip, zoom, chapters, reading)
 * and the speed button, each a real `<button>` with a name, its icon hidden from screen readers, and
 * a focus ring in the played color for the keyboard only.
 */

import { hideFocusRing, showFocusRing } from '../controls/focus';
import { iconButtonBox } from '../core/controls/button';
import type { PlayerWords } from '../core/player/labels';
import { nextSpeed, speedText, type PlayerLook } from '../core/player/look';
import { PROGRESS } from '../core/shared/variables';
import { css } from '../dom/css';
import type { SonicFrame } from '../dom/frame';
import { iconElement, iconPath } from '../dom/icon';

/** What a part needs from the player that builds it, for as long as that build lives. */
export type PartHost = {
    /** The look the player is built with. */
    look(): PlayerLook;
    readonly words: PlayerWords;
    readonly media: HTMLMediaElement | null;
    /** The wave built now; null while none is. */
    frame(): SonicFrame | null;
    /** Keeps a cleanup for when the player builds again or is destroyed. */
    cleanup(stop: () => void): void;
};

/** Back and forward: two triangles each, on the 24 × 24 grid of the play icon. */
const SKIP_ICONS = {
    back: 'M11.5 6v12L3.5 12zM20.5 6v12l-8-6z',
    forward: 'M3.5 6v12l8-6zM12.5 6v12l8-6z',
} as const;

/** The zoom buttons: their class name and icon (on the 24 × 24 grid of the play icon). */
const ZOOM_BUTTONS = {
    zoomIn: { name: 'zoom-in', icon: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z' },
    zoomOut: { name: 'zoom-out', icon: 'M5 11h14v2H5z' },
    zoomReset: {
        name: 'zoom-reset',
        icon: 'M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
    },
} as const;

/** Names a button for screen readers, with the same words as a tooltip. */
export function nameButton(button: HTMLButtonElement, label: string): void {
    button.setAttribute('aria-label', label);
    button.title = label;
}

/** The keyboard focus ring, in the played color, through `outline-color` only. */
function focusRing(button: HTMLButtonElement): void {
    button.addEventListener('focus', () => {
        if (button.matches(':focus-visible')) {
            showFocusRing(button, PROGRESS);
        }
    });
    button.addEventListener('blur', () => hideFocusRing(button));
}

/** A round button with an SVG icon (`d` on the 24 × 24 grid), named by `label`, sized by the look's button. */
export function iconButton(
    look: PlayerLook,
    className: string,
    d: string,
    label: string,
): HTMLButtonElement {
    const button = document.createElement('button');
    const icon = iconElement();

    button.type = 'button';
    button.className = className;
    nameButton(button, label);
    icon.append(iconPath({ d, fill: 'currentColor' }));
    button.append(icon);
    css(button, [
        ...iconButtonBox(`${Math.round(look.button.size * 0.75)}px`),
        ['border-width', '0'],
        ['border-radius', '50%'],
        ['background-color', 'transparent'],
        ['color', 'inherit'],
    ]);
    css(icon, [
        ['width', '70%'],
        ['height', '70%'],
        ['display', 'block'],
    ]);
    focusRing(button);

    return button;
}

/** A pill-shaped button with text, off while there is no media. */
function textButton(
    media: HTMLMediaElement | null,
    className: string,
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.disabled = media === null;
    css(button, [
        ['appearance', 'none'],
        ['flex-shrink', '0'],
        ['margin', '0'],
        ['border-style', 'solid'],
        ['border-width', '1px'],
        ['border-color', 'var(--sonicframe-border, currentColor)'],
        ['border-radius', '62.4375rem'],
        ['background-color', 'transparent'],
        ['color', 'inherit'],
        ['font', 'inherit'],
        ['font-size', '0.85em'],
        ['line-height', '1.2'],
        ['padding', '0.125rem 0.5rem'],
        ['min-width', '2.75rem'],
        ['cursor', 'pointer'],
    ]);
    focusRing(button);

    return button;
}

/** The speed button: it steps through the look's speeds and says the speed playing. */
export function speedPart(host: PartHost): HTMLButtonElement {
    const button = textButton(host.media, 'sonicframe-speed');
    const { media, words } = host;
    const show = (): void => {
        const rate = media?.playbackRate ?? 1;
        button.textContent = speedText(rate);
        button.setAttribute(
            'aria-label',
            words.say('speed', { speed: `${words.number(rate)}×` }),
        );
    };

    button.addEventListener('click', () => {
        if (media !== null) {
            media.playbackRate = nextSpeed(
                media.playbackRate,
                host.look().speeds,
            );
            show();
        }
    });

    if (media !== null) {
        media.addEventListener('ratechange', show);
        host.cleanup(() => media.removeEventListener('ratechange', show));
    }

    show();

    return button;
}

/** A button that skips back or forward by the look's seconds, from where the sound is or will start. */
export function skipPart(
    host: PartHost,
    direction: 'back' | 'forward',
): HTMLButtonElement {
    const seconds = host.look().skip;
    const button = iconButton(
        host.look(),
        `sonicframe-${direction}`,
        SKIP_ICONS[direction],
        host.words.say(direction, { seconds: host.words.number(seconds) }),
    );
    button.disabled = host.media === null;

    button.addEventListener('click', () => {
        const frame = host.frame();
        const duration = frame?.duration ?? null;

        if (frame === null || duration === null || duration <= 0) {
            return;
        }

        // From where the sound is, or will start once a seek waiting for it to load lands.
        const now = frame.time ?? 0;
        const target = now + (direction === 'back' ? -seconds : seconds);
        frame.seekTo(Math.min(1, Math.max(0, target / duration)));
    });

    return button;
}

/**
 * A zoom button, zooming by `step`. At its limit (the largest zoom, or the whole sound) it is marked
 * `aria-disabled` and does nothing, but keeps its place in the tab order, so focus is never lost
 * under it.
 */
export function zoomPart(
    host: PartHost,
    part: 'zoomIn' | 'zoomOut' | 'zoomReset',
    step: number,
): HTMLButtonElement {
    const { name, icon } = ZOOM_BUTTONS[part];
    const button = iconButton(
        host.look(),
        `sonicframe-${name}`,
        icon,
        host.words.labels[part],
    );
    const atLimit = (): boolean => {
        const view = host.frame()?.view;

        if (view === undefined) {
            return true;
        }

        return part === 'zoomIn'
            ? view.level >= view.maxLevel - 1e-9
            : view.level <= 1;
    };
    const show = (): void => {
        const limit = atLimit();
        button.setAttribute('aria-disabled', String(limit));
        css(button, [
            ['opacity', limit ? '0.5' : '1'],
            ['cursor', limit ? 'default' : 'pointer'],
        ]);
    };

    button.addEventListener('click', () => {
        const frame = host.frame();

        if (frame === null || atLimit()) {
            return;
        }

        if (part === 'zoomReset') {
            frame.setView(0, 1, 'button');
        } else {
            frame.zoomBy(
                part === 'zoomIn' ? step : 1 / step,
                undefined,
                'button',
            );
        }
    });

    const frame = host.frame();

    if (frame !== null) {
        // The largest zoom moves with the peaks and the size, not only with the view.
        host.cleanup(frame.on('viewchange', show));
        host.cleanup(frame.on('peakschange', show));
        host.cleanup(frame.on('resize', show));
    }

    show();

    return button;
}
