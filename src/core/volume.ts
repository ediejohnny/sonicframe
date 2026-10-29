/**
 * The volume control without the page: which speaker icon to show, how keys move the level, the
 * words a screen reader hears, and the level under the pointer. Levels run from 0 to 1, as on a media
 * element, kept to whole hundredths. Icons sit on a 24 × 24 grid, like the play button's.
 */

export type VolumeIcon = 'muted' | 'low' | 'high';

/** The speaker: a box and a cone, filled. */
export const SPEAKER_PATH = 'M3.5 9.5h4l5-4.5v14l-5-4.5h-4z';

/** What sits beside the speaker, stroked: one or two sound waves, or the cross of a muted speaker. */
export const VOLUME_MARKS: Readonly<Record<VolumeIcon, string>> = Object.freeze(
    {
        muted: 'M16 9.5l5 5M21 9.5l-5 5',
        low: 'M15.5 9.5a3.5 3.5 0 0 1 0 5',
        high: 'M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10',
    },
);

/** How far Page Up / Page Down move the level. */
const PAGE_STEP = 0.1;

/** A level kept inside 0..1, in whole hundredths; anything that is not a finite number becomes 0. */
export function clampLevel(value: number): number {
    return Number.isFinite(value)
        ? Math.min(1, Math.max(0, Math.round(value * 100) / 100))
        : 0;
}

export function volumeIcon(volume: number, muted: boolean): VolumeIcon {
    if (muted || !(volume > 0)) {
        return 'muted';
    }

    return volume < 0.5 ? 'low' : 'high';
}

/** The level after a key on the bar, or null for a key the bar leaves to the page. */
export function volumeAfterKey(
    key: string,
    volume: number,
    step: number,
): number | null {
    const small = step > 0 ? step : 0.05;

    switch (key) {
        case 'ArrowRight':
        case 'ArrowUp':
            return clampLevel(volume + small);
        case 'ArrowLeft':
        case 'ArrowDown':
            return clampLevel(volume - small);
        case 'PageUp':
            return clampLevel(volume + PAGE_STEP);
        case 'PageDown':
            return clampLevel(volume - PAGE_STEP);
        case 'Home':
            return 0;
        case 'End':
            return 1;
        default:
            return null;
    }
}

/** The level in words: `'40%'`, or `'muted'`. */
export function volumeText(volume: number, muted: boolean): string {
    return muted ? 'muted' : `${Math.round(clampLevel(volume) * 100)}%`;
}

/** The level to bring back when unmuting: the one the media had, or half if it was silent. */
export function unmutedLevel(volume: number): number {
    return volume > 0 ? clampLevel(volume) : 0.5;
}

/** The level under a pointer `offset` CSS pixels into a bar `width` wide. */
export function levelAt(offset: number, width: number): number {
    return width > 0 ? clampLevel(offset / width) : 0;
}
