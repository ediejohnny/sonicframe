/**
 * `<sonic-player>`: the player as an HTML tag, for pages that would rather write markup than code.
 * Nothing is registered on import; `defineSonicPlayer()` does it once. Attributes map to the
 * player's options and are treated like any untrusted input: names that are not known fall back to
 * the default theme, text only ever goes in as text, and a font address is used only when it is
 * safe. Changing an attribute updates the player; taking the element out of the page destroys it,
 * putting it back builds it again. The player's events are dispatched on the element as
 * `sonicframe:<event>` custom events, with their arguments in `detail`. Accessibility attributes
 * start with `a11y-`: `a11y-lang` is the language of the player's words, and the description is off
 * unless `a11y-description` is there. Zoom is off unless `zoom` is there; its words turn on its
 * ways, and `minimap` adds the strip. The `peaks-` attributes say how the peaks file is read.
 * `chapters` takes the address of a chapters file, and `chapter-options` its extras. Each attribute
 * is read in `element-attributes.ts`.
 */

import { Player } from '../player/player';
import { fontOf, optionsOf, paletteOf, waveOf } from './element-attributes';

/** The attributes the tag reads. */
export const PLAYER_ATTRIBUTES: readonly string[] = Object.freeze([
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
    'chapter-options',
    'a11y-lang',
    'a11y-description',
    'a11y-zoom',
    'a11y-minimap',
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
    'chapter-options',
    'a11y-lang',
    'a11y-description',
    'a11y-zoom',
    'a11y-minimap',
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
    'description',
    'chapterchange',
] as const;

/** A custom element name: lowercase, starting with a letter, with at least one dash. */
const ELEMENT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

/**
 * Registers the tag (`<sonic-player>` unless another name is given). Returns false when custom
 * elements are not available, the name is not a valid custom element name, or it is already taken.
 */
export function defineSonicPlayer(name: string = 'sonic-player'): boolean {
    if (
        typeof customElements === 'undefined' ||
        !ELEMENT_NAME.test(name) ||
        customElements.get(name) !== undefined
    ) {
        return false;
    }

    customElements.define(
        name,
        class SonicPlayerElement extends HTMLElement {
            static get observedAttributes(): string[] {
                return [...PLAYER_ATTRIBUTES];
            }

            private player: Player | null = null;
            private stops: (() => void)[] = [];

            connectedCallback(): void {
                this.mount();
            }

            disconnectedCallback(): void {
                this.unmount();
            }

            attributeChangedCallback(
                attribute: string,
                before: string | null,
                after: string | null,
            ): void {
                const player = this.player;

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
                    player.setVolume(after !== null);
                } else {
                    player.setFont(fontOf(this));
                }
            }

            private mount(): void {
                if (this.player !== null) {
                    return;
                }

                if (this.style.getPropertyValue('display') === '') {
                    this.style.setProperty('display', 'block');
                }

                const player = new Player({
                    container: this,
                    ...optionsOf(this),
                });

                this.player = player;
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
                this.player?.destroy();
                this.player = null;
            }
        },
    );

    return true;
}
