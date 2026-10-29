/**
 * Whether a frame may tap a media element's audio for the live analyser. Reading the sound of a
 * cross-origin file the server did not allow (`crossOrigin`) yields silence, which would mute
 * playback — so such media must not be routed. Pure, so the rule is tested without the DOM.
 */

export function canTapMedia(info: {
    /** The media's `src` (or `currentSrc`). */
    src: string;
    /** The element's `crossOrigin` attribute, or null. */
    crossOrigin: string | null;
    /** The page's origin, e.g. `https://example.com`. */
    pageOrigin: string;
}): boolean {
    const src = info.src ?? '';

    if (src === '') {
        return true;
    }

    if (src.startsWith('blob:') || src.startsWith('data:')) {
        return true;
    }

    if (
        info.crossOrigin === 'anonymous' ||
        info.crossOrigin === 'use-credentials'
    ) {
        return true;
    }

    try {
        return new URL(src, info.pageOrigin).origin === info.pageOrigin;
    } catch {
        return true;
    }
}
