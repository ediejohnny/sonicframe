/**
 * The parts of the recorder's screen, each built for the state the screen is in: its buttons (the
 * record button in `record-button`), the time and the live wave, the player of the recording, the
 * REC badge (`rec-badge`), a spacer, and the app's own buttons by name; any other name shows
 * nothing. Busy buttons (sending, asking) stay in the tab order.
 */

import type { RecorderWords } from '../../core/languages/words';
import type { PlayerLook } from '../../core/player/look';
import type { RecorderScreenState } from '../../core/recording/recording';
import { isOneOf } from '../../core/shared/checked';
import type { LiveView } from './live-view';
import { dressRec, recBadge } from './rec-badge';
import { recordButton } from './record-button';
import { actionButton, screenButton, setBusy } from './screen-buttons';
import {
    RECORDER_ICONS,
    type RecPlace,
    type RecordStyle,
    type RecorderAction,
    type RecorderIcon,
    type RecorderPartName,
} from './screen-options';

/** The names the app's buttons may take, but for the screen's own icons (`RECORDER_ICONS`). */
const ACTION_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** What a part needs from its screen. */
export type PartHost = {
    readonly look: PlayerLook;
    readonly words: Readonly<RecorderWords>;
    /** Record while the record button is held. */
    readonly hold: boolean;
    /** How the record button looks. */
    readonly recordStyle: RecordStyle;
    /** The red of its red styles, read as numbers. */
    readonly recordColor: string;
    /** The record button is painted in that red (the red style, and the microphone unless asked otherwise). */
    readonly redButton: boolean;
    /** Where the REC mark shows while recording, with the REC style. */
    readonly recPlace: RecPlace;
    /** Blinks a REC dot while recording, when the app asks. */
    blink(dot: HTMLElement): void;
    /** While sending, the send button cancels the send. */
    readonly cancelable: boolean;
    readonly live: LiveView;
    /** The screen's state now. */
    state(): RecorderScreenState;
    /** The seconds recorded so far. */
    seconds(): number;
    /** The player of the recording in review, or null. */
    review(): HTMLElement | null;
    /** The icon a button draws: the app's own, or the screen's. */
    icon(name: RecorderIcon): string;
    /** The app's own buttons, by name. */
    readonly actions: Readonly<Record<string, RecorderAction>> | undefined;
    /** Runs the app's button's press with the recording and the screen. */
    act(action: RecorderAction): void;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    discard(): void;
    send(): void;
    cancelSend(): void;
};

/** A part for the screen's state now, or null when it has nothing to show. */
export function screenPart(
    part: RecorderPartName,
    host: PartHost,
): HTMLElement | null {
    const { look, words } = host;
    const sending = host.state() === 'sending';

    switch (part) {
        case 'record':
            return recordButton(host);
        case 'stop': {
            const recMark =
                host.recordStyle === 'rec' && host.recPlace === 'stop';
            const path = host.icon(recMark ? 'record' : 'stop');
            const button = screenButton(look, 'stop', path, words.stop, () =>
                host.stop(),
            );

            if (recMark) {
                host.blink(dressRec(button, look, host.recordColor, path));
            }

            return button;
        }
        case 'rec': {
            const { badge, dot } = recBadge(
                host.recordColor,
                host.icon('record'),
                host.recPlace === 'time'
                    ? host.live.timePart(host.seconds())
                    : null,
            );
            host.blink(dot);

            return badge;
        }
        case 'pause': {
            const paused = host.state() === 'paused';

            return screenButton(
                look,
                'pause',
                host.icon(paused ? 'resume' : 'pause'),
                paused ? words.resume : words.pause,
                () => (paused ? host.resume() : host.pause()),
            );
        }
        case 'discard':
        case 'send': {
            const name = part === 'send' ? 'send' : 'discard';

            if (name === 'send' && sending && host.cancelable) {
                const cancel = screenButton(
                    look,
                    'send',
                    host.icon('cancel'),
                    words.cancelSend,
                    () => host.cancelSend(),
                );
                setBusy(cancel, false);

                return cancel;
            }

            const button = screenButton(
                look,
                name,
                host.icon(name),
                words[name],
                name === 'send' ? () => host.send() : () => host.discard(),
            );
            setBusy(button, sending);

            return button;
        }
        case 'time':
            return host.live.timePart(host.seconds());
        case 'wave':
            return host.live.wavePart();
        case 'player':
            return host.review();
        case 'spacer': {
            const spacer = document.createElement('div');
            spacer.className = 'sonicframe-recorder-spacer';
            spacer.style.setProperty('flex', '1 1 auto');

            return spacer;
        }
        default:
            return appPart(part, host, sending);
    }
}

/**
 * The app's button of `name`, busy while sending; null when the app gave none by that name, or the
 * name is not allowed (lowercase letters, digits and dashes, from a letter, up to 32).
 */
function appPart(
    name: string,
    host: PartHost,
    sending: boolean,
): HTMLButtonElement | null {
    const actions = host.actions;

    if (
        actions === undefined ||
        !ACTION_NAME.test(name) ||
        isOneOf(name, RECORDER_ICONS) ||
        !Object.hasOwn(actions, name)
    ) {
        return null;
    }

    const action = actions[name];
    const button = actionButton(host.look, name, action, () =>
        host.act(action),
    );
    setBusy(button, sending);

    return button;
}

/** The button that leads `row`: stop, then send, then an app's main button, then record, then pause, then any. */
export function mainButton(row: HTMLElement): HTMLButtonElement | null {
    for (const selector of [
        '.sonicframe-stop',
        '.sonicframe-send',
        '.sonicframe-action[data-main]',
        '.sonicframe-record',
        '.sonicframe-pause',
    ]) {
        const button = row.querySelector<HTMLButtonElement>(selector);

        if (button !== null) {
            return button;
        }
    }

    return row.querySelector('button');
}
