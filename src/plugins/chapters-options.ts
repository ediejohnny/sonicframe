/** The chapters plugin's options and what it offers, as they are published, and its English words. */

import type {
    Chapter,
    ChapterInput,
    LoadChaptersOptions,
} from '../core/chapters/chapters';
import { EN } from '../core/languages/en';
import type { ChapterWords } from '../core/languages/words';
import type { Plugin } from '../types';
import type { ChapterListLook } from './chapter-list';

export const CHAPTER_WORDS: Readonly<ChapterWords> = Object.freeze({
    ...EN.chapters,
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
