/**
 * A timeline: a thin ruler in a lane above or below the bars, with labels on round seconds and
 * minutes (`niceTicks`) and optional minor marks between them. It is `aria-hidden` (the slider
 * already speaks the position) and rebuilds when the frame resizes or the duration becomes known.
 */

import { niceTicks } from '../core/ticks';
import { formatTime } from '../core/timing';
import type { Plugin, PluginHost } from '../types';

export type TimelineOptions = {
    /** Which side of the bars the ruler sits on. */
    side?: 'above' | 'below';
    /** The lane's height in CSS pixels. */
    size?: number;
    /** Least space between labels, in CSS pixels. */
    minSpacing?: number;
    /** Formats a moment; the default is `m:ss` (with a decimal for sub-second steps). */
    format?: (seconds: number) => string;
    /** The ruler color (CSS, `var()` allowed). */
    color?: string;
    /** Draw a short mark halfway between labels. */
    minor?: boolean;
};

export function timeline(options: TimelineOptions = {}): Plugin {
    const side = options.side ?? 'below';
    const size = Math.max(1, options.size ?? 14);
    const minSpacing = Math.max(8, options.minSpacing ?? 48);
    const color = options.color ?? 'var(--sonicframe-timeline, #8a94a6)';
    const minor = options.minor ?? true;

    let host: PluginHost | null = null;
    let lane: { element: HTMLElement; remove(): void } | null = null;
    let unsubscribe: (() => void) | null = null;
    let lastDuration: number | null = null;

    function label(step: number): (seconds: number) => string {
        return (
            options.format ??
            ((seconds) => formatTime(seconds, step < 1 ? 1 : 0))
        );
    }

    function mark(left: number, height: string): HTMLElement {
        const tick = document.createElement('span');

        for (const [property, value] of [
            ['position', 'absolute'],
            ['bottom', '0'],
            ['left', `${left}%`],
            ['width', '1px'],
            ['height', height],
            ['background', 'currentColor'],
        ]) {
            tick.style.setProperty(property, value);
        }

        return tick;
    }

    function rebuild(): void {
        const frame = host;
        const geometry = frame?.geometry ?? null;

        if (frame === null || lane === null || geometry === null) {
            return;
        }

        const duration = frame.duration;
        lane.element.replaceChildren();

        if (duration === null) {
            return;
        }

        const widthCss = geometry.width / geometry.pixelRatio;
        const { step, times } = niceTicks(duration, widthCss, minSpacing);

        if (step <= 0) {
            return;
        }

        const text = label(step);

        for (const time of times) {
            const left = (time / duration) * 100;
            lane.element.append(mark(left, '4px'));

            if (minor && time + step / 2 <= duration + 1e-6) {
                lane.element.append(
                    mark(((time + step / 2) / duration) * 100, '2px'),
                );
            }

            const span = document.createElement('span');
            span.textContent = text(time);

            for (const [property, value] of [
                ['position', 'absolute'],
                ['top', '0'],
                ['left', `${left}%`],
                ['font-size', '9px'],
                ['white-space', 'nowrap'],
                [
                    'transform',
                    time === 0
                        ? 'none'
                        : time >= duration - step / 2
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                ],
            ]) {
                span.style.setProperty(property, value);
            }

            lane.element.append(span);
        }
    }

    function refresh(): void {
        if (host !== null && host.duration !== lastDuration) {
            lastDuration = host.duration;
            rebuild();
        }
    }

    return {
        name: 'timeline',

        setup(frame): void {
            host = frame;
            lane = frame.addLane(side, size);
            lane.element.setAttribute('aria-hidden', 'true');
            lane.element.style.setProperty('color', color);
            lane.element.style.setProperty('overflow', 'hidden');
            unsubscribe = frame.on('timeupdate', () => refresh());
            rebuild();
        },

        resize(): void {
            rebuild();
        },

        destroy(): void {
            unsubscribe?.();
            lane?.remove();
            lane = null;
            host = null;
        },
    };
}
