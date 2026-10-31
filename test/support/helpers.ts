/**
 * Helpers for the page-level tests, which run under happy-dom (see `test/support/setup.ts`). They mount a
 * real `SonicFrame` in a detached element, give that element a size the layout can read (happy-dom
 * reports zeros otherwise), drive pointer and media events, and clean up after themselves: whatever
 * they put on the page is taken off after each test (`cleanPage`, run by the setup).
 */

import { vi } from 'vite-plus/test';
import { SonicFrame, type SonicFrameOptions } from '../../src/index';
import { firePointer } from './events';
import {
    recordingOf,
    triggerResize,
    triggerVisible,
    type Recorded,
} from './fakes';

/** What to undo after the test, last made first. */
const leftovers: (() => void)[] = [];

/** Undoes everything the helpers put on the page during the test: frames, players and hosts. */
export function cleanPage(): void {
    for (const undo of leftovers.splice(0).reverse()) {
        undo();
    }
}

/** Destroys `made` (a player, say) after the test; returns it. */
export function afterTest<Made extends { destroy(): void }>(made: Made): Made {
    leftovers.push(() => made.destroy());

    return made;
}

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

/** An element of size `box` on `document.body`, taken off after the test. */
export function pageHost(box: Box): HTMLElement {
    const host = document.createElement('div');
    document.body.append(host);
    boxOf(host, box);
    leftovers.push(() => host.remove());

    return host;
}

/**
 * Mounts a frame on `document.body` and sizes its canvas, so pointer maths have a box to work with;
 * after the test, the frame is destroyed and taken off.
 */
export function mount(
    options?: Partial<SonicFrameOptions>,
    box: Box = { left: 0, top: 0, width: 200, height: 40 },
): Mounted {
    const container = pageHost(box);
    const frame = afterTest(new SonicFrame({ container, ...options }));
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

/** Mounts a frame (see `mount`) with pixels of its box's size and on screen, so it draws. */
export function mountShown(
    options?: Partial<SonicFrameOptions>,
    box: Box = { left: 0, top: 0, width: 200, height: 40 },
): Mounted {
    const mounted = mount(options, box);
    triggerResize(mounted.canvas, { width: box.width, height: box.height });
    triggerVisible(mounted.canvas, true);

    return mounted;
}

/** Stands in for `matchMedia`: a query matches when `matches` says so (until `vi.unstubAllGlobals`). */
export function stubMedia(matches: (query: string) => boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: matches(query),
        media: query,
        addEventListener: (): void => undefined,
        removeEventListener: (): void => undefined,
    }));
}

/**
 * Gives a mounted frame pixels (200 × 40) and the screen, puts its position at the middle and waits
 * for the picture; returns what its canvas recorded.
 */
export async function drawnHalfway(mounted: Mounted): Promise<Recorded> {
    triggerResize(mounted.canvas, { width: 200, height: 40 });
    triggerVisible(mounted.canvas, true);
    mounted.frame.setProgress(0.5);
    await nextFrame();

    return recordingOf(mounted.canvas);
}

/** Puts a tag on the page and gives its wave's canvas pixels (200 × 40) and the screen. */
export function showTag(element: HTMLElement): void {
    document.body.append(element);
    const canvas = element.querySelector('canvas') as HTMLCanvasElement;
    triggerResize(canvas, { width: 200, height: 40 });
    triggerVisible(canvas, true);
}

/** Destroys a mounted frame and takes it off the page now, before the test ends (to mount another). */
export function takeOff(mounted: Mounted): void {
    mounted.frame.destroy();
    mounted.unmount();
}

/** Presses and releases at `clientX`, i.e. a click that seeks to that position. */
export function clickAt(target: HTMLElement, clientX: number): void {
    firePointer(target, 'pointerdown', clientX);
    firePointer(target, 'pointerup', clientX);
}

/** Presses, moves across the given positions, then releases (a drag that seeks once, on release). */
export function dragAcross(
    target: HTMLElement,
    from: number,
    through: readonly number[],
): void {
    firePointer(target, 'pointerdown', from);

    for (const x of through) {
        firePointer(target, 'pointermove', x);
    }

    firePointer(target, 'pointerup', through.at(-1) ?? from);
}

/** The media surface a frame follows: an `EventTarget` with the few fields the controller reads. */
export class FakeMedia extends EventTarget {
    currentTime = 0;
    volume = 1;
    muted = false;
    playbackRate = 1;
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

/** The style properties set on `element` when it takes keyboard focus (`:focus-visible`). */
export function focusRing(element: HTMLElement): string[] {
    const names: string[] = [];
    const set = element.style.setProperty.bind(element.style);
    element.matches = ((): boolean =>
        true) as unknown as HTMLElement['matches'];
    element.style.setProperty = (
        name: string,
        value: string | null,
        priority?: string,
    ): void => {
        names.push(name);
        set(name, value, priority);
    };

    element.dispatchEvent(new FocusEvent('focus'));

    return names;
}

/** Resolves after one animation frame, so a scheduled repaint has run. */
export function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}
