/**
 * One field of every chapter in a list, to compare a reading with what was written.
 */

import type { Chapter } from '../../../src/core/chapters/chapters';

export const starts = (chapters: readonly Chapter[]): number[] =>
    chapters.map((chapter) => chapter.start);
export const titles = (chapters: readonly Chapter[]): string[] =>
    chapters.map((chapter) => chapter.title);
