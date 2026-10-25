/**
 * Helpers for the page-level tests, which run under happy-dom (see `test/dom/setup.ts`). They mount a
 * real `SonicFrame` in a detached element, give that element a size the layout can read (happy-dom
 * reports zeros otherwise), drive pointer and media events, and clean up after themselves.
 */

import { SonicFrame, type SonicFrameOptions } from '../../src/index';

/** A box in CSS pixels, as `getBoundingClientRect` returns it. */
export type Box = { left: number; top: number; width: number; height: number };

/** A mounted frame plus the pieces a test drives. */
export type Mounted = {
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    frame: SonicFrame;
    /** Removes the element from the document; the frame's own `destroy()` is separate. */
    unmount(): void;
};

/** Fixes what an element reports for its on-screen box (happy-dom has no layout). */
export function boxOf(element: Element, box: Box): void {
    const rect: DOMRect = {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        right: box.left + box.width,
        bottom: box.top + box.height,
        x: box.left,
        y: box.top,
        toJSON: () => box,
    };

    element.getBoundingClientRect = (): DOMRect => rect;
}

/** Mounts a frame on `document.body` and sizes its canvas, so pointer maths have a box to work with. */
export function mount(
    options?: Partial<SonicFrameOptions>,
    box: Box = { left: 0, top: 0, width: 200, height: 40 },
): Mounted {
    const container = document.createElement('div');
    document.body.append(container);
    boxOf(container, box);

    const frame = new SonicFrame({ container, ...options });
    const canvas = container.querySelector('canvas');

    if (canvas === null) {
        throw new Error('test: the frame did not create a canvas');
    }

    boxOf(canvas, box);

    return {
        container,
        canvas,
        frame,
        unmount: () => container.remove(),
    };
}

/** A pointer event carrying only what the frame reads; dispatched on the element it listens on. */
function pointer(type: string, clientX: number): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });

    return Object.assign(event, {
        clientX,
        clientY: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
    });
}

/** Presses and releases at `clientX`, i.e. a click that seeks to that position. */
export function clickAt(target: HTMLElement, clientX: number): void {
    target.dispatchEvent(pointer('pointerdown', clientX));
    target.dispatchEvent(pointer('pointerup', clientX));
}

/** Presses, moves across the given positions, then releases (a drag that seeks once, on release). */
export function dragAcross(
    target: HTMLElement,
    from: number,
    through: readonly number[],
): void {
    target.dispatchEvent(pointer('pointerdown', from));

    for (const x of through) {
        target.dispatchEvent(pointer('pointermove', x));
    }

    target.dispatchEvent(pointer('pointerup', through.at(-1) ?? from));
}

/** The media surface a frame follows: an `EventTarget` with the few fields the controller reads. */
export class FakeMedia extends EventTarget {
    currentTime = 0;
    private readonly state: {
        duration: number;
        readyState: number;
        paused: boolean;
        ended: boolean;
    };

    constructor(options: {
        duration?: number;
        readyState?: number;
        paused?: boolean;
        ended?: boolean;
    }) {
        super();
        this.state = {
            duration: options.duration ?? Number.NaN,
            readyState: options.readyState ?? 4,
            paused: options.paused ?? true,
            ended: options.ended ?? false,
        };
    }

    get duration(): number {
        return this.state.duration;
    }

    get readyState(): number {
        return this.state.readyState;
    }

    get paused(): boolean {
        return this.state.paused;
    }

    get ended(): boolean {
        return this.state.ended;
    }

    /** Fires one of the media events the frame listens to (`play`, `timeupdate`, …). */
    fire(type: string): void {
        this.dispatchEvent(new Event(type));
    }
}

/** A media element stand-in the frame can follow; cast to the DOM type the options expect. */
export function fakeMedia(
    options: {
        duration?: number;
        readyState?: number;
        paused?: boolean;
        ended?: boolean;
    } = {},
): HTMLMediaElement & FakeMedia {
    return new FakeMedia(options) as HTMLMediaElement & FakeMedia;
}

/** Resolves after one animation frame, so a scheduled repaint has run. */
export function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}
