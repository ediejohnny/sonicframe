/**
 * The plugins a frame hosts, in the order they were added. Every hook runs guarded: a plugin whose
 * hook throws is parked (left out from then on) and its error reported, so it never breaks the
 * frame or the other plugins. A key, a press and the hover go to the newest plugin first; drawing
 * and the notes on the slider's value go in order.
 */

import { cleanText } from '../../core/shared/text';
import type {
    FrameGeometry,
    PaintContext,
    Plugin,
    PluginHost,
    PointerClaim,
    WavePoint,
} from '../../types';

/** The longest note a plugin adds to the slider's value, in characters. */
const MAX_NOTE = 120;

export class PluginSet {
    private readonly list: Plugin[] = [];
    private readonly failed = new WeakSet<Plugin>();

    /** `report` hears every error a plugin throws. */
    constructor(private readonly report: (error: unknown) => void) {}

    /** Adds a plugin and sets it up on `host`; a setup that throws is reported, and the plugin stays. */
    add(plugin: Plugin, host: PluginHost): void {
        this.list.push(plugin);

        try {
            plugin.setup?.(host);
        } catch (error) {
            this.report(error);
        }
    }

    /** Takes a plugin out and destroys it; false when it was not there. */
    remove(plugin: Plugin): boolean {
        const index = this.list.indexOf(plugin);

        if (index < 0) {
            return false;
        }

        this.list.splice(index, 1);
        this.destroy(plugin);

        return true;
    }

    /** Destroys every plugin, the newest first. */
    clear(): void {
        for (const plugin of this.list.splice(0).reverse()) {
            this.destroy(plugin);
        }
    }

    /** Runs a hook of `plugin`, parking the plugin when it throws; gives back what the hook gave. */
    run<T>(plugin: Plugin, hook: () => T): T | undefined {
        try {
            return hook();
        } catch (error) {
            this.failed.add(plugin);
            this.report(error);

            return undefined;
        }
    }

    /** Offers a press to the plugins, the newest first; the one that claimed it, and how. */
    claim(point: WavePoint): { plugin: Plugin; claim: PointerClaim } | null {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const plugin = this.list[i];

            if (plugin.pointerDown === undefined || this.failed.has(plugin)) {
                continue;
            }

            const claim = this.run(plugin, () => plugin.pointerDown?.(point));

            if (claim === 'take' || claim === 'drag') {
                return { plugin, claim };
            }
        }

        return null;
    }

    /**
     * The cursor the newest plugin asks for over `point`, or none. During a plugin's drag only that
     * plugin (`only`) is asked, so its cursor holds while it drags.
     */
    cursor(point: WavePoint | null, only: Plugin | null): string | undefined {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const plugin = this.list[i];

            if (
                plugin.pointerHover === undefined ||
                this.failed.has(plugin) ||
                (only !== null && plugin !== only)
            ) {
                continue;
            }

            const asked = this.run(plugin, () => plugin.pointerHover?.(point));

            if (typeof asked === 'string') {
                return asked;
            }
        }

        return undefined;
    }

    /** Offers a key to the plugins, the newest first; whether one took it. */
    key(event: KeyboardEvent): boolean {
        const modifiers = {
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            repeat: event.repeat,
        };

        for (let i = this.list.length - 1; i >= 0; i--) {
            const plugin = this.list[i];

            if (plugin.keyDown === undefined || this.failed.has(plugin)) {
                continue;
            }

            if (
                this.run(plugin, () =>
                    plugin.keyDown?.(event.key, modifiers),
                ) === true
            ) {
                return true;
            }
        }

        return false;
    }

    /** The notes the plugins add to the slider's value at a position, each cleaned to one line. */
    notes(time: number | null, ratio: number): string[] {
        const notes: string[] = [];

        for (const plugin of this.list) {
            if (plugin.valueNote === undefined || this.failed.has(plugin)) {
                continue;
            }

            const note = this.run(plugin, () =>
                plugin.valueNote?.(time, ratio),
            );

            if (typeof note === 'string') {
                const clean = cleanText(note, MAX_NOTE);

                if (clean !== '') {
                    notes.push(clean);
                }
            }
        }

        return notes;
    }

    /** Draws the plugins of one layer, each in a canvas state of its own. */
    draw(layer: 'under' | 'over', paint: PaintContext): void {
        for (const plugin of this.list) {
            if (
                plugin.draw === undefined ||
                (plugin.layer ?? 'over') !== layer ||
                this.failed.has(plugin)
            ) {
                continue;
            }

            paint.ctx.save();

            try {
                plugin.draw(paint);
            } catch (error) {
                // A broken plugin is skipped from now on instead of failing every picture.
                this.failed.add(plugin);
                this.report(error);
            } finally {
                paint.ctx.restore();
            }
        }
    }

    /** Tells every plugin, or only `plugin`, the wave area's new size. */
    resize(geometry: FrameGeometry, plugin?: Plugin): void {
        for (const each of plugin === undefined ? this.list : [plugin]) {
            if (each.resize === undefined || this.failed.has(each)) {
                continue;
            }

            try {
                each.resize(geometry);
            } catch (error) {
                // A broken plugin is skipped from now on instead of failing every resize.
                this.failed.add(each);
                this.report(error);
            }
        }
    }

    private destroy(plugin: Plugin): void {
        try {
            plugin.destroy?.();
        } catch (error) {
            this.report(error);
        }
    }
}
