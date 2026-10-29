/**
 * `<sonic-player>`: the player as an HTML tag, for pages that would rather write markup than code.
 * Nothing is registered on import; `defineSonicPlayer()` does it once. Attributes map to the
 * player's options and are treated like any untrusted input: names that are not known fall back to
 * the default theme, text only ever goes in as text, and a font address is used only when it is
 * safe. Changing an attribute updates the player; taking the element out of the page destroys it,
 * putting it back builds it again. The player's events are dispatched on the element as
 * `sonicframe:<event>` custom events, with their arguments in `detail`. Accessibility attributes
 * start with `a11y-`: `a11y-lang` is the language of the player's words, and the description is off
 * unless `a11y-description` is there.
 */

import type { FontChoice } from '../core/fonts';
import type { PaletteChoice } from '../core/palettes';
import { loadPeaks } from '../core/peaks';
import type { WaveName } from '../types';
import { Player, type PlayerDescription } from './player';

/** The attributes the tag reads. */
export const PLAYER_ATTRIBUTES: readonly string[] = Object.freeze([
    'src',
    'peaks',
    'theme',
    'palette',
    'wave',
    'font',
    'font-src',
    'font-stylesheet',
    'label',
    'volume',
    'spectrogram',
    'a11y-lang',
    'a11y-description',
]);

/** Attributes that need a new player (a new sound, or parts built once). */
const REBUILD = new Set([
    'src',
    'peaks',
    'label',
    'spectrogram',
    'a11y-lang',
    'a11y-description',
]);

const EVENTS = [
    'seek',
    'hover',
    'timeupdate',
    'durationchange',
    'peakschange',
    'resize',
    'rangeend',
    'error',
    'description',
] as const;

/**
 * The description from the `a11y-description` attribute: present turns it on, and its words turn on
 * the extras (`keys`, `pauses`, `speech`, `button`, `announce`) and the button's `animation`, of the
 * type `pulse` (the default) or `fade`; any other word is ignored.
 */
function descriptionOf(value: string | null): PlayerDescription | undefined {
    if (value === null) {
        return undefined;
    }

    const words = new Set(value.toLowerCase().split(/\s+/));

    return {
        keys: words.has('keys'),
        pauseInValue: words.has('pauses'),
        speech: words.has('speech'),
        button: words.has('button')
            ? {
                  animation: words.has('animation'),
                  animationType: words.has('fade') ? 'fade' : 'pulse',
              }
            : false,
        announceWhenReady: words.has('announce'),
    };
}

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
                    player.setPalette(this.palette());
                } else if (attribute === 'wave') {
                    player.setWave(this.wave());
                } else if (attribute === 'volume') {
                    player.setVolume(after !== null);
                } else {
                    player.setFont(this.font());
                }
            }

            private palette(): PaletteChoice | undefined {
                return (this.getAttribute('palette') ?? undefined) as
                    | PaletteChoice
                    | undefined;
            }

            private wave(): WaveName | undefined {
                return (this.getAttribute('wave') ?? undefined) as
                    | WaveName
                    | undefined;
            }

            private font(): FontChoice | undefined {
                const family = this.getAttribute('font');
                const src = this.getAttribute('font-src') ?? undefined;
                const stylesheet =
                    this.getAttribute('font-stylesheet') ?? undefined;

                if (family === null) {
                    return undefined;
                }

                return src !== undefined || stylesheet !== undefined
                    ? { family, src, stylesheet }
                    : family;
            }

            private mount(): void {
                if (this.player !== null) {
                    return;
                }

                if (this.style.getPropertyValue('display') === '') {
                    this.style.setProperty('display', 'block');
                }

                const peaks = this.getAttribute('peaks');
                const player = new Player({
                    container: this,
                    src: this.getAttribute('src') ?? undefined,
                    peaks: peaks === null ? undefined : () => loadPeaks(peaks),
                    theme: this.getAttribute('theme') ?? undefined,
                    palette: this.palette(),
                    wave: this.wave(),
                    font: this.font(),
                    label: this.getAttribute('label') ?? undefined,
                    volume: this.hasAttribute('volume'),
                    spectrogram: this.hasAttribute('spectrogram'),
                    a11y: {
                        lang: this.getAttribute('a11y-lang') ?? undefined,
                        description: descriptionOf(
                            this.getAttribute('a11y-description'),
                        ),
                    },
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
