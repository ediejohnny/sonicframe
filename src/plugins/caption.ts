/**
 * A caption under the bars: one line that fades out on the right, with optional badges (an "auto"
 * mark, a language tag), and a tooltip with the fuller text on hover, keyboard focus or a tap. The
 * line is clipped by a constant gradient mask (never a gradient built from a user color), every
 * string goes in through `textContent`, and the whole text reaches screen readers through
 * `aria-describedby`. Clicking the caption never seeks: it lives in a lane, which the frame routes
 * away from the wave.
 */

import { readableText } from '../core/color';
import { cleanText, truncateWords } from '../core/text';
import type { Lane, Plugin, PluginHost } from '../types';
import { readColor } from '../dom/paint';
import { sharedTooltip } from '../dom/tooltip';

/** One block of tooltip text: a `label` (e.g. "Auto-transcript") and the text, with its own cap. */
export type TooltipSection = { label?: string; text: string; limit?: number };

/** The tooltip's text: a single string, several labelled sections, or `'caption'` (the line itself). */
export type TooltipContent = string | TooltipSection[];

export type CaptionOptions = {
    /** The caption text. */
    text?: string;
    /** Up to three short marks shown before the text (e.g. `['auto', 'pt']`). */
    badges?: string[];
    /** What the tooltip shows; left out, it repeats the caption text, longer. */
    tooltip?: TooltipContent;
    /** The most characters the tooltip shows before a word-boundary cut. */
    tooltipLimit?: number;
    /** The lane's height in CSS pixels. */
    size?: number;
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

let counter = 0;

export function caption(options: CaptionOptions = {}): CaptionPlugin {
    const laneSize = Math.max(1, options.size ?? 20);
    const tooltipLimit = Math.min(MAX_TOOLTIP, options.tooltipLimit ?? 280);
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
                : [truncateWords(text, tooltipLimit)];
        }

        if (typeof tooltipContent === 'string') {
            return [
                truncateWords(
                    cleanText(tooltipContent, MAX_TEXT),
                    tooltipLimit,
                ),
            ];
        }

        return tooltipContent.map((section) => {
            const body = truncateWords(
                cleanText(section.text, MAX_TEXT),
                Math.min(MAX_TOOLTIP, section.limit ?? tooltipLimit),
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

        const background =
            current.color('var(--sonicframe-progress, #2f6fdb)') || '#2f6fdb';
        const asColor = readColor(background) ?? [47, 111, 219, 1];
        sharedTooltip().show(anchor, lines, {
            background,
            text: readableText(asColor, [255, 255, 255, 1]),
        });
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

        lane = current.addLane('below', laneSize);
        const root = lane.element;

        for (const [property, value] of [
            ['display', 'flex'],
            ['align-items', 'center'],
            ['gap', '6px'],
            ['font-size', '12px'],
            ['line-height', '1.3'],
        ]) {
            root.style.setProperty(property, value);
        }

        for (const badge of (options.badges ?? []).slice(0, MAX_BADGES)) {
            const pill = document.createElement('span');
            pill.textContent = cleanText(badge, MAX_BADGE);

            for (const [property, value] of [
                ['flex', '0 0 auto'],
                ['padding', '0 4px'],
                ['border-radius', '2px'],
                ['background-color', 'rgba(0, 0, 0, 0.08)'],
                ['font-size', '10px'],
                ['text-transform', 'uppercase'],
                ['letter-spacing', '0.04em'],
            ]) {
                pill.style.setProperty(property, value);
            }

            root.append(pill);
        }

        const span = document.createElement('span');
        span.setAttribute('dir', 'auto');

        for (const [property, value] of [
            ['flex', '1 1 auto'],
            ['min-width', '0'],
            ['white-space', 'nowrap'],
            ['overflow', 'hidden'],
            ['unicode-bidi', 'isolate'],
            ['pointer-events', 'auto'],
            // A fixed fade on the right; the mask is a constant, never built from a user color.
            [
                '-webkit-mask-image',
                'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
            ],
            [
                'mask-image',
                'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
            ],
        ]) {
            span.style.setProperty(property, value);
        }

        const full = document.createElement('span');
        full.id = describedId;

        for (const [property, value] of [
            ['position', 'absolute'],
            ['width', '1px'],
            ['height', '1px'],
            ['margin', '-1px'],
            ['padding', '0'],
            ['overflow', 'hidden'],
            ['clip-path', 'inset(50%)'],
            ['white-space', 'nowrap'],
        ]) {
            full.style.setProperty(property, value);
        }

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
        removeDescribedBy(current);
    }

    /** The ids in the frame's `aria-describedby`, whoever put them there. */
    function describedIds(current: PluginHost): string[] {
        return (current.container.getAttribute('aria-describedby') ?? '')
            .split(/\s+/)
            .filter((id) => id !== '');
    }

    /** Adds this caption's id after the ids already there (the page's own, or another plugin's). */
    function addDescribedBy(current: PluginHost): void {
        const ids = describedIds(current);

        if (!ids.includes(describedId)) {
            current.container.setAttribute(
                'aria-describedby',
                [...ids, describedId].join(' '),
            );
        }
    }

    /** Takes only this caption's id out: every other id stays, even one the page added meanwhile. */
    function removeDescribedBy(current: PluginHost): void {
        const ids = describedIds(current);

        if (!ids.includes(describedId)) {
            return;
        }

        const rest = ids.filter((id) => id !== describedId);

        if (rest.length === 0) {
            current.container.removeAttribute('aria-describedby');
        } else {
            current.container.setAttribute('aria-describedby', rest.join(' '));
        }
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
                addDescribedBy(pluginHost);
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
                addDescribedBy(current);
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
                removeDescribedBy(host);
            }

            lane?.remove();
            lane = null;
            host = null;
        },
    };
}
