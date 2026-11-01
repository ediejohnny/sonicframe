/**
 * The regions' keys while the frame has focus: R and Shift+R step through the regions in order (the
 * place said, and zoomed in, brought into view when asked), Enter plays the one selected, L switches
 * its loop, `[` `]` and `{` `}` nudge its edges, Delete or Backspace removes it and Escape stops it
 * and lets it go. Each can be turned off, and R and L can be other letters. A key with Ctrl, Alt or
 * Meta is never the regions'.
 */

import type { KeyModifiers } from '../../core/frame/keys';
import { wordsFor } from '../../core/languages/language';
import { mergeWords } from '../../core/languages/merge-words';
import type { RegionWords } from '../../core/languages/words';
import { keyLetter } from '../../core/shared/keys';
import { clamp01 } from '../../core/shared/math';
import { fillTemplate } from '../../core/shared/text';
import { formatTime } from '../../core/shared/timing';
import type { Region, RegionsHost } from './region-store';
import type { RegionsKeys } from './regions-options';

/** How far a nudge moves an edge, in seconds. */
const NUDGE = 0.5;

/** The longest word taken from the app, in characters. */
const MAX_WORD = 120;

export class RegionKeys {
    private readonly select: string | null;
    private readonly loop: string | null;
    private readonly keys: RegionsKeys;

    constructor(
        private readonly host: RegionsHost,
        /** Zoomed in, a region chosen by R is brought into view, centered. */
        private readonly scrollIntoView: boolean,
        /** The app's own words, over those of the frame's language. */
        private readonly own: Partial<RegionWords> | undefined,
        /** The keys on (each one unless false), or null for none. */
        keys: RegionsKeys | null,
    ) {
        this.keys = keys ?? {
            select: false,
            loop: false,
            play: false,
            nudge: false,
            remove: false,
            release: false,
        };
        this.select = keyLetter(this.keys.select, 'r');
        this.loop = keyLetter(this.keys.loop, 'l');
    }

    /** The words said, in the frame's language. */
    private words(): RegionWords {
        return mergeWords(
            wordsFor(this.host.frame()?.lang).regions,
            this.own,
            MAX_WORD,
        );
    }

    /** Whether the key was the regions' (and so done). */
    down(
        key: string,
        modifiers: KeyModifiers & { shiftKey?: boolean },
    ): boolean {
        if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) {
            return false;
        }

        const { store } = this.host;
        const selectedId = store.selectedId;

        const on = this.keys;

        // Shift, not the letter's case, picks the direction: Caps Lock flips the case.
        if (this.select !== null && key.toLowerCase() === this.select) {
            return this.step(modifiers.shiftKey === true);
        }

        if (on.play !== false && key === 'Enter' && selectedId !== null) {
            this.host.play(selectedId);

            return true;
        }

        // A held L switches the loop once, not at every repeat.
        if (
            this.loop !== null &&
            key.toLowerCase() === this.loop &&
            selectedId !== null &&
            modifiers.repeat !== true
        ) {
            store.loop = !store.loop;
            const words = this.words();
            this.host
                .frame()
                ?.announce(store.loop ? words.loopOn : words.loopOff);

            return true;
        }

        if (on.nudge !== false && (key === '[' || key === '{')) {
            this.nudge('start', key === '[' ? -NUDGE : NUDGE);

            return selectedId !== null;
        }

        if (on.nudge !== false && (key === ']' || key === '}')) {
            this.nudge('end', key === ']' ? NUDGE : -NUDGE);

            return selectedId !== null;
        }

        if (
            on.remove !== false &&
            (key === 'Delete' || key === 'Backspace') &&
            selectedId !== null
        ) {
            this.host.remove(selectedId);

            return true;
        }

        if (on.release !== false && key === 'Escape' && selectedId !== null) {
            this.host.release();

            return true;
        }

        return false;
    }

    /**
     * Selects the next region in order (the one before, `back`), says where it is and shows it;
     * false when there is no region to select.
     */
    private step(back: boolean): boolean {
        const { items, selectedId } = this.host.store;

        if (items.length === 0) {
            return false;
        }

        const order = [...items].sort((a, b) => a.start - b.start);
        const at = order.findIndex((region) => region.id === selectedId);
        const next =
            at < 0 ? 0 : (at + (back ? -1 : 1) + order.length) % order.length;
        const region = order[next];
        this.host.select(region.id);
        this.announce(region);

        if (this.scrollIntoView) {
            this.reveal(region);
        }

        return true;
    }

    /** Says the region's label, then where it is. */
    private announce(region: Region): void {
        const place = fillTemplate(this.words().place, {
            from: formatTime(region.start),
            to: formatTime(region.end),
        });
        this.host
            .frame()
            ?.announce(
                region.label === undefined
                    ? place
                    : `${region.label}, ${place}`,
            );
    }

    /** Zoomed in, centers the view on a region (or on its start when it is longer than the view). */
    private reveal(region: Region): void {
        const frame = this.host.frame();
        const span = this.host.duration();

        if (frame === null || span === null) {
            return;
        }

        const { start, end } = frame.view;
        const size = end - start;
        const from = clamp01(region.start / span);
        const to = clamp01(region.end / span);

        if (from >= start && to <= end) {
            return;
        }

        const begin = to - from <= size ? (from + to) / 2 - size / 2 : from;
        frame.setView(begin, begin + size, 'keys');
    }

    /** Moves an edge of the region selected by `by` seconds, the region kept whole and in the sound. */
    private nudge(part: 'start' | 'end', by: number): void {
        const { store } = this.host;
        const span = this.host.duration();
        const region =
            store.selectedId === null
                ? undefined
                : store.byId(store.selectedId);

        if (region === undefined || span === null) {
            return;
        }

        const bounds =
            part === 'start'
                ? store.normalized(region.start + by, region.end, span)
                : store.normalized(region.start, region.end + by, span);

        if (bounds.start !== region.start || bounds.end !== region.end) {
            region.start = bounds.start;
            region.end = bounds.end;
            this.host.changed();
        }
    }
}
