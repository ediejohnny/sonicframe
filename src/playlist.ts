/**
 * `sonicframe/playlist`: a list of tracks played one after the other. `createPlaylist` makes it (a
 * player for the current track and the list, or a player for each track), `<sonic-playlist>` is the
 * same as a tag, and `readTracks`, `writeTracks` and `loadTracks` read and write the lists. Kept
 * apart from the other entries, so an app without a list never loads it.
 */

export { createPlaylist, Playlist } from './playlist/playlist/playlist';
export type {
    PlaylistA11y,
    PlaylistButton,
    PlaylistEvents,
    PlaylistLayout,
    PlaylistList,
    PlaylistOptions,
    PlaylistPlayer,
    PlaylistRemember,
} from './playlist/playlist/playlist-options';
export {
    defineSonicPlaylist,
    PLAYLIST_ATTRIBUTES,
    type SonicPlaylistElement,
} from './playlist/element/playlist-element';
export {
    MAX_TRACKS,
    readTracks,
    writeTracks,
    type ReadTracksOptions,
    type Track,
    type TrackInput,
    type TracksFormat,
} from './core/playlist/tracks';
export {
    loadTracks,
    type LoadTracksOptions,
} from './core/playlist/load-tracks';
export { REPEATS, type Repeat } from './core/playlist/order';
export type { PlaylistWords } from './core/languages/words';
export type { RememberStore } from './core/player/remember';
export type { LanguageTag } from './core/languages/language';
