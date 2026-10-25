/**
 * Small stand-ins for the browser pieces happy-dom does not provide: the two observers (so a test can
 * drive size and visibility by hand), `Path2D`, and a 2D context that records what it was asked to
 * draw. `installFakes()` runs from `test/dom/setup.ts` before any test; the trigger helpers let a test
 * push a size or a visibility change into the frame.
 */

/** What a test can read back from a canvas's recording context. */
export type Recorded = {
    /** The `fillStyle` in force at each `fill` / `fillRect` / `fillText`, in order. */
    readonly fills: string[];
    /** Every method called, in order, for coarse assertions. */
    readonly ops: string[];
};

type ResizeBox = { width: number; height: number };

const resizeObservers = new Set<FakeResizeObserver>();
const visibilityObservers = new Set<FakeIntersectionObserver>();
const contexts = new WeakMap<
    HTMLCanvasElement,
    CanvasRenderingContext2D & Recorded
>();

class FakeResizeObserver {
    private readonly targets = new Set<Element>();

    constructor(private readonly callback: ResizeObserverCallback) {
        resizeObservers.add(this);
    }

    observe(target: Element): void {
        this.targets.add(target);
    }

    unobserve(target: Element): void {
        this.targets.delete(target);
    }

    disconnect(): void {
        this.targets.clear();
        resizeObservers.delete(this);
    }

    deliver(target: Element, box: ResizeBox): void {
        if (!this.targets.has(target)) {
            return;
        }

        const entry = {
            target,
            contentRect: { width: box.width, height: box.height },
            devicePixelContentBoxSize: [
                { inlineSize: box.width, blockSize: box.height },
            ],
        } as unknown as ResizeObserverEntry;

        this.callback([entry], this as unknown as ResizeObserver);
    }
}

class FakeIntersectionObserver {
    private readonly targets = new Set<Element>();

    constructor(private readonly callback: IntersectionObserverCallback) {
        visibilityObservers.add(this);
    }

    observe(target: Element): void {
        this.targets.add(target);
    }

    unobserve(target: Element): void {
        this.targets.delete(target);
    }

    disconnect(): void {
        this.targets.clear();
        visibilityObservers.delete(this);
    }

    deliver(target: Element, isIntersecting: boolean): void {
        if (!this.targets.has(target)) {
            return;
        }

        const entry = { target, isIntersecting } as IntersectionObserverEntry;
        this.callback([entry], this as unknown as IntersectionObserver);
    }
}

/** A `Path2D` that accepts the geometry calls the painter makes and keeps none of it. */
class FakePath2D {
    rect(): void {}
    roundRect(): void {}
    moveTo(): void {}
    lineTo(): void {}
    arcTo(): void {}
    arc(): void {}
    ellipse(): void {}
    closePath(): void {}
}

/** Red, green, blue and alpha (0..255) for the CSS colors the painter resolves. */
function parseColor(value: string): [number, number, number, number] {
    const css = value.trim().toLowerCase();
    const named: Record<string, [number, number, number, number]> = {
        '': [0, 0, 0, 0],
        transparent: [0, 0, 0, 0],
        black: [0, 0, 0, 255],
        white: [255, 255, 255, 255],
        red: [255, 0, 0, 255],
        gray: [128, 128, 128, 255],
    };

    if (css in named) {
        return named[css];
    }

    if (css.startsWith('#')) {
        const hex = css.slice(1);
        const full =
            hex.length === 3 || hex.length === 4
                ? hex.replace(/./g, (digit) => digit + digit)
                : hex;
        const byte = (at: number): number =>
            parseInt(full.slice(at, at + 2), 16);

        return [byte(0), byte(2), byte(4), full.length >= 8 ? byte(6) : 255];
    }

    const parts = css.match(/-?\d*\.?\d+/g);

    if ((css.startsWith('rgb') || css.startsWith('hsl')) && parts !== null) {
        const n = parts.map(Number);

        return [
            Math.round(n[0] ?? 0),
            Math.round(n[1] ?? 0),
            Math.round(n[2] ?? 0),
            Math.round((n[3] ?? 1) * 255),
        ];
    }

    return [0, 0, 0, 255];
}

function createRecordingContext(): CanvasRenderingContext2D & Recorded {
    const fills: string[] = [];
    const ops: string[] = [];
    const op =
        (name: string) =>
        (...args: unknown[]): void => {
            ops.push(name);

            if (name === 'fill' || name === 'fillRect' || name === 'fillText') {
                fills.push(String(context.fillStyle));
            }

            void args;
        };

    const context = {
        fills,
        ops,
        canvas: null,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: true,
        save: op('save'),
        restore: op('restore'),
        setTransform: op('setTransform'),
        resetTransform: op('resetTransform'),
        translate: op('translate'),
        scale: op('scale'),
        rotate: op('rotate'),
        beginPath: op('beginPath'),
        closePath: op('closePath'),
        rect: op('rect'),
        roundRect: op('roundRect'),
        moveTo: op('moveTo'),
        lineTo: op('lineTo'),
        arc: op('arc'),
        arcTo: op('arcTo'),
        ellipse: op('ellipse'),
        clip: op('clip'),
        fill: op('fill'),
        stroke: op('stroke'),
        fillRect: op('fillRect'),
        strokeRect: op('strokeRect'),
        clearRect: op('clearRect'),
        fillText: op('fillText'),
        strokeText: op('strokeText'),
        setLineDash: op('setLineDash'),
        drawImage: op('drawImage'),
        putImageData: op('putImageData'),
        measureText: (text: string) => ({ width: text.length * 6 }),
        createLinearGradient: () => ({ addColorStop: (): void => {} }),
        createPattern: () => null,
        createImageData: (width: number, height: number) => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
        }),
        getImageData: (
            _x: number,
            _y: number,
            width: number,
            height: number,
        ) => {
            const [r, g, b, a] = parseColor(String(context.fillStyle));
            const data = new Uint8ClampedArray(width * height * 4);

            for (let i = 0; i < data.length; i += 4) {
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = a;
            }

            return { width, height, data };
        },
    };

    return context as unknown as CanvasRenderingContext2D & Recorded;
}

let installed = false;

/** Puts the stand-ins on the happy-dom globals. Safe to call more than once. */
export function installFakes(): void {
    if (installed) {
        return;
    }

    installed = true;
    globalThis.ResizeObserver =
        FakeResizeObserver as unknown as typeof ResizeObserver;
    globalThis.IntersectionObserver =
        FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    globalThis.Path2D = FakePath2D as unknown as typeof Path2D;

    const getContext = function (
        this: HTMLCanvasElement,
        kind: string,
    ): CanvasRenderingContext2D | null {
        if (kind !== '2d') {
            return null;
        }

        let context = contexts.get(this);

        if (context === undefined) {
            context = createRecordingContext();
            contexts.set(this, context);
        }

        return context;
    };

    HTMLCanvasElement.prototype.getContext =
        getContext as unknown as HTMLCanvasElement['getContext'];
}

/** The recording context of a canvas, to read back what was drawn. */
export function recordingOf(canvas: HTMLCanvasElement): Recorded {
    const context = canvas.getContext('2d');

    return context as unknown as Recorded;
}

/** Pushes a size (in device pixels) into whichever frame observes `element`. */
export function triggerResize(element: Element, box: ResizeBox): void {
    for (const observer of resizeObservers) {
        observer.deliver(element, box);
    }
}

/** Tells whichever frame observes `element` that it is on screen (or not). */
export function triggerVisible(element: Element, isIntersecting = true): void {
    for (const observer of visibilityObservers) {
        observer.deliver(element, isIntersecting);
    }
}
