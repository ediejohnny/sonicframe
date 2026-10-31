/**
 * One ResizeObserver and one IntersectionObserver for every frame on the page (hundreds of players
 * cost two observers, not hundreds), plus a watch on the screen density for browsers that cannot
 * report sizes in device pixels.
 */

/** A size in device pixels, with the density it was measured at. */
export type Size = { width: number; height: number; pixelRatio: number };

/** How far outside the screen a frame still counts as near (and keeps its pixels). */
const NEAR_MARGIN = '300px';

const sizeListeners = new Map<Element, (size: Size) => void>();
const visibilityListeners = new Map<Element, (near: boolean) => void>();
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let densityQuery: MediaQueryList | null = null;
let devicePixelBoxes = false;

function pixelRatio(): number {
    return window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
}

function measure(entry: ResizeObserverEntry): Size {
    const ratio = pixelRatio();
    const device = entry.devicePixelContentBoxSize?.[0];

    if (device !== undefined) {
        devicePixelBoxes = true;

        return {
            width: device.inlineSize,
            height: device.blockSize,
            pixelRatio: ratio,
        };
    }

    return {
        width: Math.round(entry.contentRect.width * ratio),
        height: Math.round(entry.contentRect.height * ratio),
        pixelRatio: ratio,
    };
}

/** Moving the window to another screen changes the density but not the CSS size. */
function watchDensity(): void {
    if (densityQuery !== null || typeof window.matchMedia !== 'function') {
        return;
    }

    densityQuery = window.matchMedia(`(resolution: ${pixelRatio()}dppx)`);
    densityQuery.addEventListener(
        'change',
        () => {
            densityQuery = null;

            if (!devicePixelBoxes) {
                const ratio = pixelRatio();

                for (const [element, listener] of sizeListeners) {
                    const box = element.getBoundingClientRect();
                    listener({
                        width: Math.round(box.width * ratio),
                        height: Math.round(box.height * ratio),
                        pixelRatio: ratio,
                    });
                }
            }

            if (sizeListeners.size > 0) {
                watchDensity();
            }
        },
        { once: true },
    );
}

/** Calls `listener` with the element's size now and whenever it changes. Returns the unsubscribe. */
export function observeSize(
    element: Element,
    listener: (size: Size) => void,
): () => void {
    resizeObserver ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
            sizeListeners.get(entry.target)?.(measure(entry));
        }
    });
    sizeListeners.set(element, listener);

    try {
        resizeObserver.observe(element, { box: 'device-pixel-content-box' });
    } catch {
        resizeObserver.observe(element);
    }

    watchDensity();

    return () => {
        sizeListeners.delete(element);
        resizeObserver?.unobserve(element);
    };
}

/** Calls `listener` with whether the element is on or near the screen, now and on every change. */
export function observeVisibility(
    element: Element,
    listener: (near: boolean) => void,
): () => void {
    if (typeof IntersectionObserver !== 'function') {
        listener(true);

        return () => undefined;
    }

    intersectionObserver ??= new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                visibilityListeners.get(entry.target)?.(entry.isIntersecting);
            }
        },
        { rootMargin: NEAR_MARGIN },
    );
    visibilityListeners.set(element, listener);
    intersectionObserver.observe(element);

    return () => {
        visibilityListeners.delete(element);
        intersectionObserver?.unobserve(element);
    };
}
