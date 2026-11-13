/**
 * Chapters on the wave: a line where each chapter starts, its name in the shared tooltip, a click on
 * a line to go there, C / Shift+C to step through them (like next and previous track), the chapter in
 * the slider's value in words, and, when asked, a strip of titles over or under the wave and a list
 * in an element of the app. The chapters come from a list, WebVTT or Podcasting 2.0 JSON text, or an
 * address (see `readChapters`); chapters marked out of the table of contents are left out. Text only
 * ever goes in as text, and an image or a link only from a web or relative address. The chapters
 * stay when the plugin is set up again (a player rebuilt), without fetching the file again. The lines
 * are `ChapterLines`, the strip `ChapterLane` and the list `ChapterListView`; the options are in
 * `chapters-options.ts`.
 */

import {
    chapterAt,
    chapterEnds,
    chapterLimits,
    loadChapters,
    nextChapter,
    readChapters,
    type Chapter,
} from '../../core/chapters/chapters';
import { wordsFor } from '../../core/languages/language';
import { mergeWords } from '../../core/languages/merge-words';
import { finiteOr, within } from '../../core/shared/checked';
import { letterKeys, letterStep } from '../../core/shared/keys';
import { clamp01, positive } from '../../core/shared/math';
import { fillTemplate } from '../../core/shared/text';
import { formatTime } from '../../core/shared/timing';
import { lengthPixels, remPixels } from '../../dom/shared/units';
import type { PluginHost, SeekSource } from '../../types';
import { ChapterLane, laneSide, type LaneHost } from './chapter-lane';
import { ChapterLines } from './chapter-lines';
import { ChapterListView } from './chapter-list';
import {
    CHAPTER_WORDS,
    type ChaptersOptions,
    type ChaptersPlugin,
} from './chapters-options';

/** The longest word taken from the app, in characters. */
const MAX_WORD = 120;

export function chapters(options: ChaptersOptions = {}): ChaptersPlugin {
    const own = { ...options.words, ...options.a11y?.words };
    const announce =
        (options.a11y?.announce ?? options.announceChange) === true;
    const valueNote = (options.a11y?.valueNote ?? options.valueNote) !== false;
    let words = mergeWords(CHAPTER_WORDS, own, MAX_WORD);
    const { letter, backGrace } = letterKeys(options.keys, 'c');
    const color = options.color ?? 'var(--sonicframe-chapter, #6b7280)';
    const onChapterChange = options.onChapterChange ?? options.onChange;
    const laneAt = laneSide(options.lane, options.lanePlacement);

    let all: Chapter[] = [];
    let shown: Chapter[] = [];
    let index = -1;
    let host: PluginHost | null = null;
    let started = false;
    let lane: ChapterLane | null = null;
    let view: ChapterListView | null = null;
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
            announce &&
            next >= 0 &&
            current !== null &&
            current.media !== null &&
            !current.media.paused
        ) {
            current.announce(label(next));
        }

        onChapterChange?.(shown[next] ?? null, next);
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

    function refresh(): void {
        shown = all.filter((chapter) => chapter.toc);
        index = -1;
        const current = host;

        if (current !== null) {
            buildList();
            lane?.place();
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

    function apply(list: Chapter[]): void {
        all = list;
        refresh();
    }

    function begin(current: PluginHost): void {
        try {
            if (options.items !== undefined) {
                apply(readChapters(options.items, chapterLimits(options.load)));
            } else if (options.text !== undefined) {
                apply(readChapters(options.text, chapterLimits(options.load)));
            } else if (options.src !== undefined) {
                loadChapters(options.src, options.load).then(apply, (error) =>
                    host?.reportError(error),
                );
            }
        } catch (error) {
            current.reportError(error);
        }
    }

    const parts: LaneHost = {
        frame: () => host,
        duration,
        shown: () => shown,
        label,
        go,
    };
    const lines = new ChapterLines(parts, {
        lines: options.lines !== false,
        color,
        width: finiteOr(options.width, 2),
        tooltip: options.tooltip !== false,
        snap: options.snap !== false,
        a11y: options.a11y,
    });

    return {
        name: 'chapters',
        layer: 'over',

        get items(): readonly Chapter[] {
            return shown;
        },

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
            apply(
                input === null
                    ? []
                    : readChapters(input, chapterLimits(options.load)),
            );
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
            words = mergeWords(wordsFor(frame.lang).chapters, own, MAX_WORD);

            if (laneAt !== null) {
                lane = new ChapterLane(
                    frame,
                    laneAt,
                    within(
                        lengthPixels(options.laneHeight, 'rem'),
                        remPixels(1.25),
                        remPixels(0.5),
                        remPixels(4),
                    ),
                    color,
                    parts,
                );
            }

            cleanups = [
                frame.on('timeupdate', () => follow(true)),
                frame.on('seek', () => follow(false)),
                frame.on('durationchange', () => {
                    // The last chapter's end, and so its stretch, comes with the duration.
                    buildList();
                    follow(false);
                    lane?.place();
                }),
                frame.on('viewchange', () => lane?.place()),
                frame.on('resize', () => lane?.place()),
            ];

            if (started) {
                refresh();
            } else {
                started = true;
                begin(frame);
            }
        },

        draw(paint): void {
            lines.draw(paint);
        },

        pointerHover(point): string | void {
            return lines.hover(point);
        },

        pointerDown(point): 'take' | void {
            return lines.down(point);
        },

        pointerUp(point): void {
            lines.up(point);
        },

        pointerCancel(): void {
            lines.close();
        },

        keyDown(key, modifiers): boolean {
            const current = host;
            const way = letterStep(key, modifiers, letter);

            if (
                way === null ||
                current === null ||
                shown.length === 0 ||
                duration() === null
            ) {
                return false;
            }

            const at = step(way, 'keyboard');

            current.announce(
                at === null
                    ? words.none
                    : `${label(at)}, ${formatTime(shown[at].start)}`,
            );

            return true;
        },

        valueNote(time): string | void {
            if (!valueNote || time === null) {
                return;
            }

            const at = chapterAt(shown, time, duration());

            return at < 0 ? undefined : label(at);
        },

        destroy(): void {
            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            lines.close();
            lane?.remove();
            lane = null;
            view?.destroy();
            view = null;
            index = -1;
            host = null;
        },
    };
}
