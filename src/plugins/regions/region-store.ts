/**
 * The regions of one regions plugin: in the order they were made, each ordered, kept inside the sound
 * and never shorter than the minimum (`normalizeRegion`), each with an id no other region has, at
 * most `max` of them; the one selected; and the loop that L switches. Labels are cleaned to one safe
 * line, and a region whose start or end is not a finite number is refused.
 */

import { normalizeRegion, type RegionInput } from '../../core/marks/regions';
import { finiteOr } from '../../core/shared/checked';
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
    /** Draws the regions again, places their labels and tells the app of a change (`onChange`). */
    changed(): void;
    /** Draws the regions again, places their labels and tells the app of a drag moving (`onInput`). */
    moved(): void;
    /** Tells the app the regions as they are now (`onChange`): a drag let go after a change. */
    told(): void;
    /** Plays a region, looping it when the loop is on. */
    play(id: string): void;
    /** Stops the region playing and lets the selection go. */
    release(): void;
    /** Removes a region: it stops playing, its selection goes, and the app is told. */
    remove(id: string): void;
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

    /**
     * `start` and `end` ordered, inside a sound `span` seconds long, and at least the minimum apart.
     * While the length is not known (`span` null), only ordered and kept to the minimum length.
     */
    normalized(
        start: number,
        end: number,
        span: number | null,
    ): {
        start: number;
        end: number;
    } {
        return normalizeRegion(
            start,
            end,
            span ?? Math.max(start, end, this.minLength),
            this.minLength,
        );
    }

    /**
     * Stores a region, or nothing (null) once `max` regions exist or when its start or end is not a
     * finite number. Its id is kept unless another region has it, or it is one of `reserved`; then it
     * gets one of its own. Until the sound's length is known (`span` null) it is only ordered and
     * kept to the minimum length; `fit` fits it in later.
     */
    add(
        item: RegionInput,
        span: number | null,
        reserved: ReadonlySet<string> = new Set(),
    ): Region | null {
        const start = finiteOr(item.start, null);
        const end = finiteOr(item.end, null);

        if (this.full || start === null || end === null) {
            return null;
        }

        const bounds = this.normalized(start, end, span);
        const asked = typeof item.id === 'string' ? item.id : '';
        const region: Region = {
            id:
                asked !== '' &&
                this.byId(asked) === undefined &&
                !reserved.has(asked)
                    ? asked
                    : this.newId(reserved),
            start: bounds.start,
            end: bounds.end,
            label: regionLabel(item.label),
            color: item.color,
        };
        this.items = [...this.items, region];

        return region;
    }

    /**
     * Replaces every region with `items`, in their order. The first region to ask for an id keeps it,
     * and the ids made for the others never take one asked for further down the list.
     */
    replace(items: readonly RegionInput[], span: number | null): void {
        const asked = new Set<string>();

        for (const item of items) {
            if (typeof item.id === 'string' && item.id !== '') {
                asked.add(item.id);
            }
        }

        this.items = [];

        for (const item of items) {
            const id = typeof item.id === 'string' ? item.id : '';
            const mine = asked.delete(id);

            // A region refused leaves its id to the next one that asks for it.
            if (this.add(item, span, asked) === null && mine) {
                asked.add(id);
            }
        }
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

    /** Removes the region `id`; whether there was one. */
    remove(id: string): boolean {
        const before = this.items.length;
        this.items = this.items.filter((region) => region.id !== id);

        return this.items.length !== before;
    }

    /** Copies of the regions, so the app can keep them. */
    list(): readonly Region[] {
        return this.items.map((region) => ({ ...region }));
    }

    /** An id no region has and none of `reserved` is. */
    private newId(reserved: ReadonlySet<string>): string {
        let id: string;

        do {
            id = `region-${++counter}`;
        } while (this.byId(id) !== undefined || reserved.has(id));

        return id;
    }
}
