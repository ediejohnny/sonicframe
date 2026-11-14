/**
 * A ready-made player: a play button, the wave and the time, plus any of speed, skip, volume and a
 * slot for the app's own element (an avatar, say), laid out by a look and colored by a palette. The
 * palette reaches every part through `--sonicframe-*` custom properties set on the player, so plain
 * CSS can still override one color; sizes are in rem. Given only a sound address, the player makes
 * its own media element and decodes the peaks when it first comes near the screen. Its words are
 * English unless the app picks another language or its own labels; the description of the sound in
 * words, the zoom (with its buttons), the minimap, the chapters and the system's media controls are
 * off until the app asks for them.
 *
 * The player holds its own life: its choices and theme, the wave it builds and builds again, and its
 * events. Its collaborators do the rest: the sound decoded once (`PlayerSound`), the plugins it adds
 * (`player-plugins`), the main line (`PlayerLayout`), the times (`TimeParts`), the buttons
 * (`part-buttons`, `listen-button`), the chapters (`ChapterParts`), the media controls
 * (`PlayerSession`) and the box and colors (`player-paint`).
 */

import { PlayButton } from '../../controls/play/play-button';
import { VolumeControl } from '../../controls/volume/volume';
import { fileTitle } from '../../core/player/file-title';
import type { FontChoice } from '../../core/player/fonts';
import { playerWords, type PlayerWords } from '../../core/player/labels';
import { clockOf } from '../../core/player/part-text';
import {
    DEFAULT_LOOK,
    type Part,
    type PlayerLook,
} from '../../core/player/look';
import {
    DEFAULT_PALETTE,
    unknownPalette,
    type Palette,
    type PaletteChoice,
} from '../../core/player/palettes';
import {
    defineTheme,
    findTheme,
    themeParts,
    type OwnChoices,
    type Theme,
    type ThemeInput,
} from '../../core/player/theme';
import { oneOf, unknownName } from '../../core/shared/checked';
import { limitOf, TEXT_LENGTH } from '../../core/shared/limits';
import { Emitter } from '../../core/shared/emitter';
import {
    joinPlayers,
    leavePlayers,
    playerStarted,
    playerStopped,
} from './player-registry';
import { cleanText } from '../../core/shared/text';
import { MUTED, PROGRESS } from '../../core/shared/variables';
import { resolveZoom } from '../../core/view/zoom';
import { DEFAULT_WAVE } from '../../core/wave/shapes';
import { focusClass, focusedClass } from '../../dom/a11y/kept-focus';
import { pageLanguage } from '../../dom/a11y/page-language';
import { canSpeak } from '../../dom/a11y/speak';
import { SonicFrame } from '../../dom/frame/frame';
import {
    DEFAULT_BAR,
    type SonicFrameOptions,
} from '../../dom/frame/frame-options';
import { css } from '../../dom/shared/css';
import { useFont } from '../../dom/shared/fonts';
import { observeSize, outsideSizeReport } from '../../dom/shared/observe';
import { remPixels, sizePixels } from '../../dom/shared/units';
import type { ChaptersPlugin } from '../../plugins/chapters/chapters-options';
import type { SoundDescriptionPlugin } from '../../plugins/description/description';
import type { MediaSessionPlugin } from '../../plugins/media-session/media-session';
import type {
    BarStyle,
    PeaksSource,
    Plugin,
    WaveName,
    WaveStyle,
} from '../../types';
import {
    CHAPTER_PARTS,
    ChapterParts,
    type ChapterHost,
} from '../chapters/chapter-parts';
import { playerKeyboard, type PlayerKeyboard } from '../keys/player-keys';
import { playerMemory, type PlayerMemory } from '../remember/player-remember';
import { tickClock } from '../parts/clock-ticker';
import { listenPart } from '../parts/listen-button';
import { NameParts } from '../parts/name-parts';
import { skipPart, speedPart, zoomPart } from '../parts/part-buttons';
import { TimeParts, type Side, type TimeSides } from '../parts/time-parts';
import { hasTrackWay, trackPart } from '../parts/track-buttons';
import { farGroup, placeOf, PlayerLayout, type Piece } from './player-layout';
import { makeAudio, releaseMedia } from './player-media';
import type {
    PlayerEvents,
    PlayerOptions,
    PlayerTracks,
    SliderName,
} from './player-options';
import { PlayerBackdrop } from '../background/backdrop';
import { finishBox, followPalette, wearPalette } from './player-paint';
import { boxHeight, listenSettings, playerPlugins } from './player-plugins';
import { PlayerSession } from './player-session';
import { SoundNotice } from './sound-notice';
import { PlayerSound } from './player-sound';

/** What may name the wave's slider. */
const SLIDER_NAMES: readonly SliderName[] = ['position', 'label', 'both'];

/** The zoom buttons the player adds at the end of the line when the look places none. */
const ZOOM_PARTS: readonly Part[] = ['zoomOut', 'zoomReset', 'zoomIn'];

/** The knob takes its own variable, so it can differ from the played color. */
const KNOB = `var(--sonicframe-knob, ${PROGRESS})`;

/** The part that takes the focus back when the focused one is not built again: the play button. */
const PLAY_CLASS = 'sonicframe-play';

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
    private readonly own: OwnChoices;
    private theme: Theme | null = null;
    private volumeShown: boolean;
    private look: PlayerLook = DEFAULT_LOOK;
    private palette: PaletteChoice = 'default';
    /** The colors the player wears, as numbers for shadows and glass. */
    private colors: Palette = DEFAULT_PALETTE;
    private wave: Partial<WaveStyle> = {};
    private bar: Partial<BarStyle> = {};
    private font: FontChoice | undefined;
    private frameRef: SonicFrame | null = null;
    private buttonRef: PlayButton | null = null;
    private volumeRef: VolumeControl | null = null;
    private descriptionRef: SoundDescriptionPlugin | null = null;
    private readonly words: PlayerWords;
    /** What the parts and the chapters reach of the player. */
    private readonly host: ChapterHost;
    private readonly sound: PlayerSound;
    private readonly backdrop: PlayerBackdrop;
    private readonly chapterParts: ChapterParts;
    private readonly session: PlayerSession;
    /** The message and the announcement of a sound that cannot load. */
    private readonly notice: SoundNotice;
    /** The `title` and `artist` parts. */
    private readonly names: NameParts;
    /** The player's own name, as the app gave it; undefined while it has none. */
    private name: string | undefined;
    /** The longest name, artist or word shown (`maxText`). */
    private readonly longest: number;
    private readonly times = new TimeParts();
    private partCleanups: (() => void)[] = [];
    private layout: PlayerLayout | null = null;
    /** The player's width in CSS pixels, once measured. */
    private width: number | null = null;
    private readonly stopSize: () => void;
    private stopScheme: (() => void) | null = null;
    private readonly keyboard: PlayerKeyboard | null;
    private readonly memory: PlayerMemory | null;
    /** The tracks around the sound, from the options or `setTracks`. */
    private trackWays: PlayerTracks | undefined;
    private destroyed = false;

    constructor(options: PlayerOptions) {
        if (!options.container) {
            throw new TypeError('sonicframe: a container element is required');
        }

        this.options = options;
        this.trackWays = options.tracks;
        this.own = {
            look: options.look,
            palette: options.palette,
            wave: options.wave,
            bar: options.bar,
        };
        this.volumeShown = options.volume === true;
        this.theme = this.pickTheme(options.theme);
        this.combine();
        this.font = options.font;
        const a11y = options.a11y ?? {};
        this.longest = limitOf('maxText', options.maxText, TEXT_LENGTH);
        this.words = playerWords(
            a11y.lang === 'auto' ? pageLanguage(options.container) : a11y.lang,
            a11y.labels === undefined && a11y.words === undefined
                ? undefined
                : { ...a11y.labels, ...a11y.words },
            this.longest,
        );

        this.element = document.createElement('div');
        this.element.className = 'sonicframe-player';
        this.element.setAttribute('role', 'group');
        this.element.setAttribute(
            'aria-label',
            cleanText(
                a11y.label ?? options.label ?? this.words.labels.player,
                this.longest,
            ),
        );

        // A language the app chose marks the player, so a screen reader says its words in that voice.
        if (a11y.lang !== undefined) {
            this.element.setAttribute('lang', this.words.locale);
        }

        this.ownMedia = !options.media && typeof options.src === 'string';
        this.media =
            options.media ??
            (this.ownMedia
                ? makeAudio(options.src ?? '', options.preload)
                : null);
        this.host = {
            look: () => this.look,
            words: this.words,
            media: this.media,
            frame: () => this.frameRef,
            cleanup: (stop) => this.partCleanups.push(stop),
            element: this.element,
            signal: this.abort.signal,
            colors: () => this.colors,
            layout: () => this.layout,
            later: (error) => this.later(error),
            reportError: this.reportError,
            changed: (chapter, index) =>
                this.events.emit('chapterchange', chapter, index),
            listed: (chapters) => this.session.listed(chapters),
        };
        this.sound = new PlayerSound(
            options,
            this.media,
            this.abort.signal,
            () => this.frameRef,
        );
        this.chapterParts = new ChapterParts(options.chapters, this.host);
        this.session = new PlayerSession(options, {
            look: () => this.look,
            chapters: this.chapterParts.plugin,
            tracks: () => this.trackWays,
        });
        this.backdrop = new PlayerBackdrop(
            this.element,
            this.media,
            this.abort.signal,
        );
        this.name = a11y.label ?? options.label;
        this.names = new NameParts({
            look: () => this.look,
            frame: () => this.frameRef,
            title: () => this.titleText(),
            artist: () => cleanText(options.artist ?? '', this.longest),
        });
        const loadError = options.loadError;
        this.notice = new SoundNotice({
            media: this.media,
            words: this.words,
            signal: this.abort.signal,
            show:
                loadError !== false &&
                (typeof loadError !== 'object' || loadError.show !== false),
            announce: a11y.loadError?.announce !== false,
            report: this.reportError,
            say: (text) => this.frameRef?.announce(text),
        });

        if (this.ownMedia && this.media !== null) {
            this.element.append(this.media);
        }

        options.container.append(this.element);
        // Laid out now, in its width and its font, the player starts as the browser will first measure
        // it: a size report that changes the player itself is what browsers flag as a ResizeObserver loop.
        this.width = this.element.getBoundingClientRect().width || null;
        this.build();
        this.applyPalette();
        this.applyFont();
        // The palette put the wave's strips in place; the parts meet the bars before the first paint.
        this.alignToBars();
        this.stopSize = observeSize(this.element, (size) => {
            this.width = size.width / size.pixelRatio;
            outsideSizeReport(this.settle);
        });

        this.keyboard = playerKeyboard(options, {
            ...this.host,
            tracks: () => this.trackWays,
        });
        joinPlayers(this);
        this.media?.addEventListener('play', () => playerStarted(this), {
            signal: this.abort.signal,
        });

        for (const stop of ['pause', 'ended']) {
            this.media?.addEventListener(stop, playerStopped, {
                signal: this.abort.signal,
            });
        }

        this.memory = playerMemory(options, {
            media: this.media,
            words: this.words,
            frame: () => this.frameRef,
            onDuration: (listener) =>
                this.events.on('durationchange', listener),
            resumed: (time) => this.events.emit('resume', time),
        });
    }

    /** Fits the player to its size now: the voice note, the parts on the bars, the names, the background. */
    private readonly settle = (): void => {
        this.arrange();
        this.alignToBars();
        this.chapterParts.fitNames();
        this.names.fit();
        this.backdrop.resize();
    };

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

    /** The chapters plugin (to set, load or step through the chapters), or null while they are off. */
    get chapters(): ChaptersPlugin | null {
        return this.chapterParts.plugin;
    }

    /** The tracks around the sound (from the options or `setTracks`), or undefined without any. */
    get tracks(): PlayerTracks | undefined {
        return this.trackWays;
    }

    /** The system's media controls (to change what they show), or null while they are off. */
    get mediaSession(): MediaSessionPlugin | null {
        return this.session.plugin;
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

    /** Changes the bars' density and shape; with no bars, the theme's come back. */
    setBar(bar?: Partial<BarStyle>): void {
        if (!this.destroyed) {
            this.own.bar =
                bar === undefined ? undefined : { ...this.own.bar, ...bar };
            this.combine();
            this.frameRef?.setBar({ ...DEFAULT_BAR, ...this.bar });
        }
    }

    /** Changes the player's accessible name; with no name, its `player` word comes back. */
    setLabel(label?: string): void {
        if (!this.destroyed) {
            this.name = label;
            this.element.setAttribute(
                'aria-label',
                cleanText(label ?? this.words.labels.player, this.longest),
            );
            this.names.show();

            if (this.options.frame?.label === undefined) {
                this.frameRef?.setLabel(this.sliderLabel());
            }
        }
    }

    /** The wave's slider's name, as `a11y.sliderName` says; its `position` word without a sound's name. */
    private sliderLabel(): string {
        const position = this.words.labels.position;
        const way = oneOf(
            this.options.a11y?.sliderName,
            SLIDER_NAMES,
            'position',
        );
        const name = way === 'position' ? '' : this.titleText();

        if (name === '') {
            return position;
        }

        return way === 'label' ? name : `${name}, ${position}`;
    }

    /** The sound's name for the `title` part: the player's own, or its file's when the look allows. */
    private titleText(): string {
        if (this.name !== undefined) {
            return cleanText(this.name, this.longest);
        }

        const media = this.media;
        const address =
            this.options.src ??
            ((media ? media.currentSrc || media.src : '') || '');

        return this.look.titleFromFile && address !== ''
            ? fileTitle(address)
            : '';
    }

    /**
     * Changes the tracks around the sound (see `PlayerTracks`), and rebuilds the player so its track
     * buttons follow them; with none, the buttons, the keys and the media controls of tracks go.
     */
    setTracks(tracks?: PlayerTracks): void {
        if (!this.destroyed) {
            this.trackWays = tracks;
            this.build();
        }
    }

    /** Shows or hides the volume control. */
    showVolume(show: boolean): void {
        if (!this.destroyed && show !== this.volumeShown) {
            this.volumeShown = show;
            this.build();
        }
    }

    /** @deprecated Use `showVolume`; `setVolume` goes in 2.0. */
    setVolume(show: boolean): void {
        this.showVolume(show);
    }

    /** Forgets everything `remember` kept under the player's name: positions, volume and speed. */
    forget(): void {
        this.memory?.forget();
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
        this.keyboard?.destroy();
        this.memory?.destroy();
        this.teardown();
        this.chapterParts.destroy();
        this.backdrop.destroy();

        if (this.ownMedia && this.media !== null) {
            releaseMedia(this.media);
        }

        this.element.remove();
        leavePlayers(this);
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
            this.later(unknownName('theme', choice));
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

    /** Hands an error of the player's own work (a font that fails to load) to the wave's `error` event. */
    private readonly reportError = (error: unknown): void => {
        this.frameRef?.reportError(error);
    };

    /** Whether the zoom buttons are on (zoom on, with `buttons`). */
    private zoomButtons(): boolean {
        const zoom = this.options.zoom;

        return typeof zoom === 'object' && zoom.buttons === true;
    }

    /**
     * A part the options allow: the volume and the zoom buttons only when they are on, the chapter
     * parts only with chapters, the list's button only with the list, and a track button only for a
     * way the tracks give.
     */
    private allowed(part: Part): boolean {
        if (part === 'volume') {
            return this.volumeShown;
        }

        if (CHAPTER_PARTS.includes(part)) {
            return this.chapterParts.allows(part);
        }

        if (part === 'previousTrack' || part === 'nextTrack') {
            return hasTrackWay(this.trackWays, part);
        }

        return ZOOM_PARTS.includes(part) ? this.zoomButtons() : true;
    }

    /**
     * The parts the options allow: placed by the look, or at the end of the line (the volume, the
     * zoom buttons, then the list's button for a list that floats) when the look places none of them.
     */
    private visibleLine(): Part[] {
        const { line, meta } = this.look;
        const placed = (part: Part): boolean =>
            line.includes(part) || meta.includes(part);
        const extra: Part[] = [];

        if (this.volumeShown && !placed('volume')) {
            extra.push('volume');
        }

        if (this.zoomButtons() && !ZOOM_PARTS.some(placed)) {
            extra.push(...ZOOM_PARTS);
        }

        // A list over the page opens only from its button, so it always has one.
        if (this.chapterParts.floats && !placed('chapters')) {
            extra.push('chapters');
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

    /**
     * Whether the chapters list goes under the wave, in its column: a list in the player with the
     * wave in the line, unless zoom buttons share the line (that line wraps, which a grid cannot).
     */
    private listUnderWave(): boolean {
        return (
            this.chapterParts.listInPlayer &&
            this.look.wavePlace === 'inline' &&
            !this.zoomOnLine()
        );
    }

    /** The plugins for a new wave (see `playerPlugins`); the description among them is kept to read it. */
    private plugins(): Plugin[] {
        const { plugins, description } = playerPlugins(this.options, {
            look: this.look,
            words: this.words,
            media: this.media,
            chapters: this.chapterParts.plugin,
            session: this.session.plugin,
            decoded: () => this.sound.decoded(),
            described: (text) => {
                this.events.emit('descriptionchange', text);
                this.events.emit('description', text);
            },
        });
        this.descriptionRef = description;

        return plugins;
    }

    /** The wave's options: the player's words, zoom and plugins over the app's own `frame` options. */
    private frameOptions(
        container: HTMLElement,
        peaks: PeaksSource,
    ): SonicFrameOptions {
        const words = this.words;
        const frameA11y = this.options.frame?.a11y;

        return {
            label: this.sliderLabel(),
            valueText: words.valueText,
            ...this.options.frame,
            zoom: this.options.zoom ?? this.options.frame?.zoom,
            a11y: {
                ...frameA11y,
                lang: frameA11y?.lang ?? words.locale,
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
            container,
            media: this.media,
            peaks,
            duration: this.options.duration ?? null,
            wave: this.wave,
            bar: this.bar,
            plugins: this.plugins(),
            colors: { knob: KNOB, ...this.options.frame?.colors },
        };
    }

    private build(): void {
        const peaks = this.sound.peaksFor(this.frameRef, this.wave);
        const focused = focusedClass(this.element, PLAY_CLASS);
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
            ['min-width', roomy ? `${look.waveMinWidth}rem` : '0'],
        ]);
        css(box, [
            ['position', 'relative'],
            ['height', boxHeight(this.options, look)],
            ['min-width', '0'],
        ]);
        const frame = new SonicFrame(this.frameOptions(box, peaks));
        this.frameRef = frame;
        // After the wave, so a failed sound's message covers what the wave drew.
        this.notice.place(box);

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

        const pieces: Piece[] = [];
        // A part after the wave or a spacer sits on the row's far side.
        let side: Side = 'start';

        for (const part of this.visibleLine()) {
            const before = line.childNodes.length;
            const place = placeOf(part, look);
            this.addPart(part, line, column, {
                side,
                narrowSide: place === 'start' || place === 'end' ? place : null,
            });
            pieces.push({ place, nodes: [...line.childNodes].slice(before) });

            if (part === 'wave' || part === 'spacer') {
                side = 'end';
            }
        }

        const listen = listenSettings(this.options);

        if (listen !== null && canSpeak()) {
            const node = listenPart(
                this.host,
                listen,
                () => this.descriptionRef,
            );
            line.append(node);
            pieces.push({ place: 'end', nodes: [node] });
        }

        this.layout = new PlayerLayout(line, box, pieces);
        this.element.removeAttribute('data-narrow');
        this.metaRow(column);

        // The list in the player goes under the wave, on its left edge like the row under it (see
        // `placeRows`), otherwise under everything; a floating list stays on the page's body.
        this.chapterParts.placeList(
            this.listUnderWave() ? column : this.element,
        );

        const sync = (): void => this.showTime();
        const clock = clockOf(look, this.words.locale);
        this.times.useClock(clock);
        this.partCleanups.push(
            frame.on('timeupdate', sync),
            frame.on('durationchange', sync),
            frame.on('seek', sync),
        );

        if (clock !== null && this.media !== null && this.times.shown) {
            this.partCleanups.push(
                tickClock(this.media, clock, () => frame.time, sync),
            );
        }

        this.showTime();
        this.chapterParts.showChapter();
        this.chapterParts.showList();
        this.finish();
        this.times.align(false, look.timeAlign);
        this.arrange();
        this.placeRows();

        if (this.layout !== null) {
            this.chapterParts.swipeZones(this.layout);
        }

        // The bars move when the wave resizes or a strip comes or goes; a name's room changes too.
        this.partCleanups.push(
            frame.on('resize', () => outsideSizeReport(this.settle)),
        );
        this.alignToBars();

        // A part built again takes back the keyboard focus its old self had.
        if (focused !== null) {
            focusClass(this.element, focused, PLAY_CLASS);
        }
    }

    /** The small line under the wave, with the parts the look places there. */
    private metaRow(column: HTMLElement): void {
        const meta = this.visibleMeta();

        if (meta.length === 0) {
            return;
        }

        const row = document.createElement('div');
        css(row, [
            ['display', 'flex'],
            ['align-items', 'center'],
            ['gap', '0.5rem'],
            ['font-size', '0.85em'],
            ['color', MUTED],
        ]);

        // One line by default: a chapter's name takes the room left and gives it up first.
        // With `metaWrap`, a row short of room breaks in two instead, the parts after the
        // spacer going as one group that never breaks, kept to the far side of its line.
        const wraps = this.look.metaWrap;

        if (wraps) {
            css(row, [['flex-wrap', 'wrap']]);
        }

        column.append(row);
        let side: Side = 'start';
        let target: HTMLElement = row;

        for (const part of meta) {
            this.addPart(part, target, column, { side, narrowSide: null });

            if (part === 'spacer') {
                side = 'end';

                if (wraps) {
                    target = farGroup();
                    row.append(target);
                }
            }
        }
    }

    /**
     * A narrow player (under the look's `narrow` width, with the wave in its line) turns into a voice
     * note (see `PlayerLayout.voiceNote`); a moved control that had the focus gets it back.
     */
    private arrange(): void {
        const layout = this.layout;

        if (layout === null) {
            return;
        }

        const { narrowWidth: width, wavePlace } = this.look;
        const narrow =
            wavePlace === 'inline' &&
            width > 0 &&
            this.width !== null &&
            this.width < remPixels(width);

        if (narrow === layout.narrow) {
            return;
        }

        const focused = document.activeElement;
        this.element.toggleAttribute('data-narrow', narrow);
        layout.voiceNote(narrow, this.look.narrowGap);
        this.placeRows();
        this.times.align(narrow, this.look.timeAlign);

        if (
            focused instanceof HTMLElement &&
            focused !== document.activeElement &&
            this.element.contains(focused)
        ) {
            focused.focus({ preventScroll: true });
        }
    }

    /** Lays the rows under the wave (see `PlayerLayout.placeRows`). */
    private placeRows(): void {
        this.layout?.placeRows(this.look, {
            listUnderWave: this.listUnderWave(),
            zoomOnLine: this.zoomOnLine(),
        });
    }

    /** Lines up the parts beside an inline wave with its bars (see `PlayerLayout.alignToBars`). */
    private alignToBars(): void {
        if (this.look.wavePlace === 'inline') {
            this.layout?.alignToBars();
        }
    }

    private teardown(): void {
        for (const stop of this.partCleanups) {
            stop();
        }

        this.partCleanups = [];
        this.times.clear();
        this.chapterParts.clearParts();
        this.names.clear();
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
        sides: TimeSides,
    ): void {
        const look = this.look;

        switch (part) {
            case 'play':
                this.buttonRef = PlayButton.create({
                    container: target,
                    media: this.media,
                    shape: look.button.shape,
                    fill: look.button.fill,
                    size: sizePixels(look.button.size),
                    a11y: {
                        words: {
                            play: this.words.labels.play,
                            pause: this.words.labels.pause,
                        },
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
                    this.times.add(part === 'time' ? look.time : part, sides),
                );
                break;
            case 'speed':
                target.append(speedPart(this.host));
                break;
            case 'back':
            case 'forward':
                target.append(skipPart(this.host, part));
                break;
            case 'volume':
                this.volumeRef = VolumeControl.create({
                    container: target,
                    media: this.media,
                    slider: look.volumeSlider,
                    size: Math.round(sizePixels(look.button.size) * 0.875),
                    a11y: {
                        words: {
                            mute: this.words.labels.mute,
                            unmute: this.words.labels.unmute,
                            volume: this.words.labels.volume,
                            muted: this.words.labels.muted,
                        },
                    },
                });
                break;
            case 'zoomIn':
            case 'zoomOut':
            case 'zoomReset':
                target.append(
                    zoomPart(
                        this.host,
                        part,
                        resolveZoom(this.options.zoom)?.step ?? 2,
                    ),
                );
                break;
            case 'chapter':
                target.append(this.chapterParts.namePart());
                break;
            case 'title':
            case 'artist':
                target.append(this.names.part(part));
                break;
            case 'previousChapter':
            case 'nextChapter':
                target.append(this.chapterParts.stepButton(part));
                break;
            case 'chapters': {
                const button = this.chapterParts.listButton();

                if (button !== null) {
                    target.append(button);
                }

                break;
            }
            case 'previousTrack':
            case 'nextTrack':
                // Placed only when allowed, so the tracks are there.
                if (this.trackWays !== undefined) {
                    target.append(trackPart(this.host, part, this.trackWays));
                }
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

    /** Writes where the sound is in every time (see `TimeParts.show`). */
    private showTime(): void {
        if (this.frameRef !== null) {
            this.times.show(this.frameRef);
        }
    }

    /** Wears the palette chosen: `'auto'` follows the system; an unknown name is reported and left out. */
    private applyPalette(): void {
        this.stopScheme?.();
        const choice = this.palette;

        if (unknownPalette(choice)) {
            this.later(unknownName('palette', choice));
        }

        this.stopScheme = followPalette(choice, (palette) =>
            this.paint(palette),
        );
    }

    /** Puts a palette on the player (null: SonicFrame's own colors), then its box, then the wave's colors. */
    private paint(palette: Palette | null): void {
        this.colors = wearPalette(this.element, palette);
        this.finish();
        this.frameRef?.refresh();
    }

    /** The player's own box and background, from the look and the colors it wears. */
    private finish(): void {
        finishBox(this.element, this.look, this.colors);
        this.backdrop.show(this.look, this.colors);
    }

    private applyFont(): void {
        useFont(this.element, this.font, this.look.font, this.reportError);
    }
}

/** Makes a player inside `options.container`. */
export function createPlayer(options: PlayerOptions): Player {
    return new Player(options);
}
