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
 * (`PlayerSession`) and the box and colors (`player-paint`). It stays one file because the build ties every collaborator to the player's
 * state; split further, that state would only be handed around.
 */

import { PlayButton } from '../../controls/play/play-button';
import { VolumeControl } from '../../controls/volume/volume';
import type { FontChoice } from '../../core/player/fonts';
import { playerWords, type PlayerWords } from '../../core/player/labels';
import {
    DEFAULT_LOOK,
    type Part,
    type PlayerLook,
} from '../../core/player/look';
import {
    choosePalette,
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
import { unknownName } from '../../core/shared/checked';
import { Emitter } from '../../core/shared/emitter';
import { cleanText } from '../../core/shared/text';
import { MUTED, PROGRESS } from '../../core/shared/variables';
import { resolveZoom } from '../../core/view/zoom';
import { DEFAULT_WAVE } from '../../core/wave/shapes';
import { pageLanguage } from '../../dom/a11y/page-language';
import { canSpeak } from '../../dom/a11y/speak';
import { SonicFrame } from '../../dom/frame/frame';
import type { SonicFrameOptions } from '../../dom/frame/frame-options';
import { css } from '../../dom/shared/css';
import { useFont } from '../../dom/shared/fonts';
import { observeSize } from '../../dom/shared/observe';
import { onSchemeChange, prefersDark } from '../../dom/shared/scheme';
import { remPixels } from '../../dom/shared/units';
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
import { listenPart } from '../parts/listen-button';
import { skipPart, speedPart, zoomPart } from '../parts/part-buttons';
import { TimeParts, type Side, type TimeSides } from '../parts/time-parts';
import { farGroup, placeOf, PlayerLayout, type Piece } from './player-layout';
import type { PlayerEvents, PlayerOptions } from './player-options';
import { PlayerBackdrop } from '../background/backdrop';
import { finishBox, wearPalette } from './player-paint';
import { boxHeight, listenSettings, playerPlugins } from './player-plugins';
import { PlayerSession } from './player-session';
import { PlayerSound } from './player-sound';

/** The zoom buttons the player adds at the end of the line when the look places none. */
const ZOOM_PARTS: readonly Part[] = ['zoomOut', 'zoomReset', 'zoomIn'];

/** The knob takes its own variable, so it can differ from the played color. */
const KNOB = `var(--sonicframe-knob, ${PROGRESS})`;

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
    private showVolume: boolean;
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
    private readonly times = new TimeParts();
    private partCleanups: (() => void)[] = [];
    private layout: PlayerLayout | null = null;
    /** The player's width in CSS pixels, once measured. */
    private width: number | null = null;
    private readonly stopSize: () => void;
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
        this.sound = new PlayerSound(options, this.media, this.abort.signal);
        this.chapterParts = new ChapterParts(options.chapters, this.host);
        this.session = new PlayerSession(options, {
            look: () => this.look,
            chapters: this.chapterParts.plugin,
        });
        this.backdrop = new PlayerBackdrop(
            this.element,
            this.media,
            this.abort.signal,
        );

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
            this.alignToBars();
            this.chapterParts.fitNames();
            this.backdrop.resize();
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

    /** The chapters plugin (to set, load or step through the chapters), or null while they are off. */
    get chapters(): ChaptersPlugin | null {
        return this.chapterParts.plugin;
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
        this.chapterParts.destroy();
        this.backdrop.destroy();

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

    /**
     * A part the options allow: the volume and the zoom buttons only when they are on, the chapter
     * parts only with chapters, and the list's button only with the list.
     */
    private allowed(part: Part): boolean {
        if (part === 'volume') {
            return this.showVolume;
        }

        if (CHAPTER_PARTS.includes(part)) {
            return this.chapterParts.allows(part);
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

        if (this.showVolume && !placed('volume')) {
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
            described: (text) => this.events.emit('description', text),
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
            label: words.labels.position,
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
            ['height', boxHeight(this.options, look)],
            ['min-width', '0'],
        ]);

        const frame = new SonicFrame(this.frameOptions(box, peaks));
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
        this.partCleanups.push(
            frame.on('timeupdate', sync),
            frame.on('durationchange', sync),
            frame.on('seek', sync),
        );
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
            frame.on('resize', () => {
                this.alignToBars();
                this.chapterParts.fitNames();
            }),
        );
        this.alignToBars();
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
                    slider: look.volume,
                    size: Math.round(look.button.size * 0.875),
                    labels: {
                        mute: this.words.labels.mute,
                        unmute: this.words.labels.unmute,
                        volume: this.words.labels.volume,
                        muted: this.words.labels.muted,
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
            case 'prevChapter':
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
        this.stopScheme = null;

        const choice = this.palette;

        if (choice === 'auto') {
            const follow = (dark: boolean): void =>
                this.paint(choosePalette('auto', dark));
            this.stopScheme = onSchemeChange(follow);
            follow(prefersDark());

            return;
        }

        if (unknownPalette(choice)) {
            this.later(unknownName('palette', choice));
        }

        this.paint(choosePalette(choice, false));
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
