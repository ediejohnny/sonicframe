/**
 * The regions of one regions plugin: in the order they were made, each ordered, kept inside the sound
 * and never shorter than the minimum (`normalizeRegion`), at most `max` of them; the one selected;
 * and the loop that L switches. Labels are cleaned to one safe line.
 */

import { normalizeRegion } from '../../core/marks/regions';
import { cleanText } from '../../core/shared/text';
import type { PluginHost } from '../../types';

/** A region, in seconds. */
export type Region = {
    id: string;
    start: number;
    end: number;
    label?: string;
    color?: string;
};

/** What the regions' pointer and keys need from their plugin. */
export type RegionsHost = {
    readonly store: RegionStore;
    /** The frame, while the plugin is set up. */
    frame(): PluginHost | null;
    /** The sound's length, in seconds, or null while it is not known. */
    duration(): number | null;
    select(id: string | null): void;
    /** Draws the regions again, places their labels and tells the app. */
    changed(): void;
    /** Tells the app the regions as they are now (a drag let go). */
    told(): void;
    /** Plays a region, looping it when the loop is on. */
    play(id: string): void;
};

/** The longest label, in characters. */
const MAX_LABEL = 120;

let counter = 0;

/** A label from outside, cleaned to one safe line, or none. */
export function regionLabel(label: string | undefined): string | undefined {
    return label === undefined ? undefined : cleanText(label, MAX_LABEL);
}

export class RegionStore {
    /** In the order they were made. */
    items: Region[] = [];
    selectedId: string | null = null;
    /** Whether Enter (and `play` without its own choice) loops the region. */
    loop = false;

    constructor(
        private readonly minLength: number,
        private readonly max: number,
    ) {}

    /** Whether `max` regions exist already. */
    get full(): boolean {
        return this.items.length >= this.max;
    }

    byId(id: string): Region | undefined {
        return this.items.find((region) => region.id === id);
    }

    /** `start` and `end` ordered, inside a sound `span` seconds long, and at least the minimum apart. */
    normalized(
        start: number,
        end: number,
        span: number,
    ): {
        start: number;
        end: number;
    } {
        return normalizeRegion(start, end, span, this.minLength);
    }

    /**
     * Stores a region, or nothing (null) once `max` regions exist. Until the sound's length is known
     * (`span` null) it is only ordered and kept to the minimum length; `fit` fits it in later.
     */
    add(
        item: Omit<Region, 'id'> & { id?: string },
        span: number | null,
    ): Region | null {
        if (this.full) {
            return null;
        }

        const bounds = this.normalized(
            item.start,
            item.end,
            span ?? Math.max(item.start, item.end, this.minLength),
        );
        const region: Region = {
            id: item.id ?? `region-${++counter}`,
            start: bounds.start,
            end: bounds.end,
            label: regionLabel(item.label),
            color: item.color,
        };
        this.items = [...this.items, region];

        return region;
    }

    /** Fits every region inside a sound `span` seconds long; true when one of them moved. */
    fit(span: number): boolean {
        let moved = false;

        for (const region of this.items) {
            const bounds = this.normalized(region.start, region.end, span);

            if (bounds.start !== region.start || bounds.end !== region.end) {
                region.start = bounds.start;
                region.end = bounds.end;
                moved = true;
            }
        }

        return moved;
    }

    remove(id: string): void {
        this.items = this.items.filter((region) => region.id !== id);
    }

    /** Copies of the regions, so the app can keep them. */
    list(): readonly Region[] {
        return this.items.map((region) => ({ ...region }));
    }
}
