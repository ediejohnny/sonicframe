/**
 * The player's own keys on the page: Space plays and pauses, M mutes, the side arrows skip, the others
 * change the volume, and `>` / `<` the speed. A key pressed in the player counts unless the control
 * with the focus took it first (the wave's arrows, the volume bar's), it presses a button or a link
 * (Space), or someone types (a field, the app's own part). With the `'page'` scope the keys also reach
 * the player that played last (the first one made, before any played) while nothing on the page has
 * the focus. With `announce`, what changed is said: the volume, the speed, the place after a skip.
 */

import {
    setMediaLevel,
    shownLevel,
    toggleMute,
    volumeText,
} from '../../core/controls/volume';
import type { PlayerWords } from '../../core/player/labels';
import type { PlayerLook } from '../../core/player/look';
import {
    playerKeyAction,
    resolvePlayerKeys,
    speedAfter,
    type PlayerKeyAction,
    type PlayerKeySettings,
} from '../../core/player/player-keys';
import { skipRatio } from '../../core/shared/steps';
import { announce } from '../../dom/a11y/announce';
import type { SonicFrame } from '../../dom/frame/frame';
import type { PlayerOptions } from '../player/player-options';

/** What the keys need from their player. */
export type KeysHost = {
    /** The player's root element. */
    readonly element: HTMLElement;
    readonly media: HTMLMediaElement | null;
    readonly words: PlayerWords;
    /** The look the player is built with (its `speeds`). */
    look(): PlayerLook;
    /** The wave built now; null while none is. */
    frame(): SonicFrame | null;
    reportError(error: unknown): void;
};

/** The keys a player's options ask for, on `host`; null while they are off. */
export function playerKeyboard(
    options: Pick<PlayerOptions, 'keys' | 'slot' | 'a11y'>,
    host: KeysHost,
): PlayerKeyboard | null {
    const settings = resolvePlayerKeys(options.keys);

    return settings === null
        ? null
        : new PlayerKeyboard(
              host,
              settings,
              options.slot ?? null,
              options.a11y?.keys?.announce === true,
          );
}

/** Where someone types: a key there is a letter, never a shortcut. */
const TYPING =
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** What Space presses by itself. */
const PRESSED_BY_SPACE =
    'button, a[href], summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="tab"], [role="option"], [role="radio"]';

/** The players whose keys reach the page, in the order they were made, and the one that played last. */
const onPage: PlayerKeyboard[] = [];
let lastPlayed: PlayerKeyboard | null = null;

/** Keeps `keyboard` as the one whose player played last. */
function playedLast(keyboard: PlayerKeyboard): void {
    lastPlayed = keyboard;
}

/** A key on a page where nothing has the focus goes to the player that played last, or the first one. */
function pageKey(event: KeyboardEvent): void {
    const target = event.target;
    const unfocused =
        target === null ||
        target === document ||
        target === document.body ||
        target === document.documentElement;

    if (unfocused) {
        (lastPlayed ?? onPage[0])?.press(event);
    }
}

export class PlayerKeyboard {
    constructor(
        private readonly host: KeysHost,
        private readonly settings: PlayerKeySettings,
        /** The app's own element inside the player, whose keys stay its own. */
        private readonly slot: HTMLElement | null,
        /** Whether to say what a key changed. */
        private readonly announcing: boolean,
    ) {
        host.element.addEventListener('keydown', this.onKey);

        if (settings.scope === 'page') {
            if (onPage.length === 0) {
                document.addEventListener('keydown', pageKey);
            }

            onPage.push(this);
            host.media?.addEventListener('play', this.onPlay);
        }
    }

    /** Does what a key asks, unless the focus keeps it; a key used is taken from the page. */
    press(event: KeyboardEvent): void {
        if (event.defaultPrevented) {
            return;
        }

        const target = event.target instanceof Element ? event.target : null;
        const action = playerKeyAction(event.key, event, this.settings);

        if (
            action === null ||
            target?.closest(TYPING) ||
            (action === 'play' && target?.closest(PRESSED_BY_SPACE))
        ) {
            return;
        }

        if (this.run(action)) {
            event.preventDefault();
        }
    }

    destroy(): void {
        this.host.element.removeEventListener('keydown', this.onKey);
        this.host.media?.removeEventListener('play', this.onPlay);

        const at = onPage.indexOf(this);

        if (at >= 0) {
            onPage.splice(at, 1);

            if (onPage.length === 0) {
                document.removeEventListener('keydown', pageKey);
            }
        }

        if (lastPlayed === this) {
            lastPlayed = null;
        }
    }

    private readonly onKey = (event: KeyboardEvent): void => {
        const inSlot =
            this.slot !== null &&
            event.target instanceof Node &&
            this.slot.contains(event.target);

        if (!inSlot) {
            this.press(event);
        }
    };

    private readonly onPlay = (): void => {
        playedLast(this);
    };

    /** Does `action`; whether there was a media to do it on. */
    private run(action: PlayerKeyAction): boolean {
        const media = this.host.media;

        if (media === null) {
            return false;
        }

        switch (action) {
            case 'play':
                this.playOrPause(media);
                break;
            case 'mute':
                toggleMute(media);
                this.sayVolume(media);
                break;
            case 'volumeUp':
            case 'volumeDown':
                setMediaLevel(
                    media,
                    shownLevel(media) +
                        (action === 'volumeUp' ? 1 : -1) *
                            this.settings.volumeStep,
                );
                this.sayVolume(media);
                break;
            case 'back':
            case 'forward':
                this.skip(action === 'back' ? -1 : 1);
                break;
            default:
                this.changeSpeed(media, action === 'faster' ? 1 : -1);
        }

        return true;
    }

    private playOrPause(media: HTMLMediaElement): void {
        if (!media.paused) {
            media.pause();

            return;
        }

        const started: Promise<void> | undefined = media.play();
        started?.catch((error: unknown) => this.host.reportError(error));
    }

    /** Skips `seconds` back or forward, as a key seek, so a zoomed view follows. */
    private skip(direction: -1 | 1): void {
        const frame = this.host.frame();
        const duration = frame?.duration ?? null;

        if (frame === null || duration === null || duration <= 0) {
            return;
        }

        const ratio = skipRatio(
            frame.time ?? 0,
            direction * this.settings.seconds,
            duration,
        );
        frame.seekTo(ratio, 'keyboard');
        this.say(this.host.words.valueText(ratio * duration, ratio, duration));
    }

    /** Plays at the next speed up or down the look's list; past either end, as it is. */
    private changeSpeed(media: HTMLMediaElement, direction: 1 | -1): void {
        const speed = speedAfter(
            media.playbackRate,
            this.host.look().speeds,
            direction,
        );

        if (speed !== null) {
            media.playbackRate = speed;
            const { words } = this.host;
            this.say(words.say('speed', { speed: `${words.number(speed)}×` }));
        }
    }

    private sayVolume(media: HTMLMediaElement): void {
        const { labels } = this.host.words;
        this.say(
            `${labels.volume} ${volumeText(media.volume, media.muted, labels.muted)}`,
        );
    }

    private say(text: string): void {
        if (this.announcing) {
            announce(text);
        }
    }
}
