/**
 * A stand-in for `element.animate` (happy-dom runs no animation): each one started is recorded with
 * its element, keyframes and options, and whether it is paused or cancelled now.
 */

import { vi } from 'vite-plus/test';

export type RecordedAnimation = {
    target: Element;
    keyframes: Keyframe[];
    options: KeyframeAnimationOptions;
    cancelled: boolean;
    paused: boolean;
};

/** Records every animation started from now until the test ends (`vi.restoreAllMocks`). */
export function recordAnimations(): RecordedAnimation[] {
    const started: RecordedAnimation[] = [];
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
        this: HTMLElement,
        keyframes,
        options,
    ) {
        const animation = {
            target: this,
            keyframes: keyframes as Keyframe[],
            options: options as KeyframeAnimationOptions,
            cancelled: false,
            paused: false,
            finished: Promise.resolve(),
            cancel(): void {
                animation.cancelled = true;
            },
            pause(): void {
                animation.paused = true;
            },
            play(): void {
                animation.paused = false;
            },
        };
        started.push(animation);

        return animation as unknown as Animation;
    });

    return started;
}
