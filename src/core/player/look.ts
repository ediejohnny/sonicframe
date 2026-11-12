/**
 * How a player is put together, without the page: which parts sit on its main line and on the small
 * line under the wave, where the wave goes, how the time reads, the button, the sizes (in rem, so a
 * player grows with the page's text) and the finish, and the look every player starts from. Reading a
 * look given from anywhere is `resolveLook`'s (`resolve-look.ts`).
 */

import type { ButtonFill, ButtonShape } from '../controls/button';
import type { ClockDigits, ClockHours, ClockPrecision } from '../shared/clock';
import type { Background } from './background';
import type { BackgroundAnimation } from './background-animation';
import type { FontName } from './fonts';

/**
 * A piece of the player. `wave` takes the free space; `spacer` pushes the next parts to the end; the
 * zoom buttons show only when the player's zoom has `buttons`; the chapter parts (the chapter
 * playing, the previous and next chapter buttons, and the button that opens the list) only when the
 * player has chapters, the last one only with its list.
 */
export type Part =
    | 'play'
    | 'wave'
    | 'time'
    | 'elapsed'
    | 'remaining'
    | 'duration'
    | 'speed'
    | 'back'
    | 'forward'
    | 'volume'
    | 'zoomIn'
    | 'zoomOut'
    | 'zoomReset'
    | 'chapter'
    | 'previousChapter'
    | 'nextChapter'
    | 'chapters'
    | 'slot'
    | 'spacer'
    /** The old name of `previousChapter`, read as it until 2.0. */
    | 'prevChapter';

/** A size in rem, as a look can give the play button's (`'2.5rem'`). */
export type RemSize = `${number}rem`;

export type PlayerLook = {
    /** The parts of the main line, in order. */
    line: Part[];
    /** A small line right under the wave (a voice note's duration, say). */
    meta: Part[];
    /**
     * Short of room, the small line keeps one line (`false`: a chapter's name gives up its room)
     * or breaks in two, the parts after a spacer going together to the far side of the second.
     */
    metaWrap: boolean;
    /** The wave inside the main line, or on its own line above it. */
    wavePlace: 'inline' | 'top';
    /** How the `time` part reads. */
    time: 'elapsed' | 'remaining' | 'duration' | 'both';
    /**
     * Where a time's text sits in the room it keeps (the room of the longest time the sound can
     * show). `auto` keeps to the end after the wave or a spacer in its row, and in the right-hand
     * group under a voice note's wave; to the start everywhere else.
     */
    timeAlign: 'auto' | 'start' | 'center' | 'end';
    /**
     * What the time shows after the seconds: nothing (`'seconds'`), tenths, hundredths, milliseconds
     * (rounded to the nearest), or the frame of a timecode (`'frames'`, at `timeFps`). While the
     * sound plays, the time changes as often as its last digit does, and no more.
     */
    timePrecision: ClockPrecision;
    /** With `'frames'`, the frames in a second, 1 to 120; 29.97 counts 30 frames in each second. */
    timeFps: number;
    /**
     * The hours: from one hour on, but always with a frame, as a timecode writes them (`'auto'`);
     * always (`0:01:05`); or from one hour on, frame or not (`'needed'`).
     */
    timeHours: ClockHours;
    /** The mark before tenths, hundredths and milliseconds: a point, a comma, or the player's language's (`'auto'`). */
    timeDecimal: '.' | ',' | 'auto';
    /**
     * The least digits of the hours and minutes (1 to 4) and of the seconds and the frame (2 to
     * 4): `{ hours: 2, minutes: 2 }` writes `00:01:05`. Minutes under hours keep two digits.
     */
    timeDigits: ClockDigits;
    /**
     * A mask that writes the time its own way, over the precision, hours, digits and decimal mark:
     * `h` the hours, `H` the hours from one hour on, `m` the minutes, `s` the seconds, `S` the
     * decimals, `f` the frame, each repeated for its least digits (up to 4, 3 for `S`); anything
     * else is written as it is, and `[...]` writes letters as text (`'hh[h]mm[m]ss[s]'`). Null, or
     * a mask that cannot be read, leaves the options above.
     */
    timeFormat: string | null;
    /**
     * Where the rows under a wave in the line start (the small line, a voice note's time, a list):
     * at the wave's left edge (`'wave'`, the default) or at the line's, under the play button
     * (`'line'`), so the button and the wave read as one block above them.
     */
    underStart: 'wave' | 'line';
    /**
     * The play button; `size` in CSS pixels (16 to 96), or in rem (`'2.5rem'`, 1 to 6), so the
     * button grows with the page's text.
     */
    button: { shape: ButtonShape; fill: ButtonFill; size: number | RemSize };
    /** Height of the wave, in rem. */
    waveHeight: number;
    /** Height of the minimap strip (when the player has one), in rem. */
    minimapHeight: number;
    /** Space between the wave and the minimap strip, in rem. */
    minimapGap: number;
    /**
     * The least width of a wave that shares its line with zoom buttons, in rem; narrower, the line
     * wraps and the buttons go under it.
     */
    waveMinWidth: number;
    /** @deprecated Use `waveMinWidth`; `waveMin` goes in 2.0. */
    waveMin: number;
    /**
     * The width, in rem, under which a player with the wave in its line turns into a voice note:
     * the play button and the wave keep the line, the time goes under the wave on the left and the
     * other controls under it on the right. 0 keeps one line at any width.
     */
    narrowWidth: number;
    /** @deprecated Use `narrowWidth`; `narrow` goes in 2.0. */
    narrow: number;
    /** In a voice note, the parts that stay on the main line beside the wave. */
    narrowLine: Part[];
    /**
     * In a voice note, the parts that go under the wave on the left; every other part goes under it
     * on the right. Both keep the order of `line`.
     */
    narrowStart: Part[];
    /** In a voice note, the space between the parts under the wave, in rem. */
    narrowGap: number;
    /** Corner radius of the player, in rem. */
    corner: number;
    /** Space inside the player, in rem. */
    padding: number;
    /** Space between parts, in rem. */
    gap: number;
    /** Border width in CSS pixels; 0 draws none. */
    border: number;
    /** No shadow, a soft one, a hard offset one, or a glow in the played color. */
    shadow: 'none' | 'soft' | 'hard' | 'glow';
    /** A solid background, frosted glass, or none (the page shows through). */
    surface: 'solid' | 'glass' | 'none';
    font: FontName;
    /** Text size, in rem. */
    fontSize: number;
    /** Text weight, 100 to 900. */
    fontWeight: number;
    /** @deprecated Use `fontWeight`; `weight` goes in 2.0. */
    weight: number;
    uppercase: boolean;
    /**
     * How a chapter's name too long for its room ends: in an ellipsis, fading out (there is more
     * to read), or cut where the room ends.
     */
    nameOverflow: 'ellipsis' | 'fade' | 'clip';
    /** How wide the fade at a long name's end is, in rem. */
    nameFade: number;
    /**
     * With the fade, a walking name fades at its start too while it is off its start, so its
     * letters leave the room softly; at rest the start stays sharp.
     */
    nameFadeStart: boolean;
    /** A long name shows in full in a tooltip while the mouse is on it. */
    nameTooltip: boolean;
    /**
     * A chapter's name too long for its room walks across it, pauses at its end and starts over;
     * off, it stays still and ends as `nameOverflow` says. Never with reduced motion.
     */
    marquee: boolean;
    /**
     * How a long name goes round: as an endless strip, its copy following it after `marqueeGap`
     * and coming to rest where it started (`'loop'`); back to its start once its end shows
     * (`'restart'`); or walking back (`'bounce'`).
     */
    marqueeType: 'loop' | 'restart' | 'bounce';
    /** In a loop, the space between a name and its copy, in rem. */
    marqueeGap: number;
    /** A walking name stops while the mouse is on it, and goes on when it leaves. */
    marqueePauseOnHover: boolean;
    /** @deprecated Use `marqueePauseOnHover`; `marqueeHoverPause` goes in 2.0. */
    marqueeHoverPause: boolean;
    /** How fast a long name walks, in rem a second. */
    marqueeSpeed: number;
    /** How long a long name waits at each end, in seconds (0 to 10). */
    marqueePauseSeconds: number;
    /** @deprecated Use `marqueePauseSeconds`; `marqueePause` (in milliseconds) goes in 2.0. */
    marqueePause: number;
    /** Seconds moved by the back and forward buttons. */
    skip: number;
    /** The speeds the speed button steps through. */
    speeds: number[];
    /** How the volume slider shows, when the volume part is on: always, or on hover and focus. */
    volumeSlider: 'always' | 'hover';
    /** @deprecated Use `volumeSlider`; `volume` goes in 2.0. */
    volume: 'always' | 'hover';
    /**
     * A background of its own, over the surface: a color, a gradient or an image, with filters,
     * effects and an opacity. None by default; null turns it off, and a partial one changes only
     * what it gives.
     */
    background: Background | null;
    /** How the background moves; off by default (`true` gives the defaults). Never with reduced motion. */
    backgroundAnimation: BackgroundAnimation | boolean | null;
};

export const PART_NAMES: readonly Part[] = Object.freeze([
    'play',
    'wave',
    'time',
    'elapsed',
    'remaining',
    'duration',
    'speed',
    'back',
    'forward',
    'volume',
    'zoomIn',
    'zoomOut',
    'zoomReset',
    'chapter',
    'previousChapter',
    'nextChapter',
    'chapters',
    'slot',
    'spacer',
] as const);

export const DEFAULT_LOOK: Readonly<PlayerLook> = Object.freeze<PlayerLook>({
    line: ['play', 'wave', 'time'],
    meta: [],
    metaWrap: false,
    wavePlace: 'inline',
    time: 'both',
    timeAlign: 'auto',
    timePrecision: 'seconds',
    timeFps: 30,
    timeHours: 'auto',
    timeDecimal: '.',
    timeDigits: { hours: 1, minutes: 1, seconds: 2, frames: 2 },
    timeFormat: null,
    underStart: 'wave',
    button: { shape: 'circle', fill: 'solid', size: 36 },
    waveHeight: 2.5,
    minimapHeight: 1.5,
    minimapGap: 0.375,
    waveMinWidth: 8,
    waveMin: 8,
    narrowWidth: 22,
    narrow: 22,
    narrowLine: ['play', 'wave', 'slot'],
    narrowStart: ['time', 'elapsed', 'remaining', 'duration'],
    narrowGap: 0.5,
    corner: 0.75,
    padding: 0.5,
    gap: 0.625,
    border: 1,
    shadow: 'none',
    surface: 'solid',
    font: 'system',
    fontSize: 0.8125,
    fontWeight: 500,
    weight: 500,
    uppercase: false,
    nameOverflow: 'ellipsis',
    nameFade: 1.5,
    nameFadeStart: true,
    nameTooltip: false,
    marquee: false,
    marqueeType: 'loop',
    marqueeGap: 2.5,
    marqueePauseOnHover: true,
    marqueeHoverPause: true,
    marqueeSpeed: 2,
    marqueePauseSeconds: 1.5,
    marqueePause: 1500,
    skip: 10,
    speeds: [1, 1.5, 2],
    volumeSlider: 'hover',
    volume: 'hover',
    background: null,
    backgroundAnimation: null,
});
