/**
 * The players of the page, for what follows the one playing (the now-playing bar): a player joins when
 * it is made and leaves when it is destroyed, and the one whose media started playing last is the
 * current one. Listeners hear every play, pause and leave.
 */

import type { Player } from './player';

const players = new Set<Player>();
const listeners = new Set<() => void>();
let current: Player | null = null;

function changed(): void {
    // A copy: a listener may stop listening while the others are called.
    for (const listener of Array.from(listeners)) {
        listener();
    }
}

export function joinPlayers(player: Player): void {
    players.add(player);
}

export function leavePlayers(player: Player): void {
    players.delete(player);

    if (current === player) {
        current = null;
    }

    changed();
}

/** `player`'s media started playing: it becomes the current player. */
export function playerStarted(player: Player): void {
    if (players.has(player)) {
        current = player;
        changed();
    }
}

/** A player paused or ended. */
export function playerStopped(): void {
    changed();
}

/** The player whose media started playing last, while it is on the page; null before any played. */
export function currentPlayer(): Player | null {
    return current;
}

/** Calls `listener` at every play, pause and leave of a player; returns the function that stops it. */
export function onPlayers(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}
