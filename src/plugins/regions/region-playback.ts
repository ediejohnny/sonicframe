/**
 * The region whose stretch the plugin started, while it still plays: forgotten when the stretch
 * ends or a seek leaves the region (as the frame's own range is), so taking a region away stops only
 * the stretch that is still its own.
 */

import type { PluginHost, SeekEvent } from '../../types';
import type { Region } from './region-store';

/** How far before a region's start a seek still counts as inside it, in seconds (as the frame's range). */
const SLACK = 0.05;

export class RegionPlayback {
    private playingId: string | null = null;

    /** Plays `region` on `host`, looping when asked. */
    play(host: PluginHost, region: Region, loop: boolean): void {
        host.playRange(region.start, region.end, { loop });
        this.playingId = region.id;
    }

    /** Stops any stretch playing on `host`. */
    stop(host: PluginHost | null): void {
        host?.stopRange();
        this.playingId = null;
    }

    /** Stops the stretch when its region is no longer among the regions (`find` gives none). */
    stopGone(
        host: PluginHost | null,
        find: (id: string) => Region | undefined,
    ): void {
        if (this.playingId !== null && find(this.playingId) === undefined) {
            this.stop(host);
        }
    }

    /** A seek out of the region playing ends its stretch. */
    seeked(event: SeekEvent, find: (id: string) => Region | undefined): void {
        const region =
            this.playingId === null ? undefined : find(this.playingId);

        if (
            region === undefined ||
            event.time === null ||
            event.time < region.start - SLACK ||
            event.time > region.end
        ) {
            this.playingId = null;
        }
    }

    /** The stretch ended by itself. */
    ended(): void {
        this.playingId = null;
    }
}
