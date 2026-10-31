/**
 * A frame's colors as the page computes them. Each CSS color or `var()` is read from the container's
 * computed style once and remembered; the palette the wave paints with (with the hover colors mixed
 * from the wave and the played colors when they are `'auto'`) is resolved once, until a color or the
 * page's theme changes.
 */

import {
    hoverColors,
    mixColors,
    resolveColor,
    rgbaString,
} from '../core/color';
import type { Colors } from '../types';
import { readColor, type Palette } from './paint';

/** How much of the way from the played color to the wave color an `'auto'` hover sits. */
const HOVER_MIX = 0.5;

export class FrameColors {
    private readonly cache = new Map<string, string>();
    private resolved: Palette | null = null;

    constructor(
        private readonly element: HTMLElement,
        private colors: Colors,
    ) {}

    /** A CSS color as the page computes it now, `var()` followed; '' for a variable the page lacks. */
    color(value: string): string {
        let resolved = this.cache.get(value);

        if (resolved === undefined) {
            const style = getComputedStyle(this.element);
            resolved = resolveColor(value, (name) =>
                style.getPropertyValue(name),
            );
            this.cache.set(value, resolved);
        }

        return resolved;
    }

    /** The palette the wave paints with. */
    palette(): Palette {
        return (this.resolved ??= this.resolve());
    }

    /** Lays new colors over the frame's; the palette is resolved again. */
    set(colors: Partial<Colors>): void {
        this.colors = { ...this.colors, ...colors };
        this.resolved = null;
    }

    /** Reads every color again, once the page's colors changed (a theme, the system's scheme). */
    forget(): void {
        this.resolved = null;
        this.cache.clear();
    }

    private resolve(): Palette {
        const wave = this.color(this.colors.wave) || 'gray';
        const progress = this.color(this.colors.progress) || 'currentColor';
        let hover: string | null = null;

        if (this.colors.hover === 'auto') {
            const from = readColor(progress);
            const to = readColor(wave);
            hover =
                from !== null && to !== null
                    ? rgbaString(mixColors(from, to, HOVER_MIX))
                    : progress;
        } else if (this.colors.hover !== null) {
            hover = this.color(this.colors.hover) || null;
        }

        const auto =
            this.colors.waveHover === 'auto' ||
            this.colors.progressHover === 'auto'
                ? this.autoHover(wave, progress)
                : null;

        return {
            wave,
            progress,
            hover,
            cursor:
                this.colors.cursor === null
                    ? null
                    : this.color(this.colors.cursor) || null,
            waveHover: this.hoverColor(this.colors.waveHover, auto?.wave),
            progressHover: this.hoverColor(
                this.colors.progressHover,
                auto?.progress,
            ),
            knob:
                this.colors.knob == null
                    ? null
                    : this.color(this.colors.knob) || null,
        };
    }

    /** The `'auto'` hover colors, read back from the resolved wave and progress; null if unreadable. */
    private autoHover(
        wave: string,
        progress: string,
    ): { wave: string; progress: string } | null {
        const from = readColor(wave);
        const to = readColor(progress);

        if (from === null || to === null) {
            return null;
        }

        const colors = hoverColors(from, to);

        return {
            wave: rgbaString(colors.waveHover),
            progress: rgbaString(colors.progressHover),
        };
    }

    /** Resolves one hover color: null stays off, `'auto'` uses the computed one, else a CSS color. */
    private hoverColor(
        setting: string | null,
        automatic: string | undefined,
    ): string | null {
        if (setting === null) {
            return null;
        }

        if (setting === 'auto') {
            return automatic ?? null;
        }

        return this.color(setting) || null;
    }
}
