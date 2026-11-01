/**
 * A caption under the bars: one line that fades out on the right, with optional badges (an "auto"
 * mark, a language tag), and a tooltip with the fuller text on hover, keyboard focus or a tap. The
 * line is clipped by a constant gradient mask (never a gradient built from a user color), every
 * string goes in through `textContent`, and the whole text reaches screen readers through
 * `aria-describedby`. Clicking the caption never seeks: it lives in a lane, which the frame routes
 * away from the wave.
 */

import { within } from '../../core/shared/checked';
import type { CssLength } from '../../core/shared/length';
import { cleanText, truncateWords } from '../../core/shared/text';
import { addDescribedBy, removeDescribedBy } from '../../dom/a11y/describedby';
import { css, VISUALLY_HIDDEN } from '../../dom/shared/css';
import {
    sharedTooltip,
    tooltipColors,
    type TooltipA11y,
} from '../../dom/shared/tooltip';
import { lengthPixels } from '../../dom/shared/units';
import type { Lane, Plugin, PluginHost } from '../../types';

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

export type CaptionOptions = {
    /** The caption text. */
    text?: string;
    /** Up to three short marks shown before the text (e.g. `['auto', 'pt']`). */
    badges?: readonly string[];
    /** What the tooltip shows; left out, it repeats the caption text, longer. */
    tooltip?: TooltipContent;
    /** The most characters the tooltip shows before a word-boundary cut: 280. */
    tooltipMax?: number;
    /** @deprecated Use `tooltipMax`; `tooltipLimit` goes in 2.0. */
    tooltipLimit?: number;
    /** The lane's height: a number in CSS pixels, or written with its unit (`'1.25rem'`). 20 by default. */
    height?: number | CssLength;
    /** @deprecated Use `height`; `size` goes in 2.0. */
    size?: number;
    /**
     * `tooltip.readable` writes the tooltip's text in black or white, whichever reads on its color
     * (4.5:1). On by default; off, the page's color for text on the played color.
     */
    a11y?: TooltipA11y;
};

export type CaptionPlugin = Plugin & {
    /** Replaces the caption (null removes the line and gives the room back to the wave). */
    set(text: string | null): void;
    /** Replaces the tooltip content. */
    setTooltip(content: TooltipContent): void;
};

const MAX_TEXT = 2000;
const MAX_TOOLTIP = 2000;
const MAX_BADGES = 3;
const MAX_BADGE = 16;
const CLOSE_DELAY = 150;

/** A fixed fade on the line's right; the mask is a constant, never built from a user color. */
const FADE = 'linear-gradient(to right, #000 calc(100% - 24px), transparent)';

let counter = 0;

export function caption(options: CaptionOptions = {}): CaptionPlugin {
    const tooltipMax = within(
        options.tooltipMax ?? options.tooltipLimit,
        280,
        0,
        MAX_TOOLTIP,
    );
    const readable: TooltipA11y = {
        tooltip: { readable: options.a11y?.tooltip?.readable !== false },
    };
    const describedId = `sonicframe-caption-${++counter}`;

    let host: PluginHost | null = null;
    let lane: Lane | null = null;
    let text =
        options.text === undefined ? null : cleanText(options.text, MAX_TEXT);
    // null means "repeat the caption text"; a value overrides it.
    let tooltipContent: TooltipContent | null = options.tooltip ?? null;
    const cleanups: (() => void)[] = [];

    let textSpan: HTMLSpanElement | null = null;
    let fullSpan: HTMLSpanElement | null = null;
    let dismissed = false;
    let focused = false;
    let overCaption = false;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    // Listeners for the life of the plugin (cleanups) versus ones for the current lane only
    // (laneCleanups), so toggling the caption on and off does not pile up handlers.
    const laneCleanups: (() => void)[] = [];

    function listen<K extends keyof HTMLElementEventMap>(
        target: EventTarget,
        type: K,
        handler: (event: HTMLElementEventMap[K]) => void,
        into: (() => void)[] = cleanups,
    ): void {
        const listener = handler as EventListener;
        target.addEventListener(type, listener);
        into.push(() => target.removeEventListener(type, listener));
    }

    function tooltipLines(): string[] {
        if (tooltipContent === null) {
            return text === null || text === ''
                ? []
                : [truncateWords(text, tooltipMax)];
        }

        if (typeof tooltipContent === 'string') {
            return [
                truncateWords(cleanText(tooltipContent, MAX_TEXT), tooltipMax),
            ];
        }

        return tooltipContent.map((section) => {
            const body = truncateWords(
                cleanText(section.text, MAX_TEXT),
                within(
                    section.max ?? section.limit,
                    tooltipMax,
                    0,
                    MAX_TOOLTIP,
                ),
            );

            return section.label === undefined
                ? body
                : `${cleanText(section.label, 120)}: ${body}`;
        });
    }

    function open(): void {
        const current = host;
        const anchor = textSpan;

        if (current === null || anchor === null || dismissed) {
            return;
        }

        const lines = tooltipLines();

        if (lines.length === 0) {
            return;
        }

        sharedTooltip().show(anchor, lines, tooltipColors(current, readable));
    }

    function closeNow(): void {
        if (closeTimer !== null) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }

        sharedTooltip().hide();
    }

    function scheduleClose(): void {
        if (closeTimer !== null) {
            clearTimeout(closeTimer);
        }

        closeTimer = setTimeout(() => {
            closeTimer = null;
            const tip = sharedTooltip();

            if (
                !focused &&
                !overCaption &&
                !tip.contains(document.activeElement)
            ) {
                tip.hide();
            }
        }, CLOSE_DELAY);
    }

    function ensureLane(current: PluginHost): void {
        if (lane !== null) {
            return;
        }

        lane = current.addLane(
            'below',
            within(
                lengthPixels(options.height ?? options.size, 'px'),
                20,
                1,
                Number.POSITIVE_INFINITY,
            ),
        );
        const root = lane.element;
        css(root, [
            ['display', 'flex'],
            ['align-items', 'center'],
            ['gap', '6px'],
            ['font-size', '12px'],
            ['line-height', '1.3'],
        ]);

        for (const badge of (options.badges ?? []).slice(0, MAX_BADGES)) {
            const pill = document.createElement('span');
            pill.textContent = cleanText(badge, MAX_BADGE);
            css(pill, [
                ['flex', '0 0 auto'],
                ['padding', '0 4px'],
                ['border-radius', '2px'],
                [
                    'background-color',
                    'var(--sonicframe-badge, rgba(0, 0, 0, 0.08))',
                ],
                ['font-size', '10px'],
                ['text-transform', 'uppercase'],
                ['letter-spacing', '0.04em'],
            ]);
            root.append(pill);
        }

        const span = document.createElement('span');
        span.setAttribute('dir', 'auto');
        css(span, [
            ['flex', '1 1 auto'],
            ['min-width', '0'],
            ['white-space', 'nowrap'],
            ['overflow', 'hidden'],
            ['unicode-bidi', 'isolate'],
            ['pointer-events', 'auto'],
            ['-webkit-mask-image', FADE],
            ['mask-image', FADE],
        ]);

        const full = document.createElement('span');
        full.id = describedId;
        css(full, VISUALLY_HIDDEN);
        root.append(span, full);
        textSpan = span;
        fullSpan = full;

        // The tooltip opens on hover and on a tap; the frame's focus drives the keyboard case. These
        // belong to this lane, so they are dropped when the caption is cleared (not piled up).
        listen(
            span,
            'pointerenter',
            (event) => {
                if (event.pointerType === 'mouse') {
                    overCaption = true;
                    dismissed = false;
                    open();
                }
            },
            laneCleanups,
        );
        listen(
            span,
            'pointerleave',
            (event) => {
                if (event.pointerType === 'mouse') {
                    overCaption = false;
                    scheduleClose();
                }
            },
            laneCleanups,
        );
        listen(
            span,
            'pointerup',
            (event) => {
                if (event.pointerType !== 'mouse') {
                    if (sharedTooltip().open) {
                        closeNow();
                    } else {
                        dismissed = false;
                        open();
                    }
                }
            },
            laneCleanups,
        );

        render();
    }

    function render(): void {
        if (textSpan !== null) {
            textSpan.textContent = text ?? '';
        }

        if (fullSpan !== null) {
            fullSpan.textContent = text ?? '';
        }
    }

    function removeLane(current: PluginHost): void {
        closeNow();

        for (const cleanup of laneCleanups.splice(0)) {
            cleanup();
        }

        lane?.remove();
        lane = null;
        textSpan = null;
        fullSpan = null;
        removeDescribedBy(current.container, describedId);
    }

    return {
        name: 'caption',

        setup(pluginHost): void {
            host = pluginHost;

            listen(pluginHost.container, 'focusin', () => {
                focused = true;
                dismissed = false;
                open();
            });
            listen(pluginHost.container, 'focusout', () => {
                focused = false;
                scheduleClose();
            });
            listen(document, 'keydown', (event) => {
                if (event.key === 'Escape' && sharedTooltip().open) {
                    dismissed = true;
                    closeNow();
                }
            });

            // Registered once (the tooltip is shared by the page): let the pointer rest on it.
            const tip = sharedTooltip();
            listen(tip.element, 'pointerenter', () => {
                if (closeTimer !== null) {
                    clearTimeout(closeTimer);
                    closeTimer = null;
                }
            });
            listen(tip.element, 'pointerleave', () => scheduleClose());

            if (text !== null) {
                ensureLane(pluginHost);
                addDescribedBy(pluginHost.container, describedId);
            }
        },

        set(next): void {
            const current = host;
            text = next === null ? null : cleanText(next, MAX_TEXT);

            if (current === null) {
                return;
            }

            if (text === null) {
                removeLane(current);

                return;
            }

            if (lane === null) {
                ensureLane(current);
                addDescribedBy(current.container, describedId);
            } else {
                render();
            }
        },

        setTooltip(content): void {
            tooltipContent = content;
        },

        destroy(): void {
            closeNow();

            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }

            if (host !== null) {
                removeDescribedBy(host.container, describedId);
            }

            lane?.remove();
            lane = null;
            host = null;
        },
    };
}
