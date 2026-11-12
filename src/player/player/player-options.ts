/** What a player takes and what it tells: its options, grouped by place, and its events. */

import type { LanguageTag } from '../../core/languages/language';
import type { Chapter, ChapterInput } from '../../core/chapters/chapters';
import type { PlayerLabels } from '../../core/languages/words';
import type { FontChoice } from '../../core/player/fonts';
import type { PlayerLook } from '../../core/player/look';
import type { PaletteChoice } from '../../core/player/palettes';
import type { PlayerKeys } from '../../core/player/player-keys';
import type { PlayerRemember, RememberStore } from '../../core/player/remember';
import type { ThemeInput } from '../../core/player/theme';
import type { ThemeName } from '../../core/player/themes';
import type { ZoomOptions } from '../../core/view/zoom';
import type { SonicFrameOptions } from '../../dom/frame/frame-options';
import type { ChapterListLook } from '../../dom/list/list-look';
import type {
    ChaptersA11y,
    ChaptersOptions,
    ChaptersPlugin,
} from '../../plugins/chapters/chapters-options';
import type { SoundDescriptionOptions } from '../../plugins/description/description';
import type {
    MediaSessionOptions,
    MediaSessionPlugin,
} from '../../plugins/media-session/media-session';
import type { MinimapOptions } from '../../plugins/minimap/minimap';
import type {
    BarStyle,
    PeaksSource,
    Plugin,
    SonicFrameEvents,
    WaveName,
    WaveStyle,
} from '../../types';

export type {
    ChapterListLook,
    ChaptersPlugin,
    PlayerKeys,
    PlayerRemember,
    RememberStore,
    MediaSessionOptions,
    MediaSessionPlugin,
};

export type PlayerOptions = {
    /** The element the player is added to. */
    container: HTMLElement;
    /** An audio or video element to play; or give `src` and the player makes its own. */
    media?: HTMLMediaElement | null;
    /** The sound's address, when the player should make its own media element. */
    src?: string;
    /**
     * How much of the sound the player's own media loads before play: `'metadata'` (the default),
     * `'none'` (nothing until play; give the duration with the peaks) or `'auto'`.
     */
    preload?: 'none' | 'metadata' | 'auto';
    /**
     * Peaks, alone or with their duration (`{ peaks, duration }`), or a function that loads them;
     * by default they are decoded from the sound.
     */
    peaks?: PeaksSource;
    /** Duration in seconds, used until the media knows its own. */
    duration?: number | null;
    /**
     * A whole player in one name (`'bubble'`, `'pulse'`, a name you registered) or one made with
     * `defineTheme`. The options below win over it.
     */
    theme?: ThemeName | (string & {}) | ThemeInput;
    /** How the player is put together (parts, sizes, finish); laid over the theme's look. */
    look?: Partial<PlayerLook>;
    /**
     * A palette by name, `'auto'` (light or dark, following the system), `'default'` (SonicFrame's
     * own colors and the page's variables), or your own colors.
     */
    palette?: PaletteChoice;
    /** How the sound is drawn. */
    wave?: WaveName | Partial<WaveStyle>;
    bar?: Partial<BarStyle>;
    /** A font stack name, a CSS `font-family` list, or a font you bring (`{ family, src, stylesheet }`). */
    font?: FontChoice;
    /** Show the volume control (where the look places it, or at the end of the line). Off by default. */
    volume?: boolean;
    /** Draw a spectrogram under the wave, in the palette's colors (one decode serves both). Off by default. */
    spectrogram?: boolean;
    /**
     * Zoom and scroll on the wave, off by default: the wave's zoom options, plus `buttons` (zoom in,
     * zoom out and back to the whole sound, where the look places them or at the end of the line).
     * Zoom works with or without the buttons, by the ways switched on.
     */
    zoom?: boolean | PlayerZoom;
    /** A minimap strip under the wave, its height from the look (`minimapHeight`). Off by default. */
    minimap?: boolean | MinimapOptions;
    /**
     * Chapters on the wave (see `chapters`): the address of a WebVTT or JSON chapters file, a list,
     * or the plugin's options plus `list`. The look can place the chapter playing,
     * buttons to the previous and next chapter and a button that opens the list. Off by default.
     */
    chapters?: string | readonly ChapterInput[] | PlayerChapters;
    /**
     * The system's media controls (the lock screen, the notification, the media keys; see
     * `mediaSession`): true, or the plugin's options plus `chapters`. The title is the player's
     * `label` and a skip moves the look's `skip` seconds, unless given. Off by default.
     */
    mediaSession?: boolean | PlayerMediaSession;
    /**
     * The tracks around this sound, for a player inside a list (a playlist gives them; see
     * `PlayerTracks`). With them, the look can place the `previousTrack` and `nextTrack` buttons, the
     * keys go from track to track (N, Shift+N) and the media controls step through the tracks. Off by
     * default; `setTracks` changes them later.
     */
    tracks?: PlayerTracks;
    /** How a sound is decoded for its peaks, when none are given. */
    decode?: PlayerDecode;
    /** Your own element for the `slot` part (an avatar, say); it is given back on destroy. */
    slot?: HTMLElement | null;
    /**
     * The player's own keys: Space plays and pauses, M mutes, ← → skip, ↑ ↓ change the volume and
     * `>` `<` the speed (see `PlayerKeys`). The control with the focus keeps the keys it uses (the
     * wave's arrows), and nothing happens while someone types. Off by default.
     */
    keys?: boolean | PlayerKeys;
    /**
     * Remembers between visits where each sound was left (it resumes there), the volume and the speed
     * (see `PlayerRemember`), in the page's `localStorage` or a storage of your own. `forget()` clears
     * it. Off by default.
     */
    remember?: boolean | PlayerRemember;
    /**
     * When the sound cannot load, a message over the wave says why ("Could not load the sound"), in
     * the player's language. On by default (`false` turns it off); the `error` event goes out either
     * way, with a `SoundError` whose `reason` says why.
     */
    loadError?: boolean | { show?: boolean };
    /**
     * Who made the sound: shown by the `artist` part (off the line by default) and given to the
     * system's media controls when `mediaSession` names no artist.
     */
    artist?: string;
    /** @deprecated Use `a11y.label`; `label` goes in 2.0. */
    label?: string;
    /** Accessibility: the language of the player's words, its labels and the sound in words. */
    a11y?: PlayerA11y;
    plugins?: readonly Plugin[];
    /** Any other option of the wave (`label`, `lazy`, `colors`…). */
    frame?: Partial<
        Omit<
            SonicFrameOptions,
            | 'container'
            | 'media'
            | 'peaks'
            | 'duration'
            | 'wave'
            | 'bar'
            | 'plugins'
        >
    >;
};

/**
 * The player's accessibility options, grouped by place; everything that adds behaviour is off by
 * default but the load error's announcement, which tells of a sound that cannot play.
 */
export type PlayerA11y = {
    /**
     * The language of the accessible names, the wave's value in words, the description and the
     * plugins: `'en'` (the default), `'pt'` (the Portuguese of Brazil), `'pt-PT'`, `'es'`, `'fr'`, a
     * registered one (`registerLanguage`), or `'auto'` (the page's language). A tag with a region finds
     * its language (`'es-MX'` speaks Spanish). Given, it also marks the player with it.
     */
    lang?: LanguageTag;
    /** The player's accessible name: its `player` word (`'Audio player'`) by default. */
    label?: string;
    /** Your own accessible names and words, over the language's. */
    words?: Partial<PlayerLabels>;
    /** @deprecated Use `a11y.words`; `a11y.labels` goes in 2.0. */
    labels?: Partial<PlayerLabels>;
    /**
     * The sound in words for screen readers (see `soundDescription`): true, or its options plus
     * `button`, a button that reads it with the browser's voice. Off by default.
     */
    description?: boolean | PlayerDescription;
    /** `announce` says the new view after a zoom by the keys, the buttons or two fingers. Off by default. */
    zoom?: { announce?: boolean };
    /**
     * `keys` makes the minimap a keyboard slider of the part in view, named in the player's language.
     * Off by default: the minimap is hidden from screen readers.
     */
    minimap?: { keys?: boolean };
    /**
     * `announce` says what the player's keys change: the volume ("Volume 55%"), the speed and the
     * place after a skip. Off by default.
     */
    keys?: { announce?: boolean };
    /** `announce` says where a sound resumes, at its first play ("Resuming at 12:30"). Off by default. */
    remember?: { announce?: boolean };
    /**
     * `announce` says, when the sound cannot load, why ("Could not load the sound"). On by default,
     * so a person who cannot see the player learns it too.
     */
    loadError?: { announce?: boolean };
    /**
     * The wave's slider's name: `'position'` (the default) its `position` word ("Playback position"),
     * `'label'` the sound's name, `'both'` the two ("Little Elf, Playback position"). The sound's name
     * is the one the `title` part shows; without one, the slider keeps its word. An unknown value is
     * `'position'`, and the app's own `frame.label` wins.
     */
    sliderName?: SliderName;
};

/** What names the wave's slider (see `PlayerA11y.sliderName`). */
export type SliderName = 'position' | 'label' | 'both';

/**
 * The player's chapters: the plugin's options (its words come from the player's language and
 * labels), plus a list inside the player.
 */
export type PlayerChapters = Omit<
    ChaptersOptions,
    | 'list'
    | 'words'
    | 'onChapterChange'
    | 'onChange'
    | 'onChapters'
    | 'header'
    | 'listLook'
    | 'a11y'
> & {
    /** The list of chapters: true (in the player, under the wave) or its options. Off by default. */
    list?: boolean | PlayerChapterList;
    /** What a screen reader hears of the chapters; their words are the player's (`a11y.words`). */
    a11y?: Omit<ChaptersA11y, 'words'>;
};

/** How the player's list of chapters shows and looks; every extra is off by default. */
export type PlayerChapterList = {
    /**
     * `'inline'` (the default: in the player, under the wave), `'popover'` (a box over the page,
     * pointing at the `chapters` button) or `'drawer'` (a panel along a side of the page). The two
     * that float add the `chapters` button at the end of the line when the look places none.
     */
    type?: 'inline' | 'popover' | 'drawer';
    /**
     * In the player, whether the list starts open when the look has a `chapters` button; without
     * that button it always shows. Closed by default.
     */
    open?: boolean;
    /** Where a popover opens: `'auto'` (the default: under its button, over it without room), `'above'`, `'below'`. */
    placement?: 'auto' | 'above' | 'below';
    /** The page's side a drawer opens on: `'right'` (the default) or `'left'`. */
    side?: 'left' | 'right';
    /** The width of a popover or a drawer, in rem: 18 and 20 by default, from 10 to 40. */
    width?: number;
    /** The tallest a popover grows before it scrolls, in rem: 20 by default, from 6 to 60. */
    maxHeight?: number;
    /**
     * A head over the list with its name and the place of the chapter playing ("2 / 8"). On by
     * default for a popover or a drawer, off for the list in the player.
     */
    header?: boolean;
    /** How the list's items look: pictures (size, shape), which pieces show, title lines, spacing. */
    look?: ChapterListLook;
    /** A popover or a drawer stays open after a chapter is chosen. Off by default. */
    stayOpen?: boolean;
    /** A drawer dims the page behind it; a press there closes it. Off by default. */
    backdrop?: boolean;
    /** A popover or a drawer moves in as it opens, never for people who asked for less motion. Off by default. */
    animation?: boolean;
    /** `'fade'` (the default) or `'slide'`. */
    animationType?: 'fade' | 'slide';
    /** A finger swiping on the player, off the wave, opens the list; the other way closes it. Off by default. */
    swipe?: boolean;
    /** The swipe that opens the list: `'up'` (the default), `'down'`, `'left'` or `'right'`. */
    swipeDirection?: 'up' | 'down' | 'left' | 'right';
    /**
     * The list's own palette, as the player's `palette` takes it (a name, `'auto'` or your colors);
     * the player's colors by default.
     */
    palette?: PaletteChoice;
    /** The list's own font, as the player's `font` takes it; the player's by default. */
    font?: FontChoice;
    /** The list's own box; each one left out keeps the list's default. */
    box?: PlayerChapterListStyle;
    /** @deprecated Use `box`; `style` goes in 2.0. */
    style?: PlayerChapterListStyle;
};

/** The list's own box. */
export type PlayerChapterListStyle = {
    /** Corner radius, in rem, from 0 to 4. */
    corner?: number;
    /** Border width, in CSS pixels, from 0 to 4. */
    border?: number;
    /** `'none'`, `'soft'`, `'hard'` (offset, in the text color) or `'glow'` (in the played color). */
    shadow?: 'none' | 'soft' | 'hard' | 'glow';
    /** Space inside the list, in rem, from 0 to 3. */
    padding?: number;
    /** Text size, in rem, from 0.5 to 2. */
    fontSize?: number;
};

/** The media controls on a player: the plugin's options, plus whether they follow its chapters. */
export type PlayerMediaSession = Omit<MediaSessionOptions, 'chapters'> & {
    /**
     * With the player's chapters, the controls list them and the previous and next track go to the
     * chapter before and after (the app's `onPrevious` and `onNext` win). On by default; false
     * leaves the chapters out.
     */
    chapters?: boolean;
    /**
     * What the previous and next track buttons of the controls step through: the player's `tracks`
     * when it has them, otherwise its chapters (`'auto'`, the default); only the `'tracks'` or only
     * the `'chapters'`; or nothing (`false`, the buttons left out). A button shows only when the
     * player is made with tracks that go its way, or with chapters, and then follows `setTracks`.
     * The app's `onPrevious` and `onNext` win over all of these.
     */
    previousNext?: 'auto' | 'tracks' | 'chapters' | false;
};

/**
 * The tracks around a player's sound, as a list of tracks gives them. A way left out has no button,
 * no key and no media control.
 */
export type PlayerTracks = {
    /** Plays the track before. */
    previous?: () => void;
    /** Plays the track after. */
    next?: () => void;
    /**
     * Whether there is a track before, asked when the player builds and on `setTracks`; true when
     * left out. Without one, the button is marked unavailable (`aria-disabled`), keeps its place in
     * the tab order and does nothing, and the key goes on to the page.
     */
    hasPrevious?: () => boolean;
    /** Whether there is a track after; as `hasPrevious`. */
    hasNext?: () => boolean;
};

/** The player's zoom: the wave's zoom options, plus its buttons. */
export type PlayerZoom = ZoomOptions & {
    /** The zoom in, zoom out and whole-sound buttons. Off by default. */
    buttons?: boolean;
};

/** How the player decodes a sound for its peaks. */
export type PlayerDecode = {
    /** How many peaks: 1000, from 100 to 100 000. */
    peakCount?: number;
    /** @deprecated Use `peakCount`; `peaks` goes in 2.0. */
    peaks?: number;
    /**
     * With zoom on, peaks per second of sound, so zooming in shows detail: 100, from 1 to 1000. The
     * count never falls below `peakCount`, nor rises past 1 000 000.
     */
    peaksPerSecond?: number;
    /** The longest sound decoded, in seconds; a longer one is read evenly through. Only lowers 1800. */
    maxSeconds?: number;
    /** The largest file decoded, in bytes. Only lowers 52 428 800. */
    maxBytes?: number;
};

/** The description on a player: the plugin's options, plus a button that reads it aloud. */
export type PlayerDescription = SoundDescriptionOptions & {
    /** A button that reads the description with the browser's voice (where it has one); off by default. */
    button?: boolean | PlayerListenButton;
};

/** How the reading button moves while it reads: it grows and shrinks back, or fades and comes back. */
export type ListenButtonAnimation = 'pulse' | 'fade';

/** The button that reads the description aloud. */
export type PlayerListenButton = {
    /**
     * While it reads, the button wears the play button's colors, so people who see it know it is
     * reading and can be pressed to stop; `animation: true` also moves it, as `animationType` says. Off
     * by default (only the colors), and never for people who asked their system for less motion.
     */
    animation?: boolean;
    /** `'pulse'` (the default: it grows a little and back) or `'fade'` (half transparent and back). */
    animationType?: ListenButtonAnimation;
};

/**
 * The frame's events, plus the description's new text (or null) when it is on, and the chapter
 * playing when the player has chapters (null and -1 outside every chapter).
 */
export type PlayerEvents = SonicFrameEvents & {
    /** The sound in words arrived or changed (null while there is none). */
    descriptionchange: [text: string | null];
    /** @deprecated Use `descriptionchange`; `description` goes in 2.0. */
    description: [text: string | null];
    chapterchange: [chapter: Chapter | null, index: number];
    /** A sound resumed where it was left (`remember`), at `time` seconds. */
    resume: [time: number];
};
