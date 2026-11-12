/**
 * The buttons to the track before and after, for a player the app gives `tracks`: each shows only
 * for a way the app gives, and at an end of the list it is marked unavailable (`aria-disabled`),
 * keeps its place in the tab order (so focus is never lost under it) and does nothing.
 */

import type { Part } from '../../core/player/look';
import { css } from '../../dom/shared/css';
import type { PlayerTracks } from '../player/player-options';
import { iconButton, type PartHost } from './part-buttons';

export type TrackPart = 'previousTrack' | 'nextTrack';

export const TRACK_PARTS: readonly Part[] = ['previousTrack', 'nextTrack'];

/** A bar and two triangles each, on the 24 × 24 grid of the play icon; unlike a chapter's, which has one. */
const TRACK_ICONS = {
    previousTrack: 'M4 6h2v12H4zm9.5 0v12L7 12zM20 6v12l-6.5-6z',
    nextTrack: 'M4 6l6.5 6L4 18zm6.5 0l6.5 6-6.5 6zM18 6h2v12h-2z',
} as const;

/** The way a track part goes, and whether there is a track that way. */
function way(
    tracks: PlayerTracks,
    part: TrackPart,
): { go: (() => void) | undefined; there: () => boolean } {
    return part === 'previousTrack'
        ? {
              go: tracks.previous,
              there: () => tracks.hasPrevious?.() !== false,
          }
        : { go: tracks.next, there: () => tracks.hasNext?.() !== false };
}

/** Whether `tracks` have the way `part` goes, so its button shows. */
export function hasTrackWay(
    tracks: PlayerTracks | undefined,
    part: TrackPart,
): boolean {
    return tracks !== undefined && way(tracks, part).go !== undefined;
}

/**
 * Goes the way `part` asks when there is a track that way; whether it went. The player's keys and
 * its buttons go through here.
 */
export function goTrack(
    tracks: PlayerTracks | undefined,
    part: TrackPart,
): boolean {
    if (tracks === undefined) {
        return false;
    }

    const { go, there } = way(tracks, part);

    if (go === undefined || !there()) {
        return false;
    }

    go();

    return true;
}

/** The button of `part`, for `tracks` that have its way (see `hasTrackWay`). */
export function trackPart(
    host: PartHost,
    part: TrackPart,
    tracks: PlayerTracks,
): HTMLButtonElement {
    const button = iconButton(
        host.look(),
        part === 'previousTrack'
            ? 'sonicframe-previous-track'
            : 'sonicframe-next-track',
        TRACK_ICONS[part],
        host.words.labels[part],
    );
    const unavailable = !way(tracks, part).there();

    button.setAttribute('aria-disabled', String(unavailable));
    css(button, [
        ['opacity', unavailable ? '0.5' : '1'],
        ['cursor', unavailable ? 'default' : 'pointer'],
    ]);
    button.addEventListener('click', () => goTrack(tracks, part));

    return button;
}
