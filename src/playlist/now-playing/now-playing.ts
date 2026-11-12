/**
 * The now-playing bar (`nowPlaying`): a small bar fixed to the window that follows the player that
 * started playing last, any player of the page, so the sound can be controlled while the page
 * scrolls. It shows as `when` says (by default while that player plays out of view), wears that
 * player's colors or its own, and is a named region that never takes the focus; Escape closes it.
 */

import { localeFor, wordsFor } from '../../core/languages/language';
import { mergeWords } from '../../core/languages/merge-words';
import { DEFAULT_PALETTE } from '../../core/player/palettes';
import { cleanText } from '../../core/shared/text';
import { announce } from '../../dom/a11y/announce';
import { pageLanguage } from '../../dom/a11y/page-language';
import { css } from '../../dom/shared/css';
import { prefersReducedMotion } from '../../dom/shared/motion';
import { carryLook } from '../../player/chapters/chapter-panel';
import type { Player } from '../../player/player/player';
import { dressBox } from '../../player/player/player-paint';
import { currentPlayer, onPlayers } from '../../player/player/player-registry';
import {
    nowPlayingSettings,
    type NowPlayingOptions,
    type NowPlayingSettings,
} from './now-playing-options';
import { barPart, type BarPart } from './now-playing-parts';

/** The longest word or name, in characters. */
const MAX_WORD = 120;

/** How long the bar takes to come in, when it moves, in milliseconds. */
const ENTER_MS = 180;

export class NowPlaying {
    /** The bar, on the page's body. */
    readonly element: HTMLElement;
    private readonly settings: NowPlayingSettings;
    private readonly parts: BarPart[];
    private readonly stop: () => void;
    private readonly view: IntersectionObserver | null;
    private readonly label: string;
    private player: Player | null = null;
    /** Stops listening to the followed player's media. */
    private unbind = new AbortController();
    private inView = true;
    private closed = false;

    constructor(private readonly options: NowPlayingOptions = {}) {
        this.settings = nowPlayingSettings(options);
        const a11y = options.a11y ?? {};
        const lang =
            a11y.lang === 'auto' ? pageLanguage(document.body) : a11y.lang;
        const all = wordsFor(lang);
        const words = mergeWords(all.nowPlaying, a11y.words, MAX_WORD);
        this.label = cleanText(a11y.label ?? words.bar, MAX_WORD);

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-now-playing';
        this.element.setAttribute('role', 'region');
        this.element.setAttribute('aria-label', this.label);

        // A language the app chose marks the bar, so a screen reader says its words in that voice.
        if (a11y.lang !== undefined) {
            this.element.setAttribute(
                'lang',
                localeFor(lang, a11y.words !== undefined),
            );
        }

        this.element.hidden = true;
        this.place();
        this.parts = this.settings.parts.map((name) =>
            barPart(
                name,
                {
                    play: all.playButton.play,
                    pause: all.playButton.pause,
                    previousTrack: all.player.previousTrack,
                    nextTrack: all.player.nextTrack,
                    close: words.close,
                    back: words.back,
                },
                () => this.back(),
                () => this.close(),
            ),
        );
        this.element.append(...this.parts.map((part) => part.element));
        this.element.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
            }
        });
        document.body.append(this.element);

        this.view =
            typeof IntersectionObserver === 'function'
                ? new IntersectionObserver((entries) => {
                      for (const entry of entries) {
                          if (entry.target === this.player?.element) {
                              this.inView = entry.isIntersecting;
                          }
                      }

                      this.update();
                  })
                : null;
        this.stop = onPlayers(() => this.follow());
        this.follow();
    }

    /** Takes the bar off the page. */
    destroy(): void {
        this.stop();
        this.unbind.abort();
        this.view?.disconnect();
        this.element.remove();
    }

    /** Follows the current player of the page, when it changed. */
    private follow(): void {
        const player = currentPlayer();

        if (player !== this.player) {
            this.unbind.abort();
            this.unbind = new AbortController();

            if (this.player !== null) {
                this.view?.unobserve(this.player.element);
            }

            this.player = player;
            this.inView = true;

            if (player !== null) {
                this.bind(player);
            }
        }

        this.update();
    }

    /** Listens to `player`'s media and watches it come in and out of view. */
    private bind(player: Player): void {
        const signal = this.unbind.signal;
        const media = player.media;
        this.view?.observe(player.element);
        media?.addEventListener(
            'play',
            () => {
                if (this.settings.close === 'untilNextPlay') {
                    this.closed = false;
                }

                this.update();
            },
            { signal },
        );

        for (const event of ['timeupdate', 'durationchange', 'ratechange']) {
            media?.addEventListener(event, () => this.paint(), { signal });
        }
    }

    /** Shows or hides the bar, and shows the player on it. */
    private update(): void {
        const player = this.player;
        const playing = player?.media?.paused === false;
        const when = this.settings.when;
        const shown =
            player !== null &&
            !this.closed &&
            (when === 'always' ||
                (playing && (when === 'playing' || !this.inView)));
        const was = !this.element.hidden;
        this.element.hidden = !shown;
        this.element.style.setProperty('display', shown ? 'flex' : 'none');

        if (shown && player !== null) {
            this.dress(player);
            this.paint();

            if (!was) {
                this.enter(player);
            }
        }
    }

    /** Shows the followed player on every part. */
    private paint(): void {
        const player = this.player;

        if (player !== null && !this.element.hidden) {
            for (const part of this.parts) {
                part.show(player);
            }
        }
    }

    /** The bar's place on the window, from `place`, `align`, `offset` and `width`. */
    private place(): void {
        const { place, align, offset, width, zIndex } = this.settings;
        const edge = `calc(${offset}rem + env(safe-area-inset-${place}, 0px))`;
        css(this.element, [
            ['position', 'fixed'],
            [place, edge],
            ['z-index', String(zIndex)],
            ['box-sizing', 'border-box'],
            ['align-items', 'center'],
            ['gap', '0.5rem'],
            ['overflow', 'hidden'],
            ['padding', '0.375rem 0.75rem'],
            ['background-color', 'var(--sonicframe-surface, Canvas)'],
            ['color', 'var(--sonicframe-text, CanvasText)'],
            ['border-style', 'solid'],
            ['border-width', '1px'],
            ['border-color', 'var(--sonicframe-border, currentColor)'],
            ['border-radius', '0.5rem'],
            [
                'box-shadow',
                '0 0.25rem 1rem rgba(0, 0, 0, 0.18), 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.12)',
            ],
        ]);

        if (align === 'stretch') {
            css(this.element, [
                ['left', '0.5rem'],
                ['right', '0.5rem'],
            ]);
        } else {
            css(this.element, [
                ['width', `min(${width}rem, calc(100vw - 1rem))`],
                [
                    align === 'end' ? 'right' : 'left',
                    align === 'center' ? '50%' : '0.5rem',
                ],
            ]);

            if (align === 'center') {
                this.element.style.setProperty('transform', 'translateX(-50%)');
            }
        }
    }

    /** The player's colors and font, or the bar's own palette, font and box. */
    private dress(player: Player): void {
        const { palette, font, box } = this.options;

        if (palette === undefined || palette === 'player') {
            carryLook(player.element, this.element);
        }

        dressBox(
            this.element,
            {
                palette: palette === 'player' ? undefined : palette,
                font,
                style: box,
            },
            'system',
            DEFAULT_PALETTE,
            () => undefined,
        );
    }

    /** Moves the bar in, when asked, and says the sound's name, when asked. */
    private enter(player: Player): void {
        if (this.settings.announce) {
            announce(
                `${this.label}: ${player.element.getAttribute('aria-label') ?? ''}`,
            );
        }

        if (
            !this.settings.animation ||
            prefersReducedMotion() ||
            typeof this.element.animate !== 'function'
        ) {
            return;
        }

        const from =
            this.settings.animationType === 'fade'
                ? 'none'
                : `translateY(${this.settings.place === 'top' ? '-' : ''}100%)`;
        this.element
            .animate(
                [
                    { opacity: 0, transform: from },
                    { opacity: 1, transform: 'none' },
                ],
                { duration: ENTER_MS, easing: 'ease-out' },
            )
            .finished.catch(() => undefined);
    }

    /** Scrolls back to the player and gives the focus to its first button. */
    private back(): void {
        const element = this.player?.element;

        element?.scrollIntoView({
            block: 'center',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        element
            ?.querySelector<HTMLElement>('button')
            ?.focus({ preventScroll: true });
    }

    private close(): void {
        this.closed = true;
        this.update();
    }
}

/** Makes the now-playing bar (see `NowPlayingOptions`). */
export function nowPlaying(options: NowPlayingOptions = {}): NowPlaying {
    return new NowPlaying(options);
}
