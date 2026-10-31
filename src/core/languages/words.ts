/**
 * Everything SonicFrame says, in the shape every language file fills in: one group for each piece
 * that speaks, so each phrase is written once, and a piece built of others (the player) borrows
 * their words. `{name}` marks are filled in with SonicFrame's own values.
 */

/** What the player says. `{name}` marks are filled in. */
export type PlayerLabels = {
    /** The player as a whole (a group). */
    player: string;
    /** The wave, a slider. */
    position: string;
    /** The slider's value: `{time}`, `{duration}`. */
    value: string;
    play: string;
    pause: string;
    /** `{seconds}`. */
    back: string;
    /** `{seconds}`. */
    forward: string;
    /** `{speed}`, as in `1.5×`. */
    speed: string;
    mute: string;
    unmute: string;
    volume: string;
    /** The button that reads the description with the browser's voice. */
    listen: string;
    /** The same button while the voice reads. */
    stopListening: string;
    /** Said when the browser cannot read the description aloud (no voice for the language, say). */
    speechFailed: string;
    zoomIn: string;
    zoomOut: string;
    /** The button back to the whole sound. */
    zoomReset: string;
    /** A new view, said after a zoom: `{level}`, `{from}`, `{to}`. */
    zoomView: string;
    /** The minimap as a slider. */
    minimap: string;
    /** The minimap's value: `{from}`, `{to}`, `{total}`. */
    minimapValue: string;
    /** A chapter's place: `{index}`, `{count}`; its title follows after a colon. */
    chapter: string;
    /** The list of chapters, and the button that opens it. */
    chapters: string;
    /** Said when a step finds no chapter that way. */
    noChapter: string;
    /** The text of a chapter's link in the list. */
    chapterLink: string;
    previousChapter: string;
    nextChapter: string;
    /** The button that closes the chapters drawer. */
    closeChapters: string;
};

/** The phrases of a description. `{name}` marks are filled in; a mark that is not known is dropped. */
export type DescriptionWords = {
    /** The length, as a sentence: `{duration}`. */
    length: string;
    /** A sound that is only silence: `{duration}`. */
    silence: string;
    /** One part from start to end. */
    continuous: string;
    /** The steps of a short sound: silence first, `{duration}`. */
    silenceFor: string;
    /** The first step with sound: `{at}`. */
    soundUntil: string;
    /** A pause between two parts: `{duration}`. */
    pause: string;
    /** A later part: `{at}`. */
    thenSoundUntil: string;
    /** The last part, running to the end. */
    thenSoundToEnd: string;
    /** The silence after the last part. */
    thenSilenceToEnd: string;
    /** Many pauses, summed up by the longest: `{count}`, `{duration}`, `{at}`. */
    pauses: string;
    /** With many pauses, the silence at the start: `{duration}`. */
    startsAfter: string;
    /** With many pauses, the silence at the end: `{duration}`. */
    endsWith: string;
    even: string;
    rises: string;
    falls: string;
    /** `{at}`. */
    loudest: string;
    /** The loudest stretch, within the first second. */
    loudestStart: string;
    /** Where a step between the parts landed: `{part}`, `{count}`, `{at}`. */
    part: string;
    /** A step that landed within the first second: `{part}`, `{count}`. */
    partStart: string;
    /** No part left in that direction. */
    noPart: string;
    /** Added to the slider's value inside a pause between two parts. */
    pauseNote: string;
    /** Added to the slider's value inside the silence at the start or at the end. */
    silenceNote: string;
    /** The mark between the steps of one sentence (a space follows it). */
    join: string;
    /** The end of a sentence made of steps. */
    stop: string;
};

/** What the chapters plugin says. `{name}` marks are filled in. */
export type ChapterWords = {
    /** A chapter's place: `{index}`, `{count}` ("Chapter 3 of 8"); its title follows after a colon. */
    chapter: string;
    /** The name of the list. */
    list: string;
    /** Said when C or Shift+C finds no chapter that way. */
    none: string;
    /** The text of a chapter's link in the list. */
    link: string;
};

/** The player's labels that the pieces it is built of bring. */
type Borrowed =
    | 'play'
    | 'pause'
    | 'mute'
    | 'unmute'
    | 'volume'
    | 'zoomView'
    | 'minimap'
    | 'minimapValue'
    | 'chapter'
    | 'chapters'
    | 'noChapter'
    | 'chapterLink';

/** Every word of SonicFrame in one language. */
export type Words = {
    /** A wave on its own (`SonicFrame`). */
    frame: {
        /** Its accessible name, as a slider of the playback position. */
        position: string;
    };
    /** A `PlayButton`: its name while paused, and while playing. */
    playButton: {
        play: string;
        pause: string;
    };
    /** A `VolumeControl`. */
    volume: {
        mute: string;
        unmute: string;
        /** The slider's name. */
        volume: string;
        /** The slider's value while muted; a level is otherwise a percentage. */
        muted: string;
    };
    zoom: {
        /** A new view, said after a zoom: `{level}`, `{from}`, `{to}`. */
        view: string;
    };
    /** The minimap as a slider of the part in view. */
    minimap: {
        /** Its accessible name. */
        label: string;
        /** Its value: `{from}`, `{to}`, `{total}`. */
        value: string;
    };
    chapters: ChapterWords;
    regions: {
        /** Where a region is, said when R selects it (after its label): `{from}`, `{to}`. */
        place: string;
        /** Said when L turns the loop on. */
        loopOn: string;
        /** Said when L turns the loop off. */
        loopOff: string;
    };
    description: DescriptionWords;
    /** The ready-made player's own words; it borrows the rest of its labels from the pieces above. */
    player: Omit<PlayerLabels, Borrowed>;
};
