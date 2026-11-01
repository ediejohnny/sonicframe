/** What the regions plugin takes and gives: its keys, its options and its API. */

import type { RegionWords } from '../../core/languages/words';
import type { RegionInput } from '../../core/marks/regions';
import type { Plugin } from '../../types';
import type { Region } from './region-store';

/**
 * The regions' keys while the frame has focus: a letter can be your own or `false`; each other key
 * is on unless `false`.
 */
export type RegionsKeys = {
    /** R steps through the regions (with Shift, back); `'r'` by default. */
    select?: string | false;
    /** L switches the selected region's loop; `'l'` by default. */
    loop?: string | false;
    /** Enter plays the selected region. */
    play?: boolean;
    /** `[` `]` and `{` `}` nudge its edges. */
    nudge?: boolean;
    /** Delete and Backspace remove it. */
    remove?: boolean;
    /** Escape stops it and lets it go. */
    release?: boolean;
};

export type RegionsOptions = {
    /** Regions to start with; an id is kept when no other region has it. */
    items?: readonly RegionInput[];
    /**
     * Whether the pointer creates regions: on by default, by `createGesture`. The old forms
     * `'shift-drag'` and `'drag'` still work until 2.0, as `createGesture`.
     */
    create?: boolean | 'shift-drag' | 'drag';
    /** How the pointer creates a region: Shift-drag (the default, so a plain drag still scrubs) or a plain drag. */
    createGesture?: 'shift-drag' | 'drag';
    /** Shortest region, in seconds. */
    minLength?: number;
    /** The band color (translucent). */
    color?: string;
    /** Single-key shortcuts while the frame has focus: all on by default, or each one your own. */
    keys?: boolean | RegionsKeys;
    /** The most regions kept. */
    max?: number;
    /**
     * Called after a region is created, changed or removed: once when a drag is let go, and after each
     * change by the API or the keys. Never when nothing changed.
     */
    onChange?: (regions: readonly Region[]) => void;
    /** Called at every move of a drag that changes a region (drawing, moving or resizing it). */
    onInput?: (regions: readonly Region[]) => void;
    /** Called when the selected region changes (null when none), with a copy of it. */
    onSelect?: (region: Region | null) => void;
    /** Zoomed in, a region chosen by the keys (R) is brought into view, centered. Off by default. */
    scrollIntoView?: boolean;
    /**
     * Draws the bands' edges on whole device pixels (crisper, moved by less than half a pixel). Off by
     * default: at fractions of a pixel, as always.
     */
    pixelSnap?: boolean;
    /** @deprecated Use `pixelSnap`; `snap` goes in 2.0. */
    snap?: boolean;
    /**
     * The mouse cursor (any CSS cursor): `'grab'` over a region's body, `'grabbing'` while moving
     * it, `'ew-resize'` over its edges and while resizing or drawing one.
     */
    cursors?: { body?: string; moving?: string; edge?: string };
    /** Accessibility options. */
    a11y?: {
        /** Your own words said by the keys, over those of the frame's language. */
        words?: Partial<RegionWords>;
    };
};

export type RegionsPlugin = Plugin & {
    /**
     * Adds a region and returns a copy of it, or null when `max` regions already exist or its start or
     * end is not a finite number. Its id is kept when no other region has it.
     */
    add(region: RegionInput): Region | null;
    /**
     * Changes a region; a time that is not a finite number is left as it was. Before the sound's
     * length is known, the times are ordered now and fitted to the sound later.
     */
    update(id: string, patch: Partial<Omit<Region, 'id'>>): void;
    remove(id: string): void;
    clear(): void;
    /** The regions, copies in the order they were added. */
    readonly items: readonly Region[];
    /**
     * Replaces every region at once (the selection is let go); tells `onChange` once. The first region
     * to ask for an id keeps it.
     */
    set(items: readonly RegionInput[]): void;
    /** @deprecated Use `items`; `list()` goes in 2.0. */
    list(): readonly Region[];
    play(id: string, options?: { loop?: boolean }): void;
    stop(): void;
    select(id: string | null): void;
};
