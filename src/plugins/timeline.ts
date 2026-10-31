/**
 * A timeline: a thin ruler in a lane above or below the bars, with labels on round seconds and
 * minutes (`niceTicks`) and optional minor marks between them. Zoomed in, it marks the part in view,
 * down to tenths of a second. It is `aria-hidden` (the slider already speaks the position) and is
 * laid again when the frame resizes, the duration becomes known or changes, or the view moves,
 * reusing its elements.
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
    let unsubscribe: (() => void)[] = [];
    /** The elements laid so far, reused from one layout to the next; extras are hidden. */
    const majors: HTMLElement[] = [];
    const minors: HTMLElement[] = [];
    const labels: HTMLElement[] = [];

    function label(step: number): (seconds: number) => string {
        return (
            options.format ??
            ((seconds) => formatTime(seconds, step < 1 ? 1 : 0))
        );
    }

    function mark(height: string): HTMLElement {
        const tick = document.createElement('span');

        for (const [property, value] of [
            ['position', 'absolute'],
            ['bottom', '0'],
            ['width', '1px'],
            ['height', height],
            ['background', 'currentColor'],
        ]) {
            tick.style.setProperty(property, value);
        }

        return tick;
    }

    function text(): HTMLElement {
        const span = document.createElement('span');

        for (const [property, value] of [
            ['position', 'absolute'],
            ['top', '0'],
            ['font-size', '9px'],
            ['white-space', 'nowrap'],
        ]) {
            span.style.setProperty(property, value);
        }

        return span;
    }

    /** The `index`-th element of `pool`, made by `make` and added to the lane the first time. */
    function take(
        pool: HTMLElement[],
        index: number,
        make: () => HTMLElement,
    ): HTMLElement {
        let element = pool[index];

        if (element === undefined) {
            element = make();
            pool.push(element);
            lane?.element.append(element);
        }

        element.style.setProperty('display', '');

        return element;
    }

    /** Hides the elements of `pool` from `used` on. */
    function hideFrom(pool: HTMLElement[], used: number): void {
        for (let index = used; index < pool.length; index++) {
            pool[index].style.setProperty('display', 'none');
        }
    }

    function rebuild(): void {
        const frame = host;
        const geometry = frame?.geometry ?? null;
        let major = 0;
        let small = 0;

        if (frame !== null && lane !== null && geometry !== null) {
            const duration = frame.duration;

            if (duration !== null) {
                const view = frame.view;
                const from = view.start * duration;
                const to = view.end * duration;
                const widthCss = geometry.width / geometry.pixelRatio;
                const { step, times } = niceTicks(
                    duration,
                    widthCss,
                    minSpacing,
                    from,
                    to,
                );
                const write = label(step);
                const place = (time: number): string =>
                    `${Math.round(((time - from) / (to - from)) * 100000) / 1000}%`;

                for (const time of step > 0 ? times : []) {
                    take(majors, major++, () => mark('4px')).style.setProperty(
                        'left',
                        place(time),
                    );

                    if (minor && time + step / 2 <= to + 1e-6) {
                        take(minors, small++, () =>
                            mark('2px'),
                        ).style.setProperty('left', place(time + step / 2));
                    }

                    const span = take(labels, major - 1, text);
                    span.textContent = write(time);
                    span.style.setProperty('left', place(time));
                    span.style.setProperty(
                        'transform',
                        time <= from + 1e-6
                            ? 'none'
                            : time >= to - step / 2
                              ? 'translateX(-100%)'
                              : 'translateX(-50%)',
                    );
                }
            }
        }

        hideFrom(majors, major);
        hideFrom(minors, small);
        hideFrom(labels, major);
    }

    return {
        name: 'timeline',

        setup(frame): void {
            host = frame;
            lane = frame.addLane(side, size);
            lane.element.setAttribute('aria-hidden', 'true');
            lane.element.style.setProperty('color', color);
            lane.element.style.setProperty('overflow', 'hidden');
            unsubscribe = [
                frame.on('durationchange', () => rebuild()),
                frame.on('viewchange', () => rebuild()),
            ];
            rebuild();
        },

        resize(): void {
            rebuild();
        },

        destroy(): void {
            for (const stop of unsubscribe) {
                stop();
            }

            unsubscribe = [];
            majors.length = 0;
            minors.length = 0;
            labels.length = 0;
            lane?.remove();
            lane = null;
            host = null;
        },
    };
}
