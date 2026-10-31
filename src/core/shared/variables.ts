/**
 * The page's CSS variables that color SonicFrame, each as a `var()` with the color it falls back to,
 * so every part reads one variable with one default. A palette sets them on a player, and a page can
 * set any of them itself.
 */

/** Bars already played; the knob, the focus rings and the tooltips by default. */
export const PROGRESS: string = 'var(--sonicframe-progress, #2f6fdb)';

/** Bars not played yet. */
export const WAVE: string = 'var(--sonicframe-wave, #c4cad4)';

/** Text over the played color. */
export const ON_PROGRESS: string = 'var(--sonicframe-on-progress, #ffffff)';

/** The band of a region, and the tint of the chapter playing in a list. */
export const REGION: string =
    'var(--sonicframe-region, rgba(47, 111, 219, 0.18))';

/** Quieter text and marks: the time, a chapter's stretch. */
export const MUTED: string = 'var(--sonicframe-muted, currentColor)';

/** The play button, in the played color unless the page gives it its own. */
export const BUTTON: string = `var(--sonicframe-button, ${PROGRESS})`;

/** The icon on the play button. */
export const BUTTON_ICON: string = 'var(--sonicframe-button-icon, #fff)';
