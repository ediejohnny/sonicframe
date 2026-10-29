/**
 * A ready-made player: a play button, the wave and the time, plus any of speed, skip, volume and a
 * slot for the app's own element (an avatar, say), laid out by a look and colored by a palette. The
 * palette reaches every part through `--sonicframe-*` custom properties set on the player, so plain
 * CSS can still override one color; sizes are in rem. Shadows and the glass surface are built only
 * from colors read back as numbers, never from a raw page value. Given only a sound address, the
 * player makes its own media element and decodes the peaks when it first comes near the screen.
 */

import { hideFocusRing, showFocusRing } from '../controls/focus';
import { PlayButton } from '../controls/play-button';
import { VolumeControl } from '../controls/volume';
import { rgbaString, type Rgba } from '../core/color';
import { Emitter } from '../core/emitter';
import { resolveFont, type FontChoice } from '../core/fonts';
import {
    DEFAULT_LOOK,
    nextSpeed,
    resolveLook,
    speedText,
    timeText,
    type Part,
    type PlayerLook,
} from '../core/look';
import {
    PALETTES,
    paletteVariables,
    pickPalette,
    type Palette,
    type PaletteName,
} from '../core/palettes';
import { peaksFromChannel } from '../core/peaks';
import { DEFAULT_WAVE, resolveWave } from '../core/shapes';
import { cleanText } from '../core/text';
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
    /** How the player is put together (parts, sizes, finish); laid over the default look. */
    look?: Partial<PlayerLook>;
    /** A palette by name, `'auto'` (light or dark, following the system), or your own colors. */
    palette?: PaletteName | 'auto' | Palette;
    /** How the sound is drawn. */
    wave?: WaveName | Partial<WaveStyle>;
    bar?: Partial<BarStyle>;
    /** A font stack name, a CSS `font-family` list, or a font you bring (`{ family, src, stylesheet }`). */
    font?: FontChoice;
    /** Show the volume control (where the look places it, or at the end of the line). Off by default. */
    volume?: boolean;
    /** Your own element for the `slot` part (an avatar, say); it is given back on destroy. */
    slot?: HTMLElement | null;
    /** The player's accessible name. */
    label?: string;
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

/** How many peaks are decoded from a sound. */
const PEAKS = 1000;

/** The longest a palette color may be. */
const MAX_COLOR = 64;

/** The knob takes its own variable, so it can differ from the played color. */
const KNOB = 'var(--sonicframe-knob, var(--sonicframe-progress, #2f6fdb))';

const SVG = 'http://www.w3.org/2000/svg';

/** Back and forward: two triangles each, on the 24 × 24 grid of the play icon. */
const SKIP_ICONS = {
    back: 'M11.5 6v12L3.5 12zM20.5 6v12l-8-6z',
    forward: 'M3.5 6v12l8-6zM12.5 6v12l8-6z',
} as const;

/** Every frame event but `destroy`, which belongs to the player itself. */
const FORWARDED = [
    'seek',
    'hover',
    'timeupdate',
    'durationchange',
    'resize',
    'rangeend',
    'error',
] as const;

type PlayerEvents = SonicFrameEvents;

function css(
    element: HTMLElement | SVGElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
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
    private look: PlayerLook;
    private palette: PaletteName | 'auto' | Palette;
    private colors: Palette = PALETTES.light;
    private wave: WaveName | Partial<WaveStyle> | undefined;
    private font: FontChoice | undefined;
    private frameRef: SonicFrame | null = null;
    private buttonRef: PlayButton | null = null;
    private volumeRef: VolumeControl | null = null;
    private times: [HTMLElement, PlayerLook['time']][] = [];
    private partCleanups: (() => void)[] = [];
    private peaks: readonly number[] | null = null;
    private stopScheme: (() => void) | null = null;
    private destroyed = false;

    constructor(options: PlayerOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.options = options;
        this.look = resolveLook(DEFAULT_LOOK, options.look);
        this.palette = options.palette ?? 'light';
        this.wave = options.wave;
        this.font = options.font;

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-player';
        this.element.setAttribute('role', 'group');
        this.element.setAttribute(
            'aria-label',
            cleanText(options.label ?? 'Audio player', 120),
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

    /** Listens to the wave's events; returns the function that stops listening. */
    on<Name extends keyof PlayerEvents>(
        event: Name,
        listener: (...args: PlayerEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /** Changes how the player is put together (and rebuilds it). */
    setLook(look: Partial<PlayerLook>): void {
        if (!this.destroyed) {
            this.look = resolveLook(this.look, look);
            this.build();
            this.finish();
        }
    }

    /** Changes the colors. */
    setPalette(palette: PaletteName | 'auto' | Palette): void {
        if (!this.destroyed) {
            this.palette = palette;
            this.applyPalette();
        }
    }

    /** Changes how the sound is drawn. */
    setWave(wave: WaveName | Partial<WaveStyle>): void {
        if (!this.destroyed) {
            this.wave =
                typeof wave === 'string' || typeof this.wave === 'string'
                    ? wave
                    : { ...this.wave, ...wave };
            this.frameRef?.setWave(wave);
        }
    }

    /** Changes the font. */
    setFont(font: FontChoice): void {
        if (!this.destroyed) {
            this.font = font;
            this.applyFont();
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

    private makeMedia(): HTMLMediaElement {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.setAttribute('src', this.options.src ?? '');

        return audio;
    }

    /** The parts the volume option allows: placed by the look, or at the end of the line. */
    private visibleLine(): Part[] {
        const line = this.look.line;

        if (!this.options.volume) {
            return line.filter((part) => part !== 'volume');
        }

        return line.includes('volume') || this.look.meta.includes('volume')
            ? line
            : [...line, 'volume'];
    }

    private visibleMeta(): Part[] {
        return this.options.volume
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
            const address = this.options.src ?? (media.currentSrc || media.src);

            if (!address) {
                throw new Error('sonicframe: no sound to read peaks from');
            }

            const { samples } = await decodeAudio(address, {
                signal: this.abort.signal,
            });
            this.peaks = peaksFromChannel(samples, PEAKS);

            return this.peaks;
        };
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
            label: 'Playback position',
            ...this.options.frame,
            container: box,
            media: this.media,
            peaks,
            duration: this.options.duration ?? null,
            wave: this.wave,
            bar: this.options.bar,
            plugins: this.options.plugins,
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

        const line = document.createElement('div');
        css(line, [
            ['display', 'flex'],
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
                `Playback speed ${speedText(rate)}`,
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

    private skipPart(direction: 'back' | 'forward'): HTMLButtonElement {
        const button = document.createElement('button');
        const size = `${Math.round(this.look.button.size * 0.75)}px`;
        const seconds = this.look.skip;
        const icon = document.createElementNS(SVG, 'svg');
        const path = document.createElementNS(SVG, 'path');

        button.type = 'button';
        button.className = `sonicframe-${direction}`;
        button.disabled = this.media === null;
        button.setAttribute(
            'aria-label',
            `${direction === 'back' ? 'Back' : 'Forward'} ${seconds} seconds`,
        );
        button.title = button.getAttribute('aria-label') ?? '';
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');
        path.setAttribute('d', SKIP_ICONS[direction]);
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

        const palette = pickPalette(choice, false);

        if (palette === null) {
            this.frameRef?.reportError(
                new Error(
                    `sonicframe: unknown palette "${cleanText(choice, 40)}"`,
                ),
            );
        }

        this.paint(palette ?? PALETTES.light);
    }

    private paint(palette: Palette): void {
        this.colors = palette;

        for (const [name, value] of paletteVariables(palette)) {
            this.element.style.setProperty(name, value);
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
