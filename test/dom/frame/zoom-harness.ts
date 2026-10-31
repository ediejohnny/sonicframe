/**
 * The zoom tests' frame and what a person does to it: a sound of a quiet half and a loud half, a
 * 200 × 40 frame of it on screen, a press, a key, the wheel, and the bars last drawn.
 */

import {
    recordingOf,
    triggerResize,
    triggerVisible,
} from '../../support/fakes';
import { mount, type Mounted } from '../../support/helpers';

/** Mounts a 200 × 40 frame with pixels, on screen. */
export function showFrame(options: Parameters<typeof mount>[0]): Mounted {
    const mounted = mount(options);
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);

    return mounted;
}

/** The bars of the last wave drawn: their x and height, in device pixels. */
export function lastBars(
    canvas: HTMLCanvasElement,
): { x: number; height: number }[] {
    const paths = recordingOf(canvas).paths;

    for (let i = paths.length - 1; i >= 0; i--) {
        const bars = paths[i].calls.filter((call) => call[0] === 'roundRect');

        if (bars.length > 0) {
            return bars.map((call) => ({
                x: call[1] as number,
                height: call[4] as number,
            }));
        }
    }

    return [];
}

export function press(
    type: string,
    clientX: number,
    extra: Partial<{
        pointerId: number;
        pointerType: string;
        isPrimary: boolean;
    }> = {},
): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clientX,
        clientY: 10,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        shiftKey: false,
        ...extra,
    });
}

export function key(
    target: HTMLElement,
    name: string,
    modifiers: { ctrlKey?: boolean } = {},
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
        ...modifiers,
    });
    target.dispatchEvent(event);

    return event;
}

export function wheel(target: HTMLElement, init: WheelEventInit): WheelEvent {
    const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
    });

    // happy-dom's WheelEvent drops the modifier keys and the pointer's x of its init; give them back.
    for (const name of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey'] as const) {
        Object.defineProperty(event, name, { value: init[name] ?? false });
    }

    Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 });

    target.dispatchEvent(event);

    return event;
}

export const HALVES: number[] = [
    ...Array.from({ length: 500 }, () => 0),
    ...Array.from({ length: 500 }, () => 1),
];
