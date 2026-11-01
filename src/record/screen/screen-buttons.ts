/**
 * The recorder screen's buttons, and the app's own: round icon buttons like the player's, named for
 * screen readers. The main button of each stage (record, stop, send, or an app's button marked main)
 * is filled like the play button, in the player's button colors; the others are plain. A busy button stays in the tab order, marked
 * `aria-disabled`, so the focus is never lost under it.
 */

import type { PlayerLook } from '../../core/player/look';
import { svgPath } from '../../core/shared/svg-path';
import { cleanText } from '../../core/shared/text';
import { BUTTON, BUTTON_ICON } from '../../core/shared/variables';
import { css } from '../../dom/shared/css';
import { iconButton } from '../../player/parts/part-buttons';
import type { RecorderAction, RecorderIcon } from './screen-options';

/** The buttons' icons, on the 24 × 24 grid of the play icon. */
export const RECORDER_ICONS: Readonly<Record<RecorderIcon, string>> = {
    record: 'M12 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12z',
    stop: 'M7 7h10v10H7z',
    pause: 'M7 6h3.5v12H7zM13.5 6H17v12h-3.5z',
    resume: 'M12 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12z',
    discard: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
    send: 'M3 20.5 21 12 3 3.5V10l12 2-12 2z',
};

/** The icon of an app's button that brings none of its own: a dot. */
const ACTION_ICON = 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z';

/** The buttons that lead a stage. */
const MAIN = new Set(['record', 'stop', 'send']);

/** A screen button: `name` gives its class (`sonicframe-<name>`), `path` its picture. */
export function screenButton(
    look: PlayerLook,
    name: 'record' | 'stop' | 'pause' | 'discard' | 'send',
    path: string,
    label: string,
    press: () => void,
): HTMLButtonElement {
    const button = iconButton(look, `sonicframe-${name}`, path, label);

    if (MAIN.has(name)) {
        fill(look, button);
    }

    // A busy button's press is one its screen's state does not take, so it changes nothing.
    button.addEventListener('click', press);

    return button;
}

/**
 * One of the app's buttons, `sonicframe-action sonicframe-action-<name>`: its label cleaned (its name
 * when empty), its icon checked (a dot when refused), filled and marked `data-main` when it is main.
 * A press while it is busy does nothing.
 */
export function actionButton(
    look: PlayerLook,
    name: string,
    action: RecorderAction,
    press: () => void,
): HTMLButtonElement {
    const label =
        typeof action.label === 'string' ? cleanText(action.label, 120) : '';
    const button = iconButton(
        look,
        `sonicframe-action sonicframe-action-${name}`,
        svgPath(action.icon, ACTION_ICON),
        label === '' ? name : label,
    );

    if (action.main === true) {
        fill(look, button);
        button.dataset.main = '';
    }

    button.addEventListener('click', () => {
        if (button.getAttribute('aria-disabled') !== 'true') {
            press();
        }
    });

    return button;
}

/** Fills `button` like the play button, at the size of a main button. */
function fill(look: PlayerLook, button: HTMLButtonElement): void {
    const size = `${look.button.size}px`;
    css(button, [
        ['width', size],
        ['height', size],
        ['background-color', BUTTON],
        ['color', BUTTON_ICON],
    ]);
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
