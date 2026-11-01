/**
 * `<sonic-player>`: the player as an HTML tag, for pages that would rather write markup than code.
 * Nothing is registered on import; `defineSonicPlayer()` does it once. Attributes map to the
 * player's options and are treated like any untrusted input: names that are not known fall back to
 * the default theme, text only ever goes in as text, and a font address is used only when it is
 * safe. Changing an attribute updates the player; taking the element out of the page destroys it,
 * putting it back builds it again, and moving it to another place keeps it. The tag makes its own
 * `<audio>` and keeps it through every player it builds, so the sound goes on where it was (its
 * volume and speed too) until `src` or `preload` changes. The player's events are dispatched on the
 * element as `sonicframe:<event>` custom events, with their arguments in `detail`. Accessibility
 * attributes start with `a11y-`: `a11y-lang` is the language of the player's words, and the
 * description is off unless `a11y-description` is there. Zoom is off unless `zoom` is there; its
 * words turn on its ways, and `minimap` adds the strip. The `peaks-` attributes say how the peaks
 * file is read.
 * `chapters` takes the address of a chapters file, and `chapters-options` its extras; the
 * `background-` attributes give the player a background and its animation; `media-session` turns
 * on the system's media controls, which show the `media-` attributes. Each attribute is read in
 * `element-attributes.ts` (the background's in `background-attributes.ts`).
 */

import { canDefine } from '../../dom/shared/custom-element';
import { fontOf, paletteOf, waveOf } from '../../dom/shared/look-attributes';
import { Player } from '../player/player';
import { makeAudio, releaseMedia } from '../player/player-media';
import {
    BACKGROUND_ATTRIBUTES,
    type BackgroundAttribute,
} from './background-attributes';
import { optionsOf, sessionDetailsOf } from './element-attributes';

/** A `<sonic-player>` element: the tag, with the player it built while it is on the page. */
export interface SonicPlayerElement extends HTMLElement {
    /** The player the tag built, to reach what no attribute does (`chapters.go()`, `setLook()`); null off the page. */
    readonly player: Player | null;
}

declare global {
    interface HTMLElementTagNameMap {
        'sonic-player': SonicPlayerElement;
    }
}

/** What the system's media controls show. */
type SessionDetail =
    | 'media-title'
    | 'media-artist'
    | 'media-album'
    | 'media-artwork';

/** An attribute the tag reads. */
export type PlayerAttribute =
    | 'src'
    | 'preload'
    | 'peaks'
    | 'peaks-channel'
    | 'peaks-max'
    | 'peaks-normalize'
    | 'theme'
    | 'palette'
    | 'wave'
    | 'font'
    | 'font-src'
    | 'font-stylesheet'
    | 'label'
    | 'volume'
    | 'spectrogram'
    | 'zoom'
    | 'zoom-max'
    | 'minimap'
    | 'chapters'
    | 'chapters-options'
    | 'chapter-options'
    | 'media-session'
    | SessionDetail
    | 'keys'
    | 'a11y-lang'
    | 'a11y-label'
    | 'a11y-chapters'
    | 'a11y-description'
    | 'a11y-zoom'
    | 'a11y-minimap'
    | 'a11y-keys'
    | BackgroundAttribute;

/** What the system's media controls show: changed, they show at once, the player kept. */
const SESSION_DETAILS: readonly SessionDetail[] = [
    'media-title',
    'media-artist',
    'media-album',
    'media-artwork',
];

/** The attributes the tag reads (`chapter-options` is the old name of `chapters-options`). */
export const PLAYER_ATTRIBUTES: readonly PlayerAttribute[] = Object.freeze([
    'src',
    'preload',
    'peaks',
    'peaks-channel',
    'peaks-max',
    'peaks-normalize',
    'theme',
    'palette',
    'wave',
    'font',
    'font-src',
    'font-stylesheet',
    'label',
    'volume',
    'spectrogram',
    'zoom',
    'zoom-max',
    'minimap',
    'chapters',
    'chapters-options',
    'chapter-options',
    'media-session',
    ...SESSION_DETAILS,
    'keys',
    'a11y-lang',
    'a11y-label',
    'a11y-chapters',
    'a11y-description',
    'a11y-zoom',
    'a11y-minimap',
    'a11y-keys',
    ...BACKGROUND_ATTRIBUTES,
]);

/** Attributes that need a new player (a new sound, or parts built once). */
const REBUILD = new Set([
    'src',
    'preload',
    'peaks',
    'peaks-channel',
    'peaks-max',
    'peaks-normalize',
    'label',
    'spectrogram',
    'zoom',
    'zoom-max',
    'minimap',
    'chapters',
    'chapters-options',
    'chapter-options',
    'media-session',
    'keys',
    'a11y-lang',
    'a11y-label',
    'a11y-chapters',
    'a11y-description',
    'a11y-zoom',
    'a11y-minimap',
    'a11y-keys',
    ...BACKGROUND_ATTRIBUTES,
]);

const EVENTS = [
    'seek',
    'hover',
    'timeupdate',
    'durationchange',
    'peakschange',
    'resize',
    'rangeend',
    'viewchange',
    'error',
    'descriptionchange',
    'description',
    'chapterchange',
] as const;

/**
 * Registers the tag (`<sonic-player>` unless another name is given). Returns false when custom
 * elements are not available, the name is not a valid custom element name, or it is already taken.
 */
export function defineSonicPlayer(name: string = 'sonic-player'): boolean {
    if (!canDefine(name)) {
        return false;
    }

    customElements.define(
        name,
        class SonicPlayerElement extends HTMLElement {
            static get observedAttributes(): string[] {
                return [...PLAYER_ATTRIBUTES];
            }

            private built: Player | null = null;
            /** The tag's own audio, kept while its `src` and `preload` stay, through every new player. */
            private audio: HTMLAudioElement | null = null;
            /** The `src` and `preload` the audio was made for. */
            private madeFor = '';

            get player(): Player | null {
                return this.built;
            }
            private stops: (() => void)[] = [];

            connectedCallback(): void {
                this.mount();
            }

            /** Taken off the page, the tag lets its player and its sound go; moved, it keeps both. */
            disconnectedCallback(): void {
                queueMicrotask(() => {
                    if (!this.isConnected) {
                        this.unmount();
                        this.releaseAudio();
                    }
                });
            }

            attributeChangedCallback(
                attribute: string,
                before: string | null,
                after: string | null,
            ): void {
                const player = this.built;

                if (player === null || before === after) {
                    return;
                }

                if (REBUILD.has(attribute)) {
                    this.unmount();
                    this.mount();
                } else if (attribute === 'theme') {
                    player.setTheme(after ?? 'default');
                } else if (attribute === 'palette') {
                    player.setPalette(paletteOf(this));
                } else if (attribute === 'wave') {
                    player.setWave(waveOf(this));
                } else if (attribute === 'volume') {
                    player.showVolume(after !== null);
                } else if (
                    (SESSION_DETAILS as readonly string[]).includes(attribute)
                ) {
                    player.mediaSession?.set(sessionDetailsOf(this));
                } else {
                    player.setFont(fontOf(this));
                }
            }

            private mount(): void {
                if (this.built !== null) {
                    return;
                }

                if (this.style.getPropertyValue('display') === '') {
                    this.style.setProperty('display', 'block');
                }

                const options = optionsOf(this);
                const player = new Player({
                    container: this,
                    ...options,
                    media: this.audioFor(options.src, options.preload),
                });

                this.built = player;
                this.stops = EVENTS.map((event) =>
                    player.on(event, (...args: unknown[]) => {
                        this.dispatchEvent(
                            new CustomEvent(`sonicframe:${event}`, {
                                detail: args,
                            }),
                        );
                    }),
                );
            }

            private unmount(): void {
                for (const stop of this.stops) {
                    stop();
                }

                this.stops = [];
                this.built?.destroy();
                this.built = null;
            }

            /**
             * The audio for `src`: the one made before while `src` and `preload` stay the same, or a
             * new one (the old one let go); none without a `src`.
             */
            private audioFor(
                src: string | undefined,
                preload: unknown,
            ): HTMLAudioElement | undefined {
                const wanted = `${String(preload)} ${src ?? ''}`;

                if (this.audio !== null && this.madeFor === wanted) {
                    return this.audio;
                }

                this.releaseAudio();

                if (src === undefined) {
                    return undefined;
                }

                this.audio = makeAudio(src, preload);
                this.madeFor = wanted;
                this.append(this.audio);

                return this.audio;
            }

            private releaseAudio(): void {
                if (this.audio !== null) {
                    releaseMedia(this.audio);
                    this.audio.remove();
                    this.audio = null;
                }
            }
        },
    );

    return true;
}
