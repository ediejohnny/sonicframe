/**
 * Chapters on the wave: a line where each chapter starts, its name in the shared tooltip, a click on
 * a line to go there, C / Shift+C to step through them (like next and previous track), the chapter in
 * the slider's value in words, and, when asked, a strip of titles over or under the wave and a list
 * in an element of the app. The chapters come from a list, WebVTT or Podcasting 2.0 JSON text, or an
 * address (see `readChapters`); chapters marked out of the table of contents are left out. Text only
 * ever goes in as text, and an image or a link only from a web or relative address. The chapters
 * stay when the plugin is set up again (a player rebuilt), without fetching the file again.
 */

import {
    chapterAt,
    chapterEnds,
    loadChapters,
    nextChapter,
    readChapters,
    type Chapter,
    type ChapterInput,
    type LoadChaptersOptions,
} from '../core/chapters';
import { clamp01, positive } from '../core/math';
import { cleanText, fillTemplate } from '../core/text';
import { formatTime } from '../core/timing';
import { FULL_VIEW, viewX } from '../core/view';
import type { Lane, Plugin, PluginHost, SeekSource, WavePoint } from '../types';
import { sharedTooltip } from '../dom/tooltip';
import { remPixels } from '../dom/units';
import { ChapterListView, type ChapterListLook } from './chapter-list';

export type { ChapterListLook };

/** What the plugin says. `{name}` marks are filled in. */
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

export const CHAPTER_WORDS: Readonly<ChapterWords> = Object.freeze({
    chapter: 'Chapter {index} of {count}',
    list: 'Chapters',
    none: 'No more chapters',
    link: 'Link',
});

/** The keys that step through the chapters while the wave has focus. */
export type ChaptersKeys = {
    /** The letter for the next chapter; with Shift, the previous one. `'c'` by default; false turns it off. */
    letter?: string | false;
    /** How far into a chapter Shift+C goes back to its own start rather than the one before, in seconds; 1 by default. */
    backGrace?: number;
};

export type ChaptersOptions = {
    /** The chapters, as a list. */
    items?: readonly ChapterInput[];
    /** The chapters as WebVTT or Podcasting 2.0 JSON text. */
    text?: string;
    /** The address of a WebVTT or JSON chapters file, fetched once per page. */
    src?: string;
    /** How `src` is fetched. */
    load?: LoadChaptersOptions;
    /** A line where each chapter starts. On by default. */
    lines?: boolean;
    /** The lines' color: any CSS color or `var(--name)`. */
    color?: string;
    /** The lines' width, in CSS pixels. 2 by default. */
    width?: number;
    /** The chapter's name in a tooltip over its line. On by default. */
    tooltip?: boolean;
    /** A click on a line goes to its chapter's start. On by default. */
    snap?: boolean;
    /** A strip with the chapters' titles over (`'above'`) or under (`'below'`) the wave; off by default. */
    lane?: false | 'above' | 'below';
    /** The strip's height, in rem. 1.25 by default. */
    laneHeight?: number;
    /** C and Shift+C (or your own letter); true by default, false turns them off. */
    keys?: boolean | ChaptersKeys;
    /** The chapter in the slider's value in words ("1:20 / 9:00, Chapter 2 of 5: Interview"). On by default. */
    valueNote?: boolean;
    /** Says the new chapter when playback enters it. Off by default. */
    announceChange?: boolean;
    /**
     * An element of yours that gets the list of chapters (a `nav` with buttons: number or playing
     * mark, picture, title, stretch); removed on destroy.
     */
    list?: HTMLElement | null;
    /** A head over the list with its name and the place of the chapter playing ("2 / 8"). Off by default. */
    header?: boolean;
    /** How the list's items look: pictures, which pieces show, title lines, spacing. */
    listLook?: ChapterListLook;
    /** Pictures in the list, when a chapter has one. Off by default. */
    images?: boolean;
    /** Links in the list, when a chapter has one; they open in a new tab. Off by default. */
    links?: boolean;
    /** Your own words, over the English ones. */
    words?: Partial<ChapterWords>;
    /** Called when the chapter playing changes (null and -1 outside every chapter). */
    onChange?: (chapter: Chapter | null, index: number) => void;
    /** Called with the chapters shown whenever they change (set, loaded, cleared). */
    onChapters?: (chapters: readonly Chapter[]) => void;
};

export type ChaptersPlugin = Plugin & {
    /** The chapters shown (those in the table of contents), in order. */
    readonly chapters: readonly Chapter[];
    /** The index of the chapter playing, or -1. */
    readonly index: number;
    /** The chapter playing, or null. */
    readonly current: Chapter | null;
    /** Replaces the chapters: a list, WebVTT or JSON text, or null for none. Throws on what is not chapters. */
    set(input: unknown): void;
    /** Fetches a chapters file and shows it; rejects when it cannot. */
    load(url: string): Promise<void>;
    /** Goes to a chapter's start; false when there is no such chapter or no duration yet. */
    go(index: number): boolean;
    /** Goes to the next chapter; false when there is none. */
    next(): boolean;
    /** Goes back like a previous track: to this chapter's start, or the one before near it. */
    previous(): boolean;
};

/** Over this many CSS pixels from a line, the pointer is not on it. */
const SLOP = 6;

/** The longest word taken from the app, in characters. */
const MAX_WORD = 120;

/** Text over the played color: the tooltip. */
const ON_PROGRESS = 'var(--sonicframe-on-progress, #ffffff)';

function css(
    element: HTMLElement,
    pairs: readonly (readonly [string, string])[],
): void {
    for (const [name, value] of pairs) {
        element.style.setProperty(name, value);
    }
}

function wordsOf(own: Partial<ChapterWords> | undefined): ChapterWords {
    const words = { ...CHAPTER_WORDS };

    for (const key of Object.keys(words) as (keyof ChapterWords)[]) {
        const value: unknown = own?.[key];

        if (typeof value === 'string') {
            words[key] = cleanText(value, MAX_WORD);
        }
    }

    return words;
}

export function chapters(options: ChaptersOptions = {}): ChaptersPlugin {
    const words = wordsOf(options.words);
    const keys = options.keys ?? true;
    const letter =
        keys === false
            ? null
            : keys === true || keys.letter === undefined
              ? 'c'
              : keys.letter !== false && keys.letter.length === 1
                ? keys.letter.toLowerCase()
                : null;
    const asked = typeof keys === 'object' ? keys.backGrace : undefined;
    const backGrace =
        typeof asked === 'number' && Number.isFinite(asked)
            ? Math.max(0, asked)
            : 1;
    const color = options.color ?? 'var(--sonicframe-chapter, #6b7280)';
    const withLines = options.lines !== false;
    const withTooltip = options.tooltip !== false;
    const snap = options.snap !== false;
    const laneHeight =
        typeof options.laneHeight === 'number' &&
        Number.isFinite(options.laneHeight)
            ? Math.min(4, Math.max(0.5, options.laneHeight))
            : 1.25;

    let all: Chapter[] = [];
    let shown: Chapter[] = [];
    let index = -1;
    let host: PluginHost | null = null;
    let started = false;
    let lane: Lane | null = null;
    let view: ChapterListView | null = null;
    let openedTooltip = false;
    let cleanups: (() => void)[] = [];

    function duration(): number | null {
        return positive(host?.duration ?? null);
    }

    /**
     * The position shown, in seconds. Never the media's own time: before its metadata loads
     * (`preload="none"`) a seek waits in the frame and the media still says 0.
     */
    function now(current: PluginHost, known: number): number {
        return current.progress * known;
    }

    /** "Chapter 3 of 8: Interview", or without the colon for an untitled chapter. */
    function label(at: number): string {
        const place = fillTemplate(words.chapter, {
            index: String(at + 1),
            count: String(shown.length),
        });
        const title = shown[at]?.title ?? '';

        return title === '' ? place : `${place}: ${title}`;
    }

    /** Follows the chapter playing; `playing` says playback (not a seek) brought it. */
    function follow(playing: boolean): void {
        const current = host;
        const known = duration();
        const next =
            current === null || known === null
                ? -1
                : chapterAt(shown, now(current, known), known);

        if (next === index) {
            view?.mark(index, played());

            return;
        }

        index = next;
        view?.mark(index, played());

        if (
            playing &&
            options.announceChange === true &&
            next >= 0 &&
            current !== null &&
            current.media !== null &&
            !current.media.paused
        ) {
            current.announce(label(next));
        }

        options.onChange?.(shown[next] ?? null, next);
    }

    /** The share of the chapter playing already played, from 0 to 1, or null when unknown. */
    function played(): number | null {
        const current = host;
        const known = duration();
        const chapter = shown[index];

        if (current === null || known === null || chapter === undefined) {
            return null;
        }

        const end = chapterEnds(shown, known)[index];

        return end === null || end <= chapter.start
            ? null
            : (now(current, known) - chapter.start) / (end - chapter.start);
    }

    /** The list in the app's element, built again with the chapters and where each one ends. */
    function buildList(): void {
        const target = options.list ?? null;

        if (target === null) {
            return;
        }

        view ??= new ChapterListView(
            target,
            {
                name: words.list,
                link: words.link,
                images: options.images === true,
                links: options.links === true,
                header: options.header === true,
                look: options.listLook,
            },
            (at) => go(at, 'api'),
        );
        view.render(shown, chapterEnds(shown, duration()), (at) =>
            shown[at].title === '' ? label(at) : shown[at].title,
        );
        view.mark(index, played());
    }

    /** The strip of titles: one box per chapter, from its start to its end, through the view. */
    function placeLane(): void {
        const current = host;

        if (lane === null || current === null) {
            return;
        }

        const element = lane.element;
        const known = duration();
        const geometry = current.geometry;
        element.replaceChildren();

        if (known === null || geometry === null) {
            return;
        }

        const width = geometry.width / geometry.pixelRatio;
        const view = current.view;
        const ends = chapterEnds(shown, known);

        shown.forEach((chapter, at) => {
            const from = viewX(clamp01(chapter.start / known), view, width);
            const to = viewX(clamp01((ends[at] ?? known) / known), view, width);
            const left = Math.max(0, from);
            const right = Math.min(width, to);

            if (right - left < 1) {
                return;
            }

            const box = document.createElement('span');
            box.className = 'sonicframe-chapter-name';
            box.textContent = chapter.title === '' ? label(at) : chapter.title;
            box.setAttribute('dir', 'auto');
            css(box, [
                ['position', 'absolute'],
                ['top', '0'],
                ['bottom', '0'],
                ['left', `${left}px`],
                ['width', `${right - left}px`],
                ['box-sizing', 'border-box'],
                ['padding', '0 0.25rem'],
                ['overflow', 'hidden'],
                ['white-space', 'nowrap'],
                ['text-overflow', 'ellipsis'],
                ['border-left-style', 'solid'],
                ['border-left-width', '1px'],
                ['border-left-color', color],
                ['font-size', '0.75rem'],
                ['line-height', `${laneHeight}rem`],
                ['cursor', 'pointer'],
                ['pointer-events', 'auto'],
            ]);
            box.addEventListener('click', () => go(at, 'pointer'));
            element.append(box);
        });
    }

    function refresh(): void {
        shown = all.filter((chapter) => chapter.toc);
        index = -1;
        const current = host;

        if (current !== null) {
            buildList();
            placeLane();
            follow(false);
            current.updateValueText();
            current.invalidate();
        }

        options.onChapters?.(shown);
    }

    function go(at: number, source: SeekSource): boolean {
        const current = host;
        const known = duration();
        const chapter = shown[at];

        if (current === null || known === null || chapter === undefined) {
            return false;
        }

        current.seekTo(clamp01(chapter.start / known), source);

        return true;
    }

    function step(direction: 1 | -1, source: SeekSource): number | null {
        const current = host;
        const known = duration();

        if (current === null || known === null || shown.length === 0) {
            return null;
        }

        const at = nextChapter(
            shown,
            now(current, known),
            direction,
            backGrace,
        );

        if (at !== null) {
            go(at, source);
        }

        return at;
    }

    /** The chapter whose line is under the pointer, or -1. */
    function lineAt(point: WavePoint): number {
        const known = duration();

        if (!withLines || known === null) {
            return -1;
        }

        const view = host?.view ?? FULL_VIEW;
        let best = -1;
        let distance = SLOP;

        shown.forEach((chapter, at) => {
            if (chapter.start <= 0) {
                return;
            }

            const x = viewX(clamp01(chapter.start / known), view, point.width);
            const away = Math.abs(x - point.x);

            if (away <= distance) {
                best = at;
                distance = away;
            }
        });

        return best;
    }

    function closeTooltip(): void {
        if (openedTooltip) {
            sharedTooltip().hide();
            openedTooltip = false;
        }
    }

    function apply(list: Chapter[]): void {
        all = list;
        refresh();
    }

    function begin(current: PluginHost): void {
        try {
            if (options.items !== undefined) {
                apply(readChapters(options.items));
            } else if (options.text !== undefined) {
                apply(readChapters(options.text));
            } else if (options.src !== undefined) {
                loadChapters(options.src, options.load).then(apply, (error) =>
                    host?.reportError(error),
                );
            }
        } catch (error) {
            current.reportError(error);
        }
    }

    return {
        name: 'chapters',
        layer: 'over',

        get chapters(): readonly Chapter[] {
            return shown;
        },

        get index(): number {
            return index;
        },

        get current(): Chapter | null {
            return shown[index] ?? null;
        },

        set(input): void {
            apply(input === null ? [] : readChapters(input));
        },

        load(url): Promise<void> {
            return loadChapters(url, options.load).then(apply);
        },

        go(at): boolean {
            return go(at, 'api');
        },

        next(): boolean {
            return step(1, 'api') !== null;
        },

        previous(): boolean {
            return step(-1, 'api') !== null;
        },

        setup(frame): void {
            host = frame;

            if (options.lane === 'above' || options.lane === 'below') {
                lane = frame.addLane(options.lane, remPixels(laneHeight));
                lane.element.setAttribute('aria-hidden', 'true');
                css(lane.element, [['overflow', 'hidden']]);
            }

            cleanups = [
                frame.on('timeupdate', () => follow(true)),
                frame.on('seek', () => follow(false)),
                frame.on('durationchange', () => {
                    // The last chapter's end, and so its stretch, comes with the duration.
                    buildList();
                    follow(false);
                    placeLane();
                }),
                frame.on('viewchange', () => placeLane()),
                frame.on('resize', () => placeLane()),
            ];

            if (started) {
                refresh();
            } else {
                started = true;
                begin(frame);
            }
        },

        draw(paint): void {
            const known = positive(paint.duration);

            if (!withLines || known === null || paint.width <= 0) {
                return;
            }

            const lineWidth = Math.max(
                1,
                Math.round((options.width ?? 2) * paint.pixelRatio),
            );
            paint.ctx.fillStyle = paint.color(color);

            for (const chapter of shown) {
                if (chapter.start <= 0 || chapter.start >= known) {
                    continue;
                }

                const x = paint.xAt(chapter.start / known);

                if (x < 0 || x > paint.width) {
                    continue;
                }

                paint.ctx.fillRect(
                    Math.min(
                        paint.width - lineWidth,
                        Math.max(0, Math.round(x - lineWidth / 2)),
                    ),
                    0,
                    lineWidth,
                    paint.height,
                );
            }
        },

        pointerHover(point): string | void {
            const current = host;
            const at = point === null ? -1 : lineAt(point);

            if (at < 0 || current === null) {
                closeTooltip();

                return;
            }

            if (withTooltip) {
                const chapter = shown[at];
                const background =
                    current.color('var(--sonicframe-progress, #2f6fdb)') ||
                    '#2f6fdb';
                sharedTooltip().show(
                    current.container,
                    [`${formatTime(chapter.start)} · ${label(at)}`],
                    {
                        background,
                        text: current.color(ON_PROGRESS) || '#ffffff',
                    },
                );
                openedTooltip = true;
            }

            return snap ? 'pointer' : undefined;
        },

        pointerDown(point): 'take' | void {
            return snap && lineAt(point) >= 0 ? 'take' : undefined;
        },

        pointerUp(point): void {
            const at = lineAt(point);

            if (at >= 0) {
                go(at, 'pointer');
            }
        },

        pointerCancel(): void {
            closeTooltip();
        },

        keyDown(key, modifiers): boolean {
            const current = host;

            if (
                letter === null ||
                current === null ||
                modifiers.ctrlKey ||
                modifiers.altKey ||
                modifiers.metaKey ||
                key.length !== 1 ||
                // Shift, not the letter's case, picks the direction: Caps Lock flips the case.
                key.toLowerCase() !== letter ||
                shown.length === 0 ||
                duration() === null
            ) {
                return false;
            }

            const at = step(modifiers.shiftKey === true ? -1 : 1, 'keyboard');

            current.announce(
                at === null
                    ? words.none
                    : `${label(at)}, ${formatTime(shown[at].start)}`,
            );

            return true;
        },

        valueNote(time): string | void {
            if (options.valueNote === false || time === null) {
                return;
            }

            const at = chapterAt(shown, time, duration());

            return at < 0 ? undefined : label(at);
        },

        destroy(): void {
            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            closeTooltip();
            lane?.remove();
            lane = null;
            view?.destroy();
            view = null;
            index = -1;
            host = null;
        },
    };
}
