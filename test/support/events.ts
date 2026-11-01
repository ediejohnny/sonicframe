/**
 * The events a test drives the page with, built one way for every test: pointer events carrying
 * only the fields the code reads, key presses, the wheel, and a media's playback moving on. Pointer,
 * key and wheel events are cancelable, so a test can read whether they were taken
 * (`defaultPrevented`).
 */

/** The fields of a pointer event the frame and the plugins read, besides `clientX`. */
export type PointerFields = {
    clientY: number;
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    button: number;
    shiftKey: boolean;
};

/** A pointer event of `type` at `clientX`: the primary mouse button, unless `fields` say otherwise. */
export function pointerEvent(
    type: string,
    clientX: number,
    fields: Partial<PointerFields> = {},
): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clientX,
        clientY: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        shiftKey: false,
        ...fields,
    });
}

/** Dispatches a pointer event (see `pointerEvent`) on `target`; returns it. */
export function firePointer(
    target: EventTarget,
    type: string,
    clientX: number,
    fields: Partial<PointerFields> = {},
): Event {
    const event = pointerEvent(type, clientX, fields);
    target.dispatchEvent(event);

    return event;
}

/** Presses `key` on `target` (a keydown that bubbles), with any modifiers; returns the event. */
export function pressKey(
    target: EventTarget,
    key: string,
    modifiers: Omit<KeyboardEventInit, 'key'> = {},
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...modifiers,
    });
    target.dispatchEvent(event);

    return event;
}

/** Turns the wheel over `target` (cancelable); returns the event. */
export function wheel(target: EventTarget, init: WheelEventInit): WheelEvent {
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

/** Moves `media` to `time` the way playback does: the time, then a `timeupdate`. */
export function playTo(
    media: { currentTime: number; fire(type: string): void },
    time: number,
): void {
    media.currentTime = time;
    media.fire('timeupdate');
}
