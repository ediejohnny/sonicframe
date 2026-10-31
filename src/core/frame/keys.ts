export type KeyAction =
    | { kind: 'step'; direction: -1 | 1; large: boolean }
    | { kind: 'seek'; ratio: number };

export type KeyModifiers = {
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
};

/**
 * What a key does on a focused frame, following the WAI-ARIA slider pattern. Keys held with Ctrl, Alt
 * or Meta belong to the browser and the page (shortcuts), so they do nothing here.
 */
export function keyAction(
    key: string,
    modifiers: KeyModifiers = {},
): KeyAction | null {
    if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) {
        return null;
    }

    switch (key) {
        case 'ArrowLeft':
        case 'ArrowDown':
            return { kind: 'step', direction: -1, large: false };
        case 'ArrowRight':
        case 'ArrowUp':
            return { kind: 'step', direction: 1, large: false };
        case 'PageDown':
            return { kind: 'step', direction: -1, large: true };
        case 'PageUp':
            return { kind: 'step', direction: 1, large: true };
        case 'Home':
            return { kind: 'seek', ratio: 0 };
        case 'End':
            return { kind: 'seek', ratio: 1 };
        default:
            return null;
    }
}
