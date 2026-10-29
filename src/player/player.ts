/**
 * A ready-made player: a play button, the wave and the time, plus any of speed, skip, volume and a
 * slot for the app's own element (an avatar, say), laid out by a look and colored by a palette. The
 * palette reaches every part through `--sonicframe-*` custom properties set on the player, so plain
 * CSS can still override one color; sizes are in rem. Shadows and the glass surface are built only
 * from colors read back as numbers, never from a raw page value. Given only a sound address, the
 * player makes its own media element and decodes the peaks when it first comes near the screen. Its
 * words are English unless the app picks another language or its own labels; the description of the
 * sound in words is off until the app asks for it.
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
import { pageLanguage } from '../dom/page-language';
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
import { SonicFrame, type SonicFrameOptions } from '../dom/frame';
import { readColor } from '../dom/paint';

export type PlayerOptions = {
    /** The element the player is added to. */
    container: HTMLElement;
    /** An audio or video element to play; or give `src` and the player makes its own. */
    media?: HTMLMediaElement | null;
    /** The sound's address, when the player should make its own media element. */
    src?: string;
    /** Peaks, or a function that loads them; by default they are decoded from the sound. */
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
    /** Your own element for the `slot` part (an avatar, say); it is given back on destroy. */
    slot?: HTMLElement | null;
    /** The player's accessible name (over the `player` label). */
    label?: string;
    /**
     * The language of the player's words: `'en'` (the default), `'pt'`, or `'auto'` (the page's
     * language). The description follows it unless it has its own `lang`.
     */
    lang?: string;
    /** Your own accessible names and words, over the language's. */
    labels?: Partial<PlayerLabels>;
    /**
     * Describe the sound in words for screen readers (see `soundDescription`): true, or its options
     * plus `button`, a button that reads it with the browser's voice. Off by default.
     */
    description?: boolean | PlayerDescription;
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

/** The description on a player: the plugin's options, plus a button that reads it aloud. */
export type PlayerDescription = SoundDescriptionOptions & {
    /** A button that reads the description with the browser's voice (where it has one); off by default. */
    button?: boolean;
};

/** How many peaks are decoded from a sound. */
const PEAKS = 1000;

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
        this.words = playerWords(
            options.lang === 'auto'
                ? pageLanguage(options.container)
                : options.lang,
            options.labels,
        );

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-player';
        this.element.setAttribute('role', 'group');
        this.element.setAttribute(
            'aria-label',
            cleanText(options.label ?? this.words.labels.player, 120),
        );

        this.ownMedia = !options.media && typeof options.src === 'string';
        this.media = options.media ?? (this.ownMedia ? this.makeMedia() : null);

        if (this.ownMedia && this.media !== null) {
            this.element.append(this.media);
        }

        options.container.append(this.element);
        this.build();
        this.applyPalette();
        this.applyFont();
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
        audio.preload = 'metadata';
        audio.setAttribute('src', this.options.src ?? '');

        return audio;
    }

    /** The parts the volume option allows: placed by the look, or at the end of the line. */
    private visibleLine(): Part[] {
        const line = this.look.line;

        if (!this.showVolume) {
            return line.filter((part) => part !== 'volume');
        }

        return line.includes('volume') || this.look.meta.includes('volume')
            ? line
            : [...line, 'volume'];
    }

    private visibleMeta(): Part[] {
        return this.showVolume
            ? this.look.meta
            : this.look.meta.filter((part) => part !== 'volume');
    }

    private peaksSource(): PeaksSource {
        if (this.options.peaks !== undefined) {
            return this.frameRef?.peaks ?? this.options.peaks;
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
            const { samples } = await this.decoded();
            this.peaks = peaksFromChannel(samples, PEAKS);

            return this.peaks;
        };
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
                ? decodeAudio(address, { signal: this.abort.signal })
                : Promise.reject(
                      new Error('sonicframe: no sound to read peaks from'),
                  );
        }

        return this.decoding;
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

        const asked = this.options.description;

        if (asked) {
            const settings = asked === true ? {} : asked;
            const description = soundDescription({
                ...settings,
                lang: settings.lang ?? this.options.lang,
                // The button reads aloud, so asking for it asks for the voice.
                speech: settings.speech ?? settings.button === true,
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

    private build(): void {
        const peaks = this.peaksSource();
        this.teardown();

        const look = this.look;
        const column = document.createElement('div');
        const box = document.createElement('div');
        column.append(box);
        css(column, [
            ['display', 'flex'],
            ['flex-direction', 'column'],
            ['gap', '0.25rem'],
            ['flex', '1 1 auto'],
            ['min-width', '0'],
        ]);
        css(box, [
            ['position', 'relative'],
            ['height', `${look.waveHeight}rem`],
            ['min-width', '0'],
        ]);

        const frame = new SonicFrame({
            label: this.words.labels.position,
            valueText: this.words.valueText,
            ...this.options.frame,
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
        // of spilling out of a narrow player.
        const line = document.createElement('div');
        css(line, [
            ['display', 'flex'],
            ['flex-wrap', look.wavePlace === 'top' ? 'wrap' : 'nowrap'],
            ['align-items', 'center'],
            ['gap', `${look.gap}rem`],
            ['min-width', '0'],
        ]);

        if (look.wavePlace === 'top') {
            this.element.prepend(column, line);
        } else {
            this.element.prepend(line);
        }

        for (const part of this.visibleLine()) {
            this.addPart(part, line, column);
        }

        const description = this.options.description;

        if (
            typeof description === 'object' &&
            description.button === true &&
            canSpeak()
        ) {
            line.append(this.listenPart());
        }

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
    }

    private teardown(): void {
        for (const stop of this.partCleanups) {
            stop();
        }

        this.partCleanups = [];
        this.times = [];
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

    /** Reads the description with the browser's voice; pressed again (or Escape on the wave), it stops. */
    private listenPart(): HTMLButtonElement {
        const labels = this.words.labels;
        const button = this.iconButton(
            'sonicframe-listen',
            LISTEN_ICON,
            labels.listen,
        );
        const show = (): void => {
            nameButton(
                button,
                this.descriptionRef?.speaking === true
                    ? labels.stopListening
                    : labels.listen,
            );
        };

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
