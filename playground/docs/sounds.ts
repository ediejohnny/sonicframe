/**
 * The sounds the docs site plays, each with its ready-made peaks file (an audiowaveform `.dat`, made
 * by `_peaks.html` on the dev server) and its credit. The pages read the peaks, never the audio, until
 * someone presses play.
 */

export type SiteSound = {
    id: string;
    /** The audio file, from `playground/`. */
    audio: string;
    /** Its peaks file, from `playground/`. */
    peaks: string;
    /** Peaks per second of sound kept in the file (more for the voice, which the zoom page explores). */
    perSecond: number;
    title: string;
    artist: string;
};

export const POEM: SiteSound = {
    id: 'little-elf',
    audio: 'sounds/little-elf.mp3',
    peaks: 'sounds/little-elf.dat',
    perSecond: 100,
    title: '“The Little Elf”',
    artist: 'read by Avery',
};

/** The home page's music: one is drawn at random on each visit, then all three play in turn. */
export const MUSIC: readonly SiteSound[] = [
    {
        id: 'chill-lofi-inspired',
        audio: 'sounds/music/chill-lofi-inspired.mp3',
        peaks: 'sounds/music/chill-lofi-inspired.dat',
        perSecond: 40,
        title: '“Chill lofi inspired”',
        artist: 'omfgdude',
    },
    {
        id: 'november-snow',
        audio: 'sounds/music/november-snow.mp3',
        peaks: 'sounds/music/november-snow.dat',
        perSecond: 40,
        title: '“November Snow”',
        artist: 'cynicmusic',
    },
    {
        id: 'glory-hotel',
        audio: 'sounds/music/glory-hotel.mp3',
        peaks: 'sounds/music/glory-hotel.dat',
        perSecond: 40,
        title: '“Glory Hotel (lofi)”',
        artist: 'migfus20',
    },
];

export const SOUNDS: readonly SiteSound[] = [POEM, ...MUSIC];
