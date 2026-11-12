/**
 * The sound's name and its artist in the player (the `title` and `artist` parts), each in a room that
 * may be too short for it (see `LongName`). The name is the player's own accessible name, or its
 * file's name when it has none and the look allows it; both are hidden from screen readers, which hear
 * the name on the player itself.
 */

import type { PlayerLook } from '../../core/player/look';
import type { SonicFrame } from '../../dom/frame/frame';
import { readableColors } from '../../dom/shared/tooltip';
import { LongName } from '../chapters/long-name';

/** What the parts reach of the player. */
export type NameHost = {
    look(): PlayerLook;
    frame(): SonicFrame | null;
    /** The sound's name: the player's own, or its file's (`look.titleFromFile`). */
    title(): string;
    artist(): string;
};

export class NameParts {
    private readonly host: NameHost;
    private names: { kind: 'title' | 'artist'; name: LongName }[] = [];

    constructor(host: NameHost) {
        this.host = host;
    }

    /** A new `title` or `artist` part, showing its text. */
    part(kind: 'title' | 'artist'): HTMLElement {
        const name = new LongName(
            this.host.look(),
            () => readableColors(this.host.frame()),
            `sonicframe-${kind}`,
        );
        this.names.push({ kind, name });
        name.text = this.textOf(kind);

        return name.element;
    }

    /** Shows the names again (the player's name changed), fitted to their room. */
    show(): void {
        for (const { kind, name } of this.names) {
            name.text = this.textOf(kind);
        }

        this.fit();
    }

    /** Fits each name to its room: its end, its walk. */
    fit(): void {
        for (const { name } of this.names) {
            name.fit();
        }
    }

    /** Forgets the parts built, when the player builds again; their names stop walking. */
    clear(): void {
        for (const { name } of this.names) {
            name.destroy();
        }

        this.names = [];
    }

    private textOf(kind: 'title' | 'artist'): string {
        return kind === 'title' ? this.host.title() : this.host.artist();
    }
}
