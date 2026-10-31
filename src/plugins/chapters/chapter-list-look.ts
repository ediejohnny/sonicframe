/**
 * How the chapters list's items look, checked: known values only, sizes in range.
 */

import { within } from '../../core/shared/checked';

/** How the list's items look; each left out keeps its default. */
export type ChapterListLook = {
    /** The picture's width, in rem: 3.5 by default, from 1 to 12. */
    thumbWidth?: number;
    /** `'square'` (the default) or `'wide'` (16:9). */
    thumbShape?: 'square' | 'wide';
    /** The picture's corner radius, in rem: 0.25 by default, from 0 to 2. */
    thumbCorner?: number;
    /** The column with each chapter's number (and the playing mark). On by default. */
    numbers?: boolean;
    /** Sound bars in place of the number of the chapter playing. On by default. */
    playingMark?: boolean;
    /** The stretch under the title ("0:25 – 0:50"). On by default. */
    span?: boolean;
    /** The chapter's length on its picture. On by default. */
    length?: boolean;
    /** A thin bar under the chapter playing, filled as it plays. On by default. */
    progress?: boolean;
    /** The chapter playing tinted in the played color. On by default. */
    tint?: boolean;
    /** The most lines a title takes before it is cut: 2 by default, from 1 to 4. */
    titleLines?: number;
    /** Space inside each item, in rem: 0.375 by default, from 0 to 2. */
    itemPadding?: number;
    /** Each item's corner radius, in rem: 0.25 by default, from 0 to 2. */
    itemCorner?: number;
    /** Space between items, in rem: 0.125 by default, from 0 to 2. */
    gap?: number;
};

export type ListLook = Required<ChapterListLook>;

/** The look asked for, checked: known values only, sizes in range. */
export function resolveListLook(look: ChapterListLook = {}): ListLook {
    return {
        thumbWidth: within(look.thumbWidth, 3.5, 1, 12),
        thumbShape: look.thumbShape === 'wide' ? 'wide' : 'square',
        thumbCorner: within(look.thumbCorner, 0.25, 0, 2),
        numbers: look.numbers !== false,
        playingMark: look.playingMark !== false,
        span: look.span !== false,
        length: look.length !== false,
        progress: look.progress !== false,
        tint: look.tint !== false,
        titleLines: Math.round(within(look.titleLines, 2, 1, 4)),
        itemPadding: within(look.itemPadding, 0.375, 0, 2),
        itemCorner: within(look.itemCorner, 0.25, 0, 2),
        gap: within(look.gap, 0.125, 0, 2),
    };
}
