/**
 * One animation-frame loop for every frame on the page: a frame asks for one picture (`schedule`) or
 * for every frame while its media plays (`setLooping`), and all of them are drawn in the same callback.
 */

export type FrameTask = { render(now: number): void };

const dirty = new Set<FrameTask>();
const looping = new Set<FrameTask>();
let handle = 0;

function run(now: number): void {
    handle = 0;

    const tasks = new Set([...looping, ...dirty]);
    dirty.clear();

    for (const task of tasks) {
        try {
            task.render(now);
        } catch (error) {
            queueMicrotask(() => {
                throw error;
            });
        }
    }

    if (looping.size > 0 || dirty.size > 0) {
        request();
    }
}

function request(): void {
    if (handle === 0) {
        handle = requestAnimationFrame(run);
    }
}

/** Draws the task once, on the next animation frame. */
export function schedule(task: FrameTask): void {
    dirty.add(task);
    request();
}

/** Draws the task on every animation frame while `on`. */
export function setLooping(task: FrameTask, on: boolean): void {
    if (on) {
        looping.add(task);
        request();
    } else {
        looping.delete(task);
    }
}

export function unschedule(task: FrameTask): void {
    dirty.delete(task);
    looping.delete(task);
}
