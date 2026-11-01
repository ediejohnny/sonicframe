/**
 * The recorder screen's buttons: round icon buttons like the player's, named for screen readers.
 * The main button of each stage (record, stop, send) is filled like the play button, in the
 * player's button colors; the others are plain. A busy button stays in the tab order, marked
 * `aria-disabled`, so the focus is never lost under it.
 */

import type { PlayerLook } from '../../core/player/look';
import { BUTTON, BUTTON_ICON } from '../../core/shared/variables';
import { css } from '../../dom/shared/css';
import { iconButton } from '../../player/parts/part-buttons';

/** The buttons' icons, on the 24 × 24 grid of the play icon. */
export const RECORDER_ICONS = {
    record: 'M12 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12z',
    stop: 'M7 7h10v10H7z',
    pause: 'M7 6h3.5v12H7zM13.5 6H17v12h-3.5z',
    discard: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
    send: 'M3 20.5 21 12 3 3.5V10l12 2-12 2z',
} as const;

/** The buttons that lead a stage. */
const MAIN = new Set(['record', 'stop', 'send']);

/** A screen button: `name` gives its class (`sonicframe-<name>`), `icon` its picture. */
export function screenButton(
    look: PlayerLook,
    name: 'record' | 'stop' | 'pause' | 'discard' | 'send',
    icon: keyof typeof RECORDER_ICONS,
    label: string,
    press: () => void,
): HTMLButtonElement {
    const button = iconButton(
        look,
        `sonicframe-${name}`,
        RECORDER_ICONS[icon],
        label,
    );

    if (MAIN.has(name)) {
        const size = `${look.button.size}px`;
        css(button, [
            ['width', size],
            ['height', size],
            ['background-color', BUTTON],
            ['color', BUTTON_ICON],
        ]);
    }

    // A busy button's press is one its screen's state does not take, so it changes nothing.
    button.addEventListener('click', press);

    return button;
}

/** Marks a button busy (or not): it stays focusable and says so. */
export function setBusy(button: HTMLButtonElement | null, busy: boolean): void {
    if (button === null) {
        return;
    }

    button.setAttribute('aria-disabled', String(busy));
    css(button, [
        ['opacity', busy ? '0.5' : '1'],
        ['cursor', busy ? 'default' : 'pointer'],
    ]);
}
