/**
 * `<sonic-playlist>`: the playlist as an HTML tag. Nothing is registered on import;
 * `defineSonicPlaylist()` does it once. The tracks are the tag's own links, or the list at `src`
 * (see `playlist-attributes.ts`); while the playlist is built, the links are hidden, and they come
 * back when the tag leaves the page. Changing an attribute or a link builds the playlist again;
 * taking the tag out of the page destroys it. The playlist's events are dispatched on the tag as
 * `sonicframe:<event>` custom events, with their arguments in `detail`.
 */

import {
    canDefine,
    forwardEvents,
    showAsBlock,
} from '../../dom/shared/custom-element';
import { Playlist } from '../playlist/playlist';
import {
    ownLinks,
    PLAYLIST_ATTRIBUTES,
    playlistOptionsOf,
} from './playlist-attributes';

export { PLAYLIST_ATTRIBUTES } from './playlist-attributes';

/** A `<sonic-playlist>` element: the tag, with the playlist it built while it is on the page. */
export interface SonicPlaylistElement extends HTMLElement {
    /** The playlist the tag built, to reach what no attribute does (`add()`, `move()`); null off the page. */
    readonly playlist: Playlist | null;
}

declare global {
    interface HTMLElementTagNameMap {
        'sonic-playlist': SonicPlaylistElement;
    }
}

const EVENTS = ['trackchange', 'listend', 'trackschange', 'error'] as const;

/** What the tag watches for its links to change. */
const WATCHED: MutationObserverInit = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
};

/** Whether `node` is one of the tag's own links (a child of it), or inside one. */
function inLink(tag: Element, node: Node): boolean {
    const link =
        node instanceof Element
            ? node.closest('a')
            : node.parentElement?.closest('a');

    return link !== null && link !== undefined && link.parentElement === tag;
}

/**
 * Whether a change touched the tag's own links: one added or taken out, or one's address, data or
 * text changed. The playlist built inside the tag (its players, its list) never counts.
 */
function touchesLinks(tag: Element, change: MutationRecord): boolean {
    if (change.type === 'childList' && change.target === tag) {
        return [...change.addedNodes, ...change.removedNodes].some(
            (node) => node instanceof HTMLAnchorElement,
        );
    }

    return inLink(tag, change.target);
}

/**
 * Registers the tag (`<sonic-playlist>` unless another name is given). Returns false when custom
 * elements are not available, the name is not a valid custom element name, or it is already taken.
 */
export function defineSonicPlaylist(name: string = 'sonic-playlist'): boolean {
    if (!canDefine(name)) {
        return false;
    }

    customElements.define(
        name,
        class extends HTMLElement implements SonicPlaylistElement {
            static get observedAttributes(): string[] {
                return [...PLAYLIST_ATTRIBUTES];
            }

            private built: Playlist | null = null;
            private links: MutationObserver | null = null;
            /** The links the tag hid while its playlist stands. */
            private hiddenLinks: HTMLElement[] = [];

            get playlist(): Playlist | null {
                return this.built;
            }

            connectedCallback(): void {
                this.mount();

                if (
                    this.links === null &&
                    typeof MutationObserver === 'function'
                ) {
                    this.links = new MutationObserver((changes) => {
                        if (
                            changes.some((change) => touchesLinks(this, change))
                        ) {
                            this.rebuild();
                        }
                    });
                    this.links.observe(this, WATCHED);
                }
            }

            disconnectedCallback(): void {
                this.links?.disconnect();
                this.links = null;
                this.unmount();
            }

            attributeChangedCallback(
                _attribute: string,
                before: string | null,
                after: string | null,
            ): void {
                if (before !== after) {
                    this.rebuild();
                }
            }

            private rebuild(): void {
                if (this.built !== null) {
                    this.unmount();
                    this.mount();
                }
            }

            private mount(): void {
                if (this.built !== null) {
                    return;
                }

                showAsBlock(this);
                const options = playlistOptionsOf(this);
                this.hiddenLinks = ownLinks(this).filter(
                    (link) => !link.hidden,
                );
                this.links?.disconnect();

                for (const link of this.hiddenLinks) {
                    link.hidden = true;
                }

                const playlist = new Playlist({ container: this, ...options });
                this.built = playlist;
                this.links?.observe(this, WATCHED);
                forwardEvents(this, playlist, EVENTS);
            }

            private unmount(): void {
                this.built?.destroy();
                this.built = null;

                for (const link of this.hiddenLinks) {
                    link.hidden = false;
                }

                this.hiddenLinks = [];
            }
        },
    );

    return true;
}
