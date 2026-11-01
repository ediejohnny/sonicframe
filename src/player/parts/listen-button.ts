/**
 * The button that reads the sound in words aloud, with the browser's voice; pressed again (or Escape
 * on the wave), it stops. While it reads, its name says so and it wears the play button's colors;
 * with `animation` it also moves, never for people who asked their system for less motion.
 */

import { BUTTON, BUTTON_ICON } from '../../core/shared/variables';
import { css } from '../../dom/shared/css';
import { prefersReducedMotion } from '../../dom/shared/motion';
import type { SoundDescriptionPlugin } from '../../plugins/description/description';
import type {
    ButtonAnimation,
    PlayerListenButton,
} from '../player/player-options';
import { iconButton, nameButton, type PartHost } from './part-buttons';

/** A speech bubble, on the 24 × 24 grid of the play icon. */
const LISTEN_ICON =
    'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z';

/** One beat of the button's animation, in milliseconds (there, then back). */
const BEAT_MS = 700;

/** The keyframes of each animation of the button. */
const BUTTON_ANIMATIONS: Readonly<Record<ButtonAnimation, Keyframe[]>> = {
    pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }],
    fade: [{ opacity: 1 }, { opacity: 0.5 }],
};

/** The animation the button asks for: none unless it is on; the pulse unless a known type is named. */
function animationOf(settings: PlayerListenButton): ButtonAnimation | null {
    if (settings.animation !== true) {
        return null;
    }

    const type: unknown = settings.animationType;

    return type === 'fade' ? 'fade' : 'pulse';
}

/** The reading button, for the description the player has now (`description`). */
export function listenPart(
    host: PartHost,
    settings: PlayerListenButton,
    description: () => SoundDescriptionPlugin | null,
): HTMLButtonElement {
    const labels = host.words.labels;
    const animation = animationOf(settings);
    const button = iconButton(
        host.look(),
        'sonicframe-listen',
        LISTEN_ICON,
        labels.listen,
    );
    let beating: Animation | null = null;
    const show = (): void => {
        const reading = description()?.speaking === true;
        nameButton(button, reading ? labels.stopListening : labels.listen);
        css(button, [
            ['background-color', reading ? BUTTON : 'transparent'],
            ['color', reading ? BUTTON_ICON : 'inherit'],
        ]);

        if (
            reading &&
            beating === null &&
            animation !== null &&
            typeof button.animate === 'function' &&
            !prefersReducedMotion()
        ) {
            beating = button.animate(BUTTON_ANIMATIONS[animation], {
                duration: BEAT_MS,
                direction: 'alternate',
                iterations: Number.POSITIVE_INFINITY,
                easing: 'ease-in-out',
            });
            // Cancelling the animation rejects `finished`; that is how it ends, never an error.
            beating.finished.catch(() => undefined);
        } else if (!reading) {
            beating?.cancel();
            beating = null;
        }
    };
    host.cleanup(() => {
        beating?.cancel();
        beating = null;
    });

    button.addEventListener('click', () => {
        const plugin = description();

        if (plugin === null) {
            return;
        }

        if (plugin.speaking) {
            plugin.stopSpeaking();
            show();

            return;
        }

        const reading = plugin.speak();
        show();
        reading.then(show, (error: unknown) => {
            // Said aloud too: a person pressing the button may not see the page.
            host.frame()?.announce(labels.speechFailed);
            host.frame()?.reportError(error);
            show();
        });
    });

    return button;
}
