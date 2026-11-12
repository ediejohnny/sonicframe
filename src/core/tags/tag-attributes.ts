/**
 * The names of the attributes each SonicFrame tag reads, as plain data: the tags take their lists
 * from here, and `SONIC_TAGS` gives them to an HTML filter (a CMS's), so both always agree.
 */

/** An attribute of `<sonic-player>`'s background. */
export type BackgroundAttribute =
    | 'background-color'
    | 'background-gradient'
    | 'background-image'
    | 'background-options'
    | 'background-angle'
    | 'background-blur'
    | 'background-opacity'
    | 'background-effects'
    | 'background-animation'
    | 'background-duration';

/** `<sonic-player>`'s attributes for the background. */
export const BACKGROUND_ATTRIBUTES: readonly BackgroundAttribute[] =
    Object.freeze([
        'background-color',
        'background-gradient',
        'background-image',
        'background-options',
        'background-angle',
        'background-blur',
        'background-opacity',
        'background-effects',
        'background-animation',
        'background-duration',
    ]);

/** An attribute of `<sonic-player>`'s clock. */
export type ClockAttribute =
    | 'time-precision'
    | 'time-fps'
    | 'time-hours'
    | 'time-decimal'
    | 'time-format';

/** `<sonic-player>`'s attributes for the clock. */
export const CLOCK_ATTRIBUTES: readonly ClockAttribute[] = Object.freeze([
    'time-precision',
    'time-fps',
    'time-hours',
    'time-decimal',
    'time-format',
]);

/** What the system's media controls show. */
export type SessionDetail =
    | 'media-title'
    | 'media-artist'
    | 'media-album'
    | 'media-artwork';

/** `<sonic-player>`'s attributes for what the system's media controls show. */
export const SESSION_DETAILS: readonly SessionDetail[] = Object.freeze([
    'media-title',
    'media-artist',
    'media-album',
    'media-artwork',
]);

/** An attribute `<sonic-player>` reads. */
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
    | 'remember'
    | 'remember-key'
    | 'a11y-lang'
    | 'a11y-label'
    | 'a11y-chapters'
    | 'a11y-description'
    | 'a11y-zoom'
    | 'a11y-minimap'
    | 'a11y-keys'
    | 'a11y-remember'
    | BackgroundAttribute
    | ClockAttribute;

/** The attributes `<sonic-player>` reads (`chapter-options` is the old name of `chapters-options`). */
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
    'remember',
    'remember-key',
    'a11y-lang',
    'a11y-label',
    'a11y-chapters',
    'a11y-description',
    'a11y-zoom',
    'a11y-minimap',
    'a11y-keys',
    'a11y-remember',
    ...BACKGROUND_ATTRIBUTES,
    ...CLOCK_ATTRIBUTES,
]);

/** `<sonic-playlist>`'s own attributes. */
const PLAYLIST_OWN_ATTRIBUTES = [
    'src',
    'feed',
    'feed-order',
    'feed-limit',
    'feed-max-size',
    'feed-max-depth',
    'feed-max-elements',
    'feed-max-attributes',
    'feed-max-name-length',
    'start',
    'layout',
    'advance',
    'repeat',
    'shuffle',
    'gap',
    'previous-restarts',
    'play-on-select',
    'list',
    'list-place',
    'list-placement',
    'list-side',
    'list-width',
    'list-max-height',
    'list-header',
    'list-stay-open',
    'list-backdrop',
    'list-animation',
    'list-palette',
    'buttons',
    'remember-key',
    'now-playing',
    'fetch-credentials',
    'a11y-label',
    'a11y-announce',
    'a11y-lang',
] as const;

/** `<sonic-player>`'s attributes that belong to the sound, which each track of a playlist brings instead. */
const SOUND_ATTRIBUTES: ReadonlySet<string> = new Set([
    'src',
    'preload',
    'peaks',
    'label',
    'chapters',
]);

/** Every attribute `<sonic-playlist>` reads: its own, and the player's that are not the sound's. */
export const PLAYLIST_ATTRIBUTES: readonly string[] = Object.freeze([
    ...new Set([
        ...PLAYLIST_OWN_ATTRIBUTES,
        ...PLAYER_ATTRIBUTES.filter((name) => !SOUND_ATTRIBUTES.has(name)),
    ]),
]);

/** The attributes `<sonic-playlist>` reads on each of its own links (`<a href data-artist>Title</a>`). */
export const PLAYLIST_LINK_ATTRIBUTES: readonly string[] = Object.freeze([
    'href',
    'data-artist',
    'data-album',
    'data-artwork',
    'data-peaks',
    'data-duration',
    'data-chapters',
    'data-id',
]);

/** The attributes `<sonic-now-playing>` reads. */
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

/**
 * The attributes `<sonic-recorder>` reads (the old names `max`, `window`, `keep` and `record-blink`
 * too, until 2.0); it also reads `icon-<name>` for each of the page's `actions`.
 */
export const RECORDER_ATTRIBUTES: readonly string[] = Object.freeze([
    'max-seconds',
    'max',
    'live',
    'live-seconds',
    'window',
    'theme',
    'palette',
    'wave',
    'font',
    'font-src',
    'font-stylesheet',
    'hold',
    'after-send',
    'keep',
    'idle-parts',
    'recording-parts',
    'review-parts',
    'actions',
    'after-stop',
    'align',
    'icon-record',
    'icon-stop',
    'icon-pause',
    'icon-resume',
    'icon-discard',
    'icon-send',
    'icon-cancel',
    'upload-url',
    'upload-method',
    'upload-field',
    'cancel-send',
    'record-style',
    'record-color',
    'rec-place',
    'rec-blink',
    'record-blink',
    'mic-style',
    'mic-color',
    'a11y-lang',
    'a11y-announce-every',
]);
