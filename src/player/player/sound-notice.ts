/**
 * The player's word when its sound cannot load: it listens to the media's `error`, hands the player's
 * `error` listeners a `SoundError` with the reason, shows the reason over the wave and says it in the
 * live region (each on unless the app turns it off). The words are the player's, in its language,
 * never the browser's message. A sound that loads again takes the message away.
 */

import type { PlayerWords } from '../../core/player/labels';
import {
    SOUND_ERROR_LABELS,
    SoundError,
    soundErrorReason,
    type SoundErrorReason,
} from '../../core/player/sound-error';
import { css } from '../../dom/shared/css';

/** What the notice reaches of the player. */
export type SoundNoticeHost = {
    readonly media: HTMLMediaElement | null;
    readonly words: PlayerWords;
    readonly signal: AbortSignal;
    /** Whether the message shows over the wave. */
    readonly show: boolean;
    /** Whether the live region says it. */
    readonly announce: boolean;
    /** Hands the error to the player's `error` listeners. */
    report(error: SoundError): void;
    /** Says `text` in the live region. */
    say(text: string): void;
};

export class SoundNotice {
    private readonly host: SoundNoticeHost;
    private readonly message: HTMLDivElement;
    private failed: SoundErrorReason | null = null;
    private box: HTMLElement | null = null;

    constructor(host: SoundNoticeHost) {
        this.host = host;
        this.message = document.createElement('div');
        this.message.className = 'sonicframe-load-error';
        // The live region says it; read again here, it would be said twice.
        this.message.setAttribute('aria-hidden', 'true');
        css(this.message, [
            ['position', 'absolute'],
            ['inset', '0'],
            // Over the wave's canvas, which the wave adds after it.
            ['z-index', '1'],
            ['display', 'flex'],
            ['align-items', 'center'],
            ['justify-content', 'center'],
            ['padding', '0 0.5rem'],
            ['font-size', '0.8125rem'],
            ['line-height', '1.2'],
            ['text-align', 'center'],
            ['color', 'var(--sonicframe-muted, currentColor)'],
            ['background-color', 'var(--sonicframe-surface, transparent)'],
        ]);

        const options = { signal: host.signal };
        host.media?.addEventListener('error', () => this.fail(), options);

        for (const loaded of ['loadedmetadata', 'canplay']) {
            host.media?.addEventListener(loaded, () => this.clear(), options);
        }
    }

    /** Why the sound could not load, or null while it has not failed. */
    get reason(): SoundErrorReason | null {
        return this.failed;
    }

    /** The wave's box of a new build: the message goes over it while the sound has failed. */
    place(box: HTMLElement): void {
        this.box = box;
        this.render();
    }

    private fail(): void {
        const media = this.host.media;

        // A media element left without a source (the app emptied it) is no sound that failed.
        if (media === null || media.currentSrc === '') {
            return;
        }

        const reason = soundErrorReason(media.error?.code);
        const text = this.host.words.labels[SOUND_ERROR_LABELS[reason]];
        this.failed = reason;
        this.message.textContent = text;
        this.render();

        if (this.host.announce) {
            this.host.say(text);
        }

        this.host.report(new SoundError(reason));
    }

    private clear(): void {
        this.failed = null;
        this.message.remove();
    }

    private render(): void {
        if (this.failed !== null && this.host.show && this.box !== null) {
            this.box.append(this.message);
        }
    }
}
