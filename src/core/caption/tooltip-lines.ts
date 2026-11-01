/** What a caption's tooltip says: its text or sections, cleaned and cut at a word boundary. */

import { within } from '../shared/checked';
import { cleanText, truncateWords } from '../shared/text';

/** One block of tooltip text: a `label` (e.g. "Auto-transcript") and the text, with its own cap. */
export type TooltipSection = {
    label?: string;
    text: string;
    /** The most characters this section shows; the caption's `tooltipMax` by default. */
    max?: number;
    /** @deprecated Use `max`; `limit` goes in 2.0. */
    limit?: number;
};

/** The tooltip's text: a single string, or several labelled sections. */
export type TooltipContent = string | readonly TooltipSection[];

/** The longest text taken from the app, in characters. */
export const MAX_CAPTION_TEXT = 2000;

/** The most characters a tooltip or a section shows. */
const MAX_TOOLTIP = 2000;

/** The longest section label, in characters. */
const MAX_LABEL = 120;

/**
 * The tooltip's lines: the caption `text` itself when `content` is null, the `content` text, or one
 * line per section (`label: text`). Each is cut at `max` characters, a section at its own `max`.
 */
export function tooltipLines(
    content: TooltipContent | null,
    text: string | null,
    max: number,
): string[] {
    if (content === null) {
        return text === null || text === '' ? [] : [truncateWords(text, max)];
    }

    if (typeof content === 'string') {
        return [truncateWords(cleanText(content, MAX_CAPTION_TEXT), max)];
    }

    return content.map((section) => {
        const body = truncateWords(
            cleanText(section.text, MAX_CAPTION_TEXT),
            within(section.max ?? section.limit, max, 0, MAX_TOOLTIP),
        );

        return section.label === undefined
            ? body
            : `${cleanText(section.label, MAX_LABEL)}: ${body}`;
    });
}

/** The tooltip's cap from the app's `tooltipMax` (or the old `tooltipLimit`): 280 unless given. */
export function tooltipMax(value: unknown): number {
    return within(value, 280, 0, MAX_TOOLTIP);
}
