/**
 * A ready-made player: a play button, the wave and the time, plus any of speed, skip, volume and a
 * slot for the app's own element (an avatar, say), laid out by a look and colored by a palette. The
 * palette reaches every part through `--sonicframe-*` custom properties set on the player, so plain
 * CSS can still override one color; sizes are in rem. Shadows and the glass surface are built only
 * from colors read back as numbers, never from a raw page value. Given only a sound address, the
 * player makes its own media element and decodes the peaks when it first comes near the screen. Its
 * words are English unless the app picks another language or its own labels; the description of the
 * sound in words, the zoom (with its buttons) and the minimap are off until the app asks for them.
 */

import { hideFocusRing, showFocusRing } from '../controls/focus';
import { PlayButton } from '../controls/play-button';
import { VolumeControl } from '../controls/volume';
import { rgbaString, type Rgba } from '../core/color';
import { Emitter } from '../core/emitter';
import { resolveFont, type FontChoice } from '../core/fonts';
import {
    playerWords,
    type PlayerLabels,
    type PlayerWords,
} from '../core/labels';
import {
    DEFAULT_LOOK,
    nextSpeed,
    speedText,
    timeText,
    type Part,
    type PlayerLook,
} from '../core/look';
import {
    DEFAULT_PALETTE,
    PALETTES,
    paletteVariables,
    pickPalette,
    type Palette,
    type PaletteChoice,
} from '../core/palettes';
import { peaksFromChannel } from '../core/peaks';
import { DEFAULT_WAVE, resolveWave } from '../core/shapes';
import { cleanText } from '../core/text';
import { resolveZoom, type ZoomOptions } from '../core/zoom';
import {
    defineTheme,
    findTheme,
    themeParts,
    type Theme,
    type ThemeInput,
} from '../core/theme';
import type {
    BarStyle,
    PeaksSource,
    Plugin,
    SonicFrameEvents,
    WaveName,
    WaveStyle,
} from '../types';
import { decodeAudio } from '../dom/decode';
import { loadFont } from '../dom/fonts';
import { prefersReducedMotion } from '../dom/motion';
import { pageLanguage } from '../dom/page-language';
import { observeSize } from '../dom/observe';
import { canSpeak } from '../dom/speak';
import {
    soundDescription,
    type SoundDescriptionOptions,
    type SoundDescriptionPlugin,
} from '../plugins/description';
import {
    spectrogram,
    type ColorStops,
    type DecodedAudio,
} from '../plugins/spectrogram';
import { minimap, minimapSize, type MinimapOptions } from '../plugins/minimap';
import { SonicFrame, type SonicFrameOptions } from '../dom/frame';
import { readColor } from '../dom/paint';

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
    theme?: string | ThemeInput;
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
    /** How a sound is decoded for its peaks, when none are given. */
    decode?: PlayerDecode;
    /** Your own element for the `slot` part (an avatar, say); it is given back on destroy. */
    slot?: HTMLElement | null;
    /** The player's accessible name (over the `player` label). */
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

/** The player's accessibility options, grouped by place; everything that adds behaviour is off by default. */
export type PlayerA11y = {
    /**
     * The language of the accessible names, the wave's value in words and the description: `'en'` (the
     * default), `'pt'`, or `'auto'` (the page's language). Given, it also marks the player with it.
     */
    lang?: string;
    /** Your own accessible names and words, over the language's. */
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
};

/** The player's zoom: the wave's zoom options, plus its buttons. */
export type PlayerZoom = ZoomOptions & {
    /** The zoom in, zoom out and whole-sound buttons. Off by default. */
    buttons?: boolean;
};

/** How the player decodes a sound for its peaks. */
export type PlayerDecode = {
    /** How many peaks: 1000, from 100 to 100 000. */
    peaks?: number;
    /**
     * With zoom on, peaks per second of sound, so zooming in shows detail: 100, from 1 to 1000. The
     * count never falls below `peaks`, nor rises past 1 000 000.
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
export type ButtonAnimation = 'pulse' | 'fade';

/** The button that reads the description aloud. */
export type PlayerListenButton = {
    /**
     * While it reads, the button wears the play button's colors, so people who see it know it is
     * reading and can be pressed to stop; `animation: true` also moves it, as `animationType` says. Off
     * by default (only the colors), and never for people who asked their system for less motion.
     */
    animation?: boolean;
    /** `'pulse'` (the default: it grows a little and back) or `'fade'` (half transparent and back). */
    animationType?: ButtonAnimation;
};

/** One beat of the reading button's animation, in milliseconds (there, then back). */
const BEAT_MS = 700;

/** The keyframes of each animation of the reading button. */
const BUTTON_ANIMATIONS: Readonly<Record<ButtonAnimation, Keyframe[]>> = {
    pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }],
    fade: [{ opacity: 1 }, { opacity: 0.5 }],
};

/** The animation the button asks for: none unless it is on; the pulse unless a known type is named. */
function animationOf(settings: PlayerListenButton): ButtonAnimation | null {
    if (settings.animation !== true) {
        return null;
    }

    const type: unknown = settings.animationType;

    return type === 'fade' ? 'fade' : 'pulse';
}

/** How many peaks are decoded from a sound, unless the app says otherwise. */
const PEAKS = 1000;

/** Peaks per second of sound decoded with zoom on, unless the app says otherwise. */
const PEAKS_PER_SECOND = 100;

/** The most peaks decoded from one sound. */
const MAX_DECODED_PEAKS = 1_000_000;

/** The zoom buttons: their class name and icon (on the 24 × 24 grid of the play icon). */
const ZOOM_BUTTONS = {
    zoomIn: { name: 'zoom-in', icon: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z' },
    zoomOut: { name: 'zoom-out', icon: 'M5 11h14v2H5z' },
    zoomReset: {
        name: 'zoom-reset',
        icon: 'M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
    },
} as const;

/** The zoom buttons the player adds at the end of the line when the look places none. */
const ZOOM_PARTS: readonly Part[] = ['zoomOut', 'zoomReset', 'zoomIn'];

/** A whole number from `min` to `max`; anything that is not a finite number is `fallback`. */
function count(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, Math.round(value)))
        : fallback;
}

/** CSS pixels in `rem` of the page's root text size. */
function remPixels(rem: number): number {
    const root = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
    );

    return rem * (root > 0 ? root : 16);
}

/**
 * Where a piece of the main line goes in a narrow player: it stays on the line (the wave, and what
 * 
arrowLine names), goes under the wave on the left (what 
arrowStart names) or on the right
 * (everything else), or is left out (the look's spacers).
 */
type Place = 'line' | 'start' | 'end' | 'spacer';

function placeOf(part: Part, look: PlayerLook): Place {
    if (part === 'wave' || look.narrowLine.includes(part)) {
        return 'line';
    }

    if (part === 'spacer') {
        return 'spacer';
    }

    return look.narrowStart.includes(part) ? 'start' : 'end';
}

/** The built main line, kept so a narrow player can move its pieces without building again. */
type Layout = {
    line: HTMLElement;
    box: HTMLElement;
    pieces: { place: Place; nodes: ChildNode[] }[];
    under: HTMLElement | null;
    narrow: boolean;
};

/** The longest a palette color may be. */
const MAX_COLOR = 64;

/** The spectrogram's colors: from the player's surface, through the wave, to the played color. */
const SPECTRUM: ColorStops = {
    from: 'var(--sonicframe-surface, #ffffff)',
    via: 'var(--sonicframe-wave, #c4cad4)',
    to: 'var(--sonicframe-progress, #2f6fdb)',
};

/** The knob takes its own variable, so it can differ from the played color. */
const KNOB = 'var(--sonicframe-knob, var(--sonicframe-progress, #2f6fdb))';

/** The play button's colors, which the reading button wears while it reads. */
const BUTTON_FILL =
    'var(--sonicframe-button, var(--sonicframe-progress, #2f6fdb))';
const BUTTON_ICON = 'var(--sonicframe-button-icon, #fff)';

const SVG = 'http://www.w3.org/2000/svg';

/** Back and forward: two triangles each, on the 24 × 24 grid of the play icon. */
const SKIP_ICONS = {
    back: 'M11.5 6v12L3.5 12zM20.5 6v12l-8-6z',
    forward: 'M3.5 6v12l8-6zM12.5 6v12l8-6z',
} as const;

/** A speech bubble, for the button that reads the description aloud. */
const LISTEN_ICON =
    'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z';

/** Every frame event but `destroy`, which belongs to the player itself. */
const FORWARDED = [
    'seek',
    'hover',
    'timeupdate',
    'durationchange',
    'peakschange',
    'resize',
    'rangeend',
    'viewchange',
    'error',
] as const;

/** The frame's events, plus the description's new text (or null) when it is on. */
export type PlayerEvents = SonicFrameEvents & {
    description: [text: string | null];
};

function css(
    element: HTMLElement | SVGElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}

/** Names a button for screen readers, with the same words as a tooltip. */
function nameButton(button: HTMLButtonElement, label: string): void {
    button.setAttribute('aria-label', label);
    button.title = label;
}

function withAlpha(color: Rgba | null, alpha: number): string {
    const [red, green, blue] = color ?? [0, 0, 0, 1];

    return rgbaString([red, green, blue, alpha]);
}

/** Your own palette, each color cleaned and capped; a missing one comes from the light palette. */
function cleanPalette(colors: Palette): Palette {
    const base: Palette = PALETTES.light;
    const clean = { ...base };

    for (const key of Object.keys(base) as (keyof Palette)[]) {
        const value: unknown = colors[key];

        if (typeof value === 'string' && value.trim() !== '') {
            clean[key] = cleanText(value, MAX_COLOR);
        }
    }

    return clean;
}

export class Player {
    /** The player's root element. */
    readonly element: HTMLDivElement;
    /** The media it plays: yours, or the one it made from `src`. */
    readonly media: HTMLMediaElement | null;
    private readonly ownMedia: boolean;
    private readonly options: PlayerOptions;
    private readonly events = new Emitter<PlayerEvents>();
    private readonly abort = new AbortController();
    /** The player's own choices, at creation or through a setter: they always win over the theme. */
    private readonly own: {
        look?: Partial<PlayerLook>;
        palette?: PaletteChoice;
        wave?: WaveName | Partial<WaveStyle>;
        bar?: Partial<BarStyle>;
    };
    private theme: Theme | null = null;
    private showVolume: boolean;
    private look: PlayerLook = DEFAULT_LOOK;
    private palette: PaletteChoice = 'default';
    private colors: Palette = DEFAULT_PALETTE;
    private wave: Partial<WaveStyle> = {};
    private bar: Partial<BarStyle> = {};
    private font: FontChoice | undefined;
    private frameRef: SonicFrame | null = null;
    private buttonRef: PlayButton | null = null;
    private volumeRef: VolumeControl | null = null;
    private descriptionRef: SoundDescriptionPlugin | null = null;
    private readonly words: PlayerWords;
    private times: [HTMLElement, PlayerLook['time']][] = [];
    private partCleanups: (() => void)[] = [];
    private layout: Layout | null = null;
    /** The player's width in CSS pixels, once measured. */
    private width: number | null = null;
    private readonly stopSize: () => void;
    private peaks: readonly number[] | null = null;
    private decoding: Promise<DecodedAudio> | null = null;
    private stopScheme: (() => void) | null = null;
    private destroyed = false;

    constructor(options: PlayerOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.options = options;
        this.own = {
            look: options.look,
            palette: options.palette,
            wave: options.wave,
            bar: options.bar,
        };
        this.showVolume = options.volume === true;
        this.theme = this.pickTheme(options.theme);
        this.combine();
        this.font = options.font;
        const a11y = options.a11y ?? {};
        this.words = playerWords(
            a11y.lang === 'auto' ? pageLanguage(options.container) : a11y.lang,
            a11y.labels,
        );

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-player';
        this.element.setAttribute('role', 'group');
        this.element.setAttribute(
            'aria-label',
            cleanText(options.label ?? this.words.labels.player, 120),
        );

        // A language the app chose marks the player, so a screen reader says its words in that voice.
        if (a11y.lang !== undefined) {
            this.element.setAttribute('lang', this.words.locale);
        }

        this.ownMedia = !options.media && typeof options.src === 'string';
        this.media = options.media ?? (this.ownMedia ? this.makeMedia() : null);

        if (this.ownMedia && this.media !== null) {
            this.element.append(this.media);
        }

        options.container.append(this.element);
        this.build();
        this.applyPalette();
        this.applyFont();
        this.stopSize = observeSize(this.element, (size) => {
            this.width = size.width / size.pixelRatio;
            this.arrange();
        });
    }

    /** The wave (a `SonicFrame`). */
    get frame(): SonicFrame {
        return this.frameRef as SonicFrame;
    }

    /** The play button, or null when the look has none. */
    get button(): PlayButton | null {
        return this.buttonRef;
    }

    /** The volume control, or null when it is off. */
    get volume(): VolumeControl | null {
        return this.volumeRef;
    }

    /** The sound in words, or null while it is off or not known yet. */
    get description(): string | null {
        return this.descriptionRef?.text ?? null;
    }

    /** Listens to the wave's events; returns the function that stops listening. */
    on<Name extends keyof PlayerEvents>(
        event: Name,
        listener: (...args: PlayerEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /**
     * Switches to another theme (a name, or one made with `defineTheme`). The player's own choices
     * (at creation or through the setters below) still win over it.
     */
    setTheme(theme: string | ThemeInput): void {
        if (!this.destroyed) {
            this.theme = this.pickTheme(theme);
            this.combine();
            this.build();
            this.applyPalette();
            this.applyFont();
        }
    }

    /** Changes how the player is put together (and rebuilds it). */
    setLook(look: Partial<PlayerLook>): void {
        if (!this.destroyed) {
            this.own.look = { ...this.own.look, ...look };
            this.combine();
            this.build();
        }
    }

    /** Changes the colors; with no palette, the theme's comes back. */
    setPalette(palette?: PaletteChoice): void {
        if (!this.destroyed) {
            this.own.palette = palette;
            this.combine();
            this.applyPalette();
        }
    }

    /** Changes how the sound is drawn; with no drawing, the theme's comes back. */
    setWave(wave?: WaveName | Partial<WaveStyle>): void {
        if (this.destroyed) {
            return;
        }

        const current =
            typeof this.own.wave === 'string'
                ? { style: this.own.wave }
                : this.own.wave;
        this.own.wave =
            wave === undefined
                ? undefined
                : typeof wave === 'string'
                  ? { ...current, style: wave }
                  : { ...current, ...wave };
        this.combine();
        this.frameRef?.setWave({ ...DEFAULT_WAVE, ...this.wave });
    }

    /** Changes the font; with no font, the look's comes back. */
    setFont(font?: FontChoice): void {
        if (!this.destroyed) {
            this.font = font;
            this.applyFont();
        }
    }

    /** Shows or hides the volume control. */
    setVolume(show: boolean): void {
        if (!this.destroyed && show !== this.showVolume) {
            this.showVolume = show;
            this.build();
        }
    }

    /** Removes the player; a media element it made is stopped, yours is left alone. Safe to call twice. */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.abort.abort();
        this.stopScheme?.();
        this.stopSize();
        this.teardown();

        if (this.ownMedia && this.media !== null) {
            this.media.pause();
            this.media.removeAttribute('src');
        }

        this.element.remove();
        this.events.emit('destroy');
        this.events.clear();
    }

    /** A theme by name or definition; an unknown name gives none, and is reported once listeners can hear it. */
    private pickTheme(choice: string | ThemeInput | undefined): Theme | null {
        if (choice === undefined) {
            return null;
        }

        if (typeof choice !== 'string') {
            return defineTheme(choice);
        }

        const theme = findTheme(choice);

        if (theme === null) {
            this.later(
                new Error(
                    `sonicframe: unknown theme "${cleanText(choice, 40)}"`,
                ),
            );
        }

        return theme;
    }

    /** The theme under the player's own choices. */
    private combine(): void {
        const parts = themeParts(this.theme, this.own);

        this.look = parts.look;
        this.palette = parts.palette;
        this.wave = parts.wave;
        this.bar = parts.bar;
    }

    /** Reports an error after the current task, so a listener added right after creation hears it. */
    private later(error: Error): void {
        queueMicrotask(() => {
            if (!this.destroyed) {
                this.frameRef?.reportError(error);
            }
        });
    }

    private makeMedia(): HTMLMediaElement {
        const audio = document.createElement('audio');
        const preload = this.options.preload;
        audio.preload =
            preload === 'none' || preload === 'auto' ? preload : 'metadata';
        audio.setAttribute('src', this.options.src ?? '');

        return audio;
    }

    /** Whether the zoom buttons are on (zoom on, with `buttons`). */
    private zoomButtons(): boolean {
        const zoom = this.options.zoom;

        return typeof zoom === 'object' && zoom.buttons === true;
    }

    /** A part the options allow: the volume and the zoom buttons only when they are on. */
    private allowed(part: Part): boolean {
        if (part === 'volume') {
            return this.showVolume;
        }

        return ZOOM_PARTS.includes(part) ? this.zoomButtons() : true;
    }

    /**
     * The parts the options allow: placed by the look, or at the end of the line (the volume, then
     * the zoom buttons) when the look places none of them.
     */
    private visibleLine(): Part[] {
        const { line, meta } = this.look;
        const placed = (part: Part): boolean =>
            line.includes(part) || meta.includes(part);
        const extra: Part[] = [];

        if (this.showVolume && !placed('volume')) {
            extra.push('volume');
        }

        if (this.zoomButtons() && !ZOOM_PARTS.some(placed)) {
            extra.push(...ZOOM_PARTS);
        }

        return [...line.filter((part) => this.allowed(part)), ...extra];
    }

    /** Whether a zoom button shares the main line with a wave beside it. */
    private zoomOnLine(): boolean {
        const line = this.visibleLine();

        return (
            this.look.wavePlace !== 'top' &&
            line.includes('wave') &&
            ZOOM_PARTS.some((part) => line.includes(part))
        );
    }

    private visibleMeta(): Part[] {
        return this.look.meta.filter((part) => this.allowed(part));
    }

    private peaksSource(): PeaksSource {
        if (this.options.peaks !== undefined) {
            const frame = this.frameRef;

            // A new build keeps what the old frame already has, with the duration it came with.
            return frame?.peaks
                ? { peaks: frame.peaks, duration: frame.peaksDuration }
                : this.options.peaks;
        }

        if (this.peaks !== null) {
            return this.peaks;
        }

        const media = this.media;
        const track = resolveWave(DEFAULT_WAVE, this.wave).style === 'track';

        if (media === null || track) {
            return null;
        }

        return async () => {
            const { samples, duration } = await this.decoded();
            this.peaks = peaksFromChannel(samples, this.peakCount(duration));

            return this.peaks;
        };
    }

    /** How many peaks to decode: `decode.peaks`, or per second of sound with zoom on (never fewer). */
    private peakCount(duration: number | undefined): number {
        const decode = this.options.decode ?? {};
        const base = count(decode.peaks, PEAKS, 100, 100_000);

        if (!this.options.zoom || duration === undefined || !(duration > 0)) {
            return base;
        }

        const perSecond = count(
            decode.peaksPerSecond,
            PEAKS_PER_SECOND,
            1,
            1000,
        );

        return Math.min(
            MAX_DECODED_PEAKS,
            Math.max(base, Math.round(duration * perSecond)),
        );
    }

    /**
     * The sound decoded once, shared by the peaks and the spectrogram. A failure is kept too, so both
     * hear the same one instead of downloading again.
     */
    private decoded(): Promise<DecodedAudio> {
        if (this.decoding === null) {
            const media = this.media;
            const address =
                this.options.src ??
                (media ? media.currentSrc || media.src : '');

            this.decoding = address
                ? decodeAudio(address, {
                      signal: this.abort.signal,
                      maxSeconds: this.options.decode?.maxSeconds,
                      maxBytes: this.options.decode?.maxBytes,
                  })
                : Promise.reject(
                      new Error('sonicframe: no sound to read peaks from'),
                  );
        }

        return this.decoding;
    }

    /** The description's settings, or null while it is off. */
    private descriptionSettings(): PlayerDescription | null {
        const asked = this.options.a11y?.description;

        if (!asked) {
            return null;
        }

        return asked === true ? {} : asked;
    }

    /** The reading button's settings, or null while there is none. */
    private listenButton(): PlayerListenButton | null {
        const button = this.descriptionSettings()?.button;

        if (!button) {
            return null;
        }

        return button === true ? {} : button;
    }

    /**
     * The app's plugins, with a spectrogram in the palette's colors first and the description last,
     * each only when asked.
     */
    private plugins(): Plugin[] {
        const plugins = [...(this.options.plugins ?? [])];

        if (this.options.spectrogram && this.media !== null) {
            plugins.unshift(
                spectrogram({ source: () => this.decoded(), map: SPECTRUM }),
            );
        }

        const own = this.minimapOptions();

        if (own !== null) {
            const words = this.words;
            plugins.push(
                minimap({
                    ...own,
                    a11y: {
                        label: words.labels.minimap,
                        words: {
                            value: (from, to, total) =>
                                words.say('minimapValue', { from, to, total }),
                        },
                        ...own.a11y,
                        keys:
                            this.options.a11y?.minimap?.keys ?? own.a11y?.keys,
                    },
                }),
            );
        }

        const settings = this.descriptionSettings();

        if (settings !== null) {
            const description = soundDescription({
                ...settings,
                lang: settings.lang ?? this.options.a11y?.lang,
                // The button reads aloud, so asking for it asks for the voice.
                speech: settings.speech ?? this.listenButton() !== null,
                onChange: (text) => {
                    settings.onChange?.(text);
                    this.events.emit('description', text);
                },
            });
            this.descriptionRef = description;
            plugins.push(description);
        }

        return plugins;
    }

    /** The minimap's options: the look's height and space, then the app's own. */
    private minimapOptions(): MinimapOptions | null {
        const strip = this.options.minimap;

        if (!strip) {
            return null;
        }

        return {
            height: remPixels(this.look.minimapHeight),
            gap: remPixels(this.look.minimapGap),
            ...(strip === true ? {} : strip),
        };
    }

    /**
     * The wave box's height: the wave, plus the minimap's room so the strip never takes from the
     * wave. A strip that hides itself at the whole sound adds none: it takes from the wave while it
     * shows.
     */
    private boxHeight(): string {
        const strip = this.minimapOptions();
        const wave = `${this.look.waveHeight}rem`;

        if (strip === null || strip.autoHide === true) {
            return wave;
        }

        const { height, gap } = minimapSize(strip);

        return `calc(${wave} + ${height + gap}px)`;
    }

    private build(): void {
        const peaks = this.peaksSource();
        this.teardown();

        const look = this.look;
        const roomy = this.zoomOnLine();
        const column = document.createElement('div');
        const box = document.createElement('div');
        column.append(box);
        css(column, [
            ['display', 'flex'],
            ['flex-direction', 'column'],
            ['gap', '0.25rem'],
            ['flex', '1 1 auto'],
            ['min-width', roomy ? `${look.waveMin}rem` : '0'],
        ]);
        css(box, [
            ['position', 'relative'],
            ['height', this.boxHeight()],
            ['min-width', '0'],
        ]);

        const words = this.words;
        const frameA11y = this.options.frame?.a11y;
        const frame = new SonicFrame({
            label: this.words.labels.position,
            valueText: this.words.valueText,
            ...this.options.frame,
            zoom: this.options.zoom ?? this.options.frame?.zoom,
            a11y: {
                ...frameA11y,
                zoom: {
                    ...frameA11y?.zoom,
                    announce:
                        this.options.a11y?.zoom?.announce ??
                        frameA11y?.zoom?.announce,
                    words: {
                        view: (level, from, to) =>
                            words.say('zoomView', {
                                level: words.number(level),
                                from,
                                to,
                            }),
                        ...frameA11y?.zoom?.words,
                    },
                },
            },
            container: box,
            media: this.media,
            peaks,
            duration: this.options.duration ?? null,
            wave: this.wave,
            bar: this.bar,
            plugins: this.plugins(),
            colors: { knob: KNOB, ...this.options.frame?.colors },
        });
        this.frameRef = frame;

        for (const name of FORWARDED) {
            this.partCleanups.push(
                frame.on(name, (...args: unknown[]) =>
                    this.events.emit(
                        name,
                        ...(args as PlayerEvents[typeof name]),
                    ),
                ),
            );
        }

        // Beside an inline wave the wave gives up the room; controls on their own line wrap instead
        // of spilling out of a narrow player. With zoom buttons on the line, the wave keeps its
        // least width and the line wraps, so the buttons go under it rather than crush it.
        const line = document.createElement('div');
        const wrap = look.wavePlace === 'top' || roomy ? 'wrap' : 'nowrap';
        css(line, [
            ['display', 'flex'],
            ['flex-wrap', wrap],
            ['align-items', 'center'],
            ['gap', `${look.gap}rem`],
            ['min-width', '0'],
        ]);

        if (look.wavePlace === 'top') {
            this.element.prepend(column, line);
        } else {
            this.element.prepend(line);
        }

        const pieces: Layout['pieces'] = [];

        for (const part of this.visibleLine()) {
            const before = line.childNodes.length;
            this.addPart(part, line, column);
            pieces.push({
                place: placeOf(part, look),
                nodes: [...line.childNodes].slice(before),
            });
        }

        const listen = this.listenButton();

        if (listen !== null && canSpeak()) {
            const node = this.listenPart(listen);
            line.append(node);
            pieces.push({ place: 'end', nodes: [node] });
        }

        this.layout = { line, box, pieces, under: null, narrow: false };
        this.element.removeAttribute('data-narrow');

        const meta = this.visibleMeta();

        if (meta.length > 0) {
            const row = document.createElement('div');
            css(row, [
                ['display', 'flex'],
                ['align-items', 'center'],
                ['gap', '0.5rem'],
                ['font-size', '0.85em'],
                ['color', 'var(--sonicframe-muted, currentColor)'],
            ]);
            column.append(row);

            for (const part of meta) {
                this.addPart(part, row, column);
            }
        }

        const sync = (): void => this.showTime();
        this.partCleanups.push(
            frame.on('timeupdate', sync),
            frame.on('durationchange', sync),
            frame.on('seek', sync),
        );
        this.showTime();
        this.finish();
        this.arrange();
    }

    /**
     * A narrow player (under the look's `narrow` width, with the wave in its line) turns into a voice
     * note: the wave and the parts `narrowLine` names keep the line, the parts `narrowStart` names go
     * under the wave on the left and every other part under it on the right. The pieces built are
     * moved, never built again, so the wave and its state stay; a moved control that had the focus
     * gets it back.
     */
    private arrange(): void {
        const layout = this.layout;

        if (layout === null) {
            return;
        }

        const { narrow: width, wavePlace } = this.look;
        const narrow =
            wavePlace === 'inline' &&
            width > 0 &&
            this.width !== null &&
            this.width < remPixels(width);

        if (narrow === layout.narrow) {
            return;
        }

        const focused = document.activeElement;
        layout.narrow = narrow;
        this.element.toggleAttribute('data-narrow', narrow);

        if (narrow) {
            // The controls keep to the right of the time and take the room left there; only the ones
            // that do not fit wrap, and the whole group goes under the time when not even one fits.
            const gap = `${this.look.narrowGap}rem`;
            const under = document.createElement('div');
            const controls = document.createElement('div');
            under.className = 'sonicframe-under';
            controls.className = 'sonicframe-under-controls';
            css(under, [
                ['display', 'flex'],
                ['flex-wrap', 'wrap'],
                ['align-items', 'center'],
                ['gap', gap],
                ['min-width', '0'],
            ]);
            css(controls, [
                ['display', 'flex'],
                ['flex-wrap', 'wrap'],
                ['justify-content', 'flex-end'],
                ['align-items', 'center'],
                ['gap', gap],
                ['flex', '1 1 0px'],
                ['min-width', 'min-content'],
            ]);
            const nodes = (place: Place): ChildNode[] =>
                layout.pieces
                    .filter((piece) => piece.place === place)
                    .flatMap((piece) => piece.nodes);

            for (const node of nodes('spacer')) {
                node.remove();
            }

            controls.append(...nodes('end'));
            under.append(...nodes('start'), controls);
            layout.box.after(under);
            layout.under = under;
        } else {
            layout.under?.remove();
            layout.under = null;
            // The pieces that stayed keep their order; each moved one goes back after the piece before it.
            let previous: ChildNode | null = null;

            for (const { place, nodes } of layout.pieces) {
                for (const node of nodes) {
                    if (place !== 'line') {
                        if (previous === null) {
                            layout.line.prepend(node);
                        } else {
                            previous.after(node);
                        }
                    }

                    previous = node;
                }
            }
        }

        this.placeVoiceNote(layout, narrow);

        if (
            focused instanceof HTMLElement &&
            focused !== document.activeElement &&
            this.element.contains(focused)
        ) {
            focused.focus({ preventScroll: true });
        }
    }

    /**
     * The voice note's line is a grid: its first row holds the line's parts and the wave, each one
     * centered on the wave, and the rows under the wave keep to the wave's column. Outside the voice
     * note the line is the flexible row it was built as.
     */
    private placeVoiceNote(layout: Layout, narrow: boolean): void {
        const { line, box } = layout;
        const column = box.parentElement as HTMLElement;
        const parts = [...line.children] as HTMLElement[];
        const below = [...column.children].filter(
            (row) => row !== box,
        ) as HTMLElement[];
        const placed = [...parts, box, ...below];

        if (!narrow) {
            css(line, [
                ['display', 'flex'],
                ['gap', `${this.look.gap}rem`],
            ]);
            css(column, [['display', 'flex']]);
            line.style.removeProperty('grid-template-columns');

            for (const element of placed) {
                element.style.removeProperty('grid-row');
                element.style.removeProperty('grid-column');
            }

            return;
        }

        const wave = `${parts.indexOf(column) + 1}`;
        css(line, [
            ['display', 'grid'],
            [
                'grid-template-columns',
                parts
                    .map((part) =>
                        part === column ? 'minmax(0, 1fr)' : 'auto',
                    )
                    .join(' '),
            ],
            ['column-gap', `${this.look.gap}rem`],
            ['row-gap', '0.25rem'],
        ]);
        css(column, [['display', 'contents']]);
        parts.forEach((part, index) => {
            if (part !== column) {
                css(part, [
                    ['grid-row', '1'],
                    ['grid-column', `${index + 1}`],
                ]);
            }
        });
        css(box, [
            ['grid-row', '1'],
            ['grid-column', wave],
        ]);
        below.forEach((row, index) =>
            css(row, [
                ['grid-row', `${index + 2}`],
                ['grid-column', wave],
            ]),
        );
    }

    private teardown(): void {
        for (const stop of this.partCleanups) {
            stop();
        }

        this.partCleanups = [];
        this.times = [];
        this.layout = null;
        this.buttonRef?.destroy();
        this.volumeRef?.destroy();
        this.frameRef?.destroy();
        this.buttonRef = null;
        this.volumeRef = null;
        this.frameRef = null;
        this.descriptionRef = null;
        this.options.slot?.remove();

        // A copy: removing children while walking the live collection would skip some.
        for (const child of Array.from(this.element.children)) {
            if (child !== this.media) {
                child.remove();
            }
        }
    }

    private addPart(
        part: Part,
        target: HTMLElement,
        column: HTMLElement,
    ): void {
        const look = this.look;

        switch (part) {
            case 'play':
                this.buttonRef = PlayButton.create({
                    container: target,
                    media: this.media,
                    shape: look.button.shape,
                    fill: look.button.fill,
                    size: look.button.size,
                    labels: {
                        play: this.words.labels.play,
                        pause: this.words.labels.pause,
                    },
                });
                break;
            case 'wave':
                target.append(column);
                break;
            case 'time':
            case 'elapsed':
            case 'remaining':
            case 'duration':
                target.append(
                    this.timePart(part === 'time' ? look.time : part),
                );
                break;
            case 'speed':
                target.append(this.speedPart());
                break;
            case 'back':
            case 'forward':
                target.append(this.skipPart(part));
                break;
            case 'volume':
                this.volumeRef = VolumeControl.create({
                    container: target,
                    media: this.media,
                    slider: look.volume,
                    size: Math.round(look.button.size * 0.875),
                    labels: {
                        mute: this.words.labels.mute,
                        unmute: this.words.labels.unmute,
                        volume: this.words.labels.volume,
                    },
                });
                break;
            case 'zoomIn':
            case 'zoomOut':
            case 'zoomReset':
                target.append(this.zoomPart(part));
                break;
            case 'slot':
                if (this.options.slot) {
                    target.append(this.options.slot);
                }
                break;
            default: {
                const spacer = document.createElement('div');
                spacer.style.setProperty('flex', '1 1 auto');
                target.append(spacer);
            }
        }
    }

    private timePart(format: PlayerLook['time']): HTMLElement {
        const time = document.createElement('span');
        time.className = 'sonicframe-time';
        // The wave is a slider that already speaks the position.
        time.setAttribute('aria-hidden', 'true');
        css(time, [
            ['white-space', 'nowrap'],
            ['flex-shrink', '0'],
            ['color', 'var(--sonicframe-muted, currentColor)'],
        ]);
        this.times.push([time, format]);

        return time;
    }

    private showTime(): void {
        const frame = this.frameRef;

        if (frame === null) {
            return;
        }

        const duration = frame.duration;
        const time =
            this.media !== null
                ? this.media.currentTime
                : duration === null
                  ? null
                  : frame.progress * duration;

        for (const [element, format] of this.times) {
            element.textContent = timeText(format, time, duration);
        }
    }

    private textButton(className: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.disabled = this.media === null;
        css(button, [
            ['appearance', 'none'],
            ['flex-shrink', '0'],
            ['margin', '0'],
            ['border-style', 'solid'],
            ['border-width', '1px'],
            ['border-color', 'var(--sonicframe-border, currentColor)'],
            ['border-radius', '62.4375rem'],
            ['background-color', 'transparent'],
            ['color', 'inherit'],
            ['font', 'inherit'],
            ['font-size', '0.85em'],
            ['line-height', '1.2'],
            ['padding', '0.125rem 0.5rem'],
            ['min-width', '2.75rem'],
            ['cursor', 'pointer'],
        ]);
        this.ring(button);

        return button;
    }

    private speedPart(): HTMLButtonElement {
        const button = this.textButton('sonicframe-speed');
        const media = this.media;
        const show = (): void => {
            const rate = media?.playbackRate ?? 1;
            button.textContent = speedText(rate);
            button.setAttribute(
                'aria-label',
                this.words.say('speed', {
                    speed: `${this.words.number(rate)}×`,
                }),
            );
        };

        button.addEventListener('click', () => {
            if (media !== null) {
                media.playbackRate = nextSpeed(
                    media.playbackRate,
                    this.look.speeds,
                );
                show();
            }
        });

        if (media !== null) {
            media.addEventListener('ratechange', show);
            this.partCleanups.push(() =>
                media.removeEventListener('ratechange', show),
            );
        }

        show();

        return button;
    }

    /** A round button with an SVG icon (`d` on the 24 × 24 grid), named by `label`. */
    private iconButton(
        className: string,
        d: string,
        label: string,
    ): HTMLButtonElement {
        const button = document.createElement('button');
        const size = `${Math.round(this.look.button.size * 0.75)}px`;
        const icon = document.createElementNS(SVG, 'svg');
        const path = document.createElementNS(SVG, 'path');

        button.type = 'button';
        button.className = className;
        nameButton(button, label);
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'currentColor');
        icon.append(path);
        button.append(icon);
        css(button, [
            ['display', 'inline-grid'],
            ['place-items', 'center'],
            ['flex-shrink', '0'],
            ['width', size],
            ['height', size],
            ['margin', '0'],
            ['padding', '0'],
            ['border-width', '0'],
            ['border-radius', '50%'],
            ['background-color', 'transparent'],
            ['color', 'inherit'],
            ['cursor', 'pointer'],
            ['appearance', 'none'],
            ['line-height', '0'],
        ]);
        css(icon, [
            ['width', '70%'],
            ['height', '70%'],
            ['display', 'block'],
        ]);
        this.ring(button);

        return button;
    }

    private skipPart(direction: 'back' | 'forward'): HTMLButtonElement {
        const seconds = this.look.skip;
        const button = this.iconButton(
            `sonicframe-${direction}`,
            SKIP_ICONS[direction],
            this.words.say(direction, { seconds: this.words.number(seconds) }),
        );
        button.disabled = this.media === null;

        button.addEventListener('click', () => {
            const frame = this.frameRef;
            const duration = frame?.duration ?? null;

            if (frame === null || duration === null || duration <= 0) {
                return;
            }

            const now = this.media?.currentTime ?? frame.progress * duration;
            const target = now + (direction === 'back' ? -seconds : seconds);
            frame.seekTo(Math.min(1, Math.max(0, target / duration)));
        });

        return button;
    }

    /**
     * A zoom button. At its limit (the largest zoom, or the whole sound) it is marked `aria-disabled`
     * and does nothing, but keeps its place in the tab order, so focus is never lost under it.
     */
    private zoomPart(
        part: 'zoomIn' | 'zoomOut' | 'zoomReset',
    ): HTMLButtonElement {
        const { name, icon } = ZOOM_BUTTONS[part];
        const button = this.iconButton(
            `sonicframe-${name}`,
            icon,
            this.words.labels[part],
        );
        const step = resolveZoom(this.options.zoom)?.step ?? 2;
        const atLimit = (): boolean => {
            const view = this.frameRef?.view;

            if (view === undefined) {
                return true;
            }

            return part === 'zoomIn'
                ? view.level >= view.maxLevel - 1e-9
                : view.level <= 1;
        };
        const show = (): void => {
            const limit = atLimit();
            button.setAttribute('aria-disabled', String(limit));
            css(button, [
                ['opacity', limit ? '0.5' : '1'],
                ['cursor', limit ? 'default' : 'pointer'],
            ]);
        };

        button.addEventListener('click', () => {
            const frame = this.frameRef;

            if (frame === null || atLimit()) {
                return;
            }

            if (part === 'zoomReset') {
                frame.setView(0, 1, 'button');
            } else {
                frame.zoomBy(
                    part === 'zoomIn' ? step : 1 / step,
                    undefined,
                    'button',
                );
            }
        });

        const frame = this.frameRef;

        if (frame !== null) {
            // The largest zoom moves with the peaks and the size, not only with the view.
            this.partCleanups.push(
                frame.on('viewchange', show),
                frame.on('peakschange', show),
                frame.on('resize', show),
            );
        }

        show();

        return button;
    }

    /**
     * Reads the description with the browser's voice; pressed again (or Escape on the wave), it stops.
     * While it reads, its name says so and it is filled (and moves, with `animation`).
     */
    private listenPart(settings: PlayerListenButton): HTMLButtonElement {
        const labels = this.words.labels;
        const animation = animationOf(settings);
        const button = this.iconButton(
            'sonicframe-listen',
            LISTEN_ICON,
            labels.listen,
        );
        let beating: Animation | null = null;
        const show = (): void => {
            const reading = this.descriptionRef?.speaking === true;
            nameButton(button, reading ? labels.stopListening : labels.listen);
            css(button, [
                ['background-color', reading ? BUTTON_FILL : 'transparent'],
                ['color', reading ? BUTTON_ICON : 'inherit'],
            ]);

            if (
                reading &&
                beating === null &&
                animation !== null &&
                typeof button.animate === 'function' &&
                !prefersReducedMotion()
            ) {
                beating = button.animate(BUTTON_ANIMATIONS[animation], {
                    duration: BEAT_MS,
                    direction: 'alternate',
                    iterations: Number.POSITIVE_INFINITY,
                    easing: 'ease-in-out',
                });
                // Cancelling the animation rejects `finished`; that is how it ends, never an error.
                beating.finished.catch(() => undefined);
            } else if (!reading) {
                beating?.cancel();
                beating = null;
            }
        };
        this.partCleanups.push(() => {
            beating?.cancel();
            beating = null;
        });

        button.addEventListener('click', () => {
            const description = this.descriptionRef;

            if (description === null) {
                return;
            }

            if (description.speaking) {
                description.stopSpeaking();
                show();

                return;
            }

            const reading = description.speak();
            show();
            reading.then(show, (error: unknown) => {
                // Said aloud too: a person pressing the button may not see the page.
                this.frameRef?.announce(labels.speechFailed);
                this.frameRef?.reportError(error);
                show();
            });
        });

        return button;
    }

    /** The keyboard focus ring, in the played color, through `outline-color` only. */
    private ring(button: HTMLButtonElement): void {
        button.addEventListener('focus', () => {
            if (button.matches(':focus-visible')) {
                showFocusRing(button, 'var(--sonicframe-progress, #2f6fdb)');
            }
        });
        button.addEventListener('blur', () => hideFocusRing(button));
    }

    private applyPalette(): void {
        this.stopScheme?.();
        this.stopScheme = null;

        const choice = this.palette;

        if (typeof choice !== 'string') {
            this.paint(cleanPalette(choice));

            return;
        }

        if (choice === 'auto' && typeof window.matchMedia === 'function') {
            const query = window.matchMedia('(prefers-color-scheme: dark)');
            const follow = (): void => {
                this.paint(
                    pickPalette('auto', query.matches) ?? PALETTES.light,
                );
            };

            query.addEventListener('change', follow);
            this.stopScheme = () => query.removeEventListener('change', follow);
            follow();

            return;
        }

        const palette =
            choice === 'default' ? null : pickPalette(choice, false);

        if (palette === null && choice !== 'default') {
            this.later(
                new Error(
                    `sonicframe: unknown palette "${cleanText(choice, 40)}"`,
                ),
            );
        }

        this.paint(palette);
    }

    /**
     * Sets a palette's variables on the player; null (the default palette) removes them all, so
     * SonicFrame's own colors and the page's variables show, as without a palette.
     */
    private paint(palette: Palette | null): void {
        this.colors = palette ?? DEFAULT_PALETTE;

        for (const [name, value] of paletteVariables(this.colors)) {
            if (palette === null) {
                this.element.style.removeProperty(name);
            } else {
                this.element.style.setProperty(name, value);
            }
        }

        this.finish();
        this.frameRef?.refresh();
    }

    /** The player's own box: sizes from the look, colors from the palette (shadows as numbers). */
    private finish(): void {
        const look = this.look;
        const palette = this.colors;
        let surface = 'var(--sonicframe-surface, transparent)';
        let shadow = 'none';

        if (look.surface === 'none') {
            surface = 'transparent';
        } else if (look.surface === 'glass') {
            surface = withAlpha(readColor(palette.surface), 0.72);
        }

        if (look.shadow === 'soft') {
            shadow =
                '0 0.0625rem 0.25rem rgba(0, 0, 0, 0.12), 0 0.25rem 1rem rgba(0, 0, 0, 0.08)';
        } else if (look.shadow === 'hard') {
            shadow = `0.25rem 0.25rem 0 ${withAlpha(readColor(palette.text), 1)}`;
        } else if (look.shadow === 'glow') {
            shadow = `0 0 1rem ${withAlpha(readColor(palette.progress), 0.45)}`;
        }

        css(this.element, [
            ['display', 'flex'],
            ['flex-direction', 'column'],
            ['gap', `${look.gap}rem`],
            ['box-sizing', 'border-box'],
            ['min-width', '0'],
            ['padding', `${look.padding}rem`],
            ['border-style', 'solid'],
            ['border-width', `${look.border}px`],
            ['border-color', 'var(--sonicframe-border, transparent)'],
            ['border-radius', `${look.corner}rem`],
            // Not the `background` shorthand: it would take url(...) from a color and fetch it.
            ['background-color', surface],
            [
                'backdrop-filter',
                look.surface === 'glass' ? 'blur(0.75rem)' : 'none',
            ],
            ['box-shadow', shadow],
            ['color', 'var(--sonicframe-text, inherit)'],
            ['font-size', `${look.fontSize}rem`],
            ['font-weight', String(look.weight)],
            ['text-transform', look.uppercase ? 'uppercase' : 'none'],
            ['font-variant-numeric', 'tabular-nums'],
            ['line-height', '1.25'],
        ]);
    }

    private applyFont(): void {
        const font = resolveFont(this.font, this.look.font);
        this.element.style.setProperty('font-family', font.family);

        if (font.load !== null) {
            loadFont(font.load).catch((error: unknown) =>
                this.frameRef?.reportError(error),
            );
        }
    }
}

/** Makes a player inside `options.container`. */
export function createPlayer(options: PlayerOptions): Player {
    return new Player(options);
}
