/**
 * `<sonic-now-playing>`: the now-playing bar as an HTML tag, for a page of players on their own.
 * Nothing is registered on import; `defineSonicNowPlaying()` does it once. The bar lives on the
 * page's body while the tag is on the page; changing an attribute builds it again. Attributes are
 * untrusted input: an unknown word falls back to the default, a number counts only when it is one.
 */

import { attributeNumber, canDefine } from '../../dom/shared/custom-element';
import { fontOf, paletteOf } from '../../dom/shared/look-attributes';
import { NowPlaying } from '../now-playing/now-playing';
import type {
    NowPlayingOptions,
    NowPlayingPart,
} from '../now-playing/now-playing-options';

/** The attributes the tag reads. */
export const NOW_PLAYING_ATTRIBUTES: readonly string[] = Object.freeze([
    'when',
    'place',
    'align',
    'offset',
    'width',
    'z-index',
    'parts',
    'palette',
    'font',
    'font-src',
    'font-stylesheet',
    'close',
    'animation',
    'animation-type',
    'a11y-label',
    'a11y-announce',
    'a11y-lang',
]);

/** Everything the tag's attributes say, as the bar's options; the bar checks each word. */
export function nowPlayingOptionsOf(element: Element): NowPlayingOptions {
    const get = (name: string): string | undefined =>
        element.getAttribute(name) ?? undefined;
    const parts = get('parts');

    return {
        when: get('when') as NowPlayingOptions['when'],
        place: get('place') as NowPlayingOptions['place'],
        align: get('align') as NowPlayingOptions['align'],
        offset: attributeNumber(element.getAttribute('offset')),
        width: attributeNumber(element.getAttribute('width')),
        zIndex: attributeNumber(element.getAttribute('z-index')),
        parts:
            parts === undefined
                ? undefined
                : (parts.split(/\s+/) as NowPlayingPart[]),
        palette: get('palette') === 'player' ? 'player' : paletteOf(element),
        font: fontOf(element),
        close: get('close') as NowPlayingOptions['close'],
        animation: element.hasAttribute('animation'),
        animationType: get(
            'animation-type',
        ) as NowPlayingOptions['animationType'],
        a11y: {
            label: get('a11y-label'),
            announce: element.hasAttribute('a11y-announce'),
            lang: get('a11y-lang'),
        },
    };
}

/**
 * Registers the tag (`<sonic-now-playing>` unless another name is given). Returns false when custom
 * elements are not available, the name is not a valid custom element name, or it is already taken.
 */
export function defineSonicNowPlaying(
    name: string = 'sonic-now-playing',
): boolean {
    if (!canDefine(name)) {
        return false;
    }

    customElements.define(
        name,
        class extends HTMLElement {
            static get observedAttributes(): string[] {
                return [...NOW_PLAYING_ATTRIBUTES];
            }

            private bar: NowPlaying | null = null;

            connectedCallback(): void {
                this.bar ??= new NowPlaying(nowPlayingOptionsOf(this));
            }

            disconnectedCallback(): void {
                this.bar?.destroy();
                this.bar = null;
            }

            attributeChangedCallback(
                _attribute: string,
                before: string | null,
                after: string | null,
            ): void {
                if (this.bar !== null && before !== after) {
                    this.bar.destroy();
                    this.bar = new NowPlaying(nowPlayingOptionsOf(this));
                }
            }
        },
    );

    return true;
}
