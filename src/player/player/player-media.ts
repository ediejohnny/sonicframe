/** The `<audio>` a player makes for a sound address, and how it lets that sound go. */

/**
 * An `<audio>` for `src`, loading as much as `preload` asks: `'none'` or `'auto'`, and the metadata
 * for anything else.
 */
export function makeAudio(src: string, preload: unknown): HTMLAudioElement {
    const audio = document.createElement('audio');
    audio.preload =
        preload === 'none' || preload === 'auto' ? preload : 'metadata';
    audio.setAttribute('src', src);

    return audio;
}

/** Stops a media and lets go of its sound: without its address and loaded again, its download stops too. */
export function releaseMedia(media: HTMLMediaElement): void {
    media.pause();
    media.removeAttribute('src');
    media.load();
}
