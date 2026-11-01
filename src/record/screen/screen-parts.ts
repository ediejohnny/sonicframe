/**
 * The parts of the recorder's screen, each built for the state the screen is in: its buttons (the
 * record button records while held, with `hold`), the time and the live wave, the player of the
 * recording, and a spacer. Busy buttons (sending, asking) stay in the tab order.
 */

import type { RecorderWords } from '../../core/languages/words';
import type { PlayerLook } from '../../core/player/look';
import type { RecorderState } from '../../core/recording/recording';
import type { LiveView } from './live-view';
import { screenButton, setBusy } from './screen-buttons';
import type { RecorderIcon, RecorderPart } from './screen-options';

/** A press shorter than this, in milliseconds, is a click even with `hold`: recording goes on. */
const HOLD = 300;

/** What a part needs from its screen. */
export type PartHost = {
    readonly look: PlayerLook;
    readonly words: Readonly<RecorderWords>;
    /** Record while the record button is held. */
    readonly hold: boolean;
    readonly live: LiveView;
    /** The screen's state now. */
    state(): RecorderState;
    /** The seconds recorded so far. */
    seconds(): number;
    /** The player of the recording in review, or null. */
    review(): HTMLElement | null;
    /** The icon a button draws: the app's own, or the screen's. */
    icon(name: RecorderIcon): string;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    discard(): void;
    send(): void;
};

/** The record button: a press records; with `hold`, recording stops when a long press ends. */
function recordButton(host: PartHost): HTMLButtonElement {
    const button = screenButton(
        host.look,
        'record',
        host.icon('record'),
        host.words.record,
        () => host.start(),
    );
    setBusy(button, host.state() === 'asking');

    if (host.hold) {
        button.addEventListener('pointerdown', () => {
            const pressed = performance.now();
            const release = (): void => {
                document.removeEventListener('pointerup', release);
                document.removeEventListener('pointercancel', release);

                if (
                    performance.now() - pressed >= HOLD &&
                    host.state() === 'recording'
                ) {
                    host.stop();
                }
            };

            document.addEventListener('pointerup', release);
            document.addEventListener('pointercancel', release);
            host.start();
        });
    }

    return button;
}

/** A part for the screen's state now, or null when it has nothing to show. */
export function screenPart(
    part: RecorderPart,
    host: PartHost,
): HTMLElement | null {
    const { look, words } = host;
    const sending = host.state() === 'sending';

    switch (part) {
        case 'record':
            return recordButton(host);
        case 'stop':
            return screenButton(
                look,
                'stop',
                host.icon('stop'),
                words.stop,
                () => host.stop(),
            );
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
            const button = screenButton(
                look,
                part,
                host.icon(part),
                words[part],
                part === 'send' ? () => host.send() : () => host.discard(),
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
        default: {
            const spacer = document.createElement('div');
            spacer.className = 'sonicframe-recorder-spacer';
            spacer.style.setProperty('flex', '1 1 auto');

            return spacer;
        }
    }
}

/** The button that leads `row`: stop, then send, then record, then pause, then any. */
export function mainButton(row: HTMLElement): HTMLButtonElement | null {
    for (const name of ['stop', 'send', 'record', 'pause']) {
        const button = row.querySelector<HTMLButtonElement>(
            `.sonicframe-${name}`,
        );

        if (button !== null) {
            return button;
        }
    }

    return row.querySelector('button');
}
