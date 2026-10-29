/**
 * What both playground pages share: the sound, the header and the copy buttons. The sound is fetched
 * and decoded once, so every player gets the same peaks and duration and plays the same bytes. The
 * header shows the version and switches the page between light and dark; canvas colors are read
 * once, so the page repaints its players after every switch.
 */

import { peaksFromChannel, VERSION } from '../src/index';

export type Sound = {
    /** An object URL for the sound's bytes; each player's own `<audio>` plays it. */
    url: string;
    peaks: number[];
    /** In seconds. */
    duration: number;
    /** What the page calls it. */
    name: string;
};

/** How many peaks are decoded from a sound. */
const PEAKS = 1000;

/** How long a copy button says it copied, in milliseconds. */
const COPIED_FOR = 1500;

const SCHEME_KEY = 'sonicframe-playground-scheme';

type Scheme = 'light' | 'dark';

/** Decodes a sound once; the object URL lives until `forget` is called with it. */
export async function soundFrom(blob: Blob, name: string): Promise<Sound> {
    const context = new AudioContext();

    try {
        const buffer = await context.decodeAudioData(await blob.arrayBuffer());

        return {
            url: URL.createObjectURL(blob),
            peaks: peaksFromChannel(buffer.getChannelData(0), PEAKS),
            duration: buffer.duration,
            name,
        };
    } finally {
        void context.close();
    }
}

/** The page's own sound (see playground/sounds/CREDITS.md). */
export async function bundledSound(): Promise<Sound> {
    const response = await fetch('./sounds/little-elf.mp3');

    if (!response.ok) {
        throw new Error(`The sound did not load (HTTP ${response.status}).`);
    }

    return soundFrom(await response.blob(), '“The Little Elf”, read by Avery');
}

export function forget(sound: Sound): void {
    URL.revokeObjectURL(sound.url);
}

/** A button that opens a hidden file input, and the file chosen becomes the page's sound. */
export function pickSound(
    button: HTMLButtonElement,
    input: HTMLInputElement,
    use: (sound: Sound) => void,
    fail: (error: unknown) => void,
): void {
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
        const file = input.files?.[0];

        if (file) {
            soundFrom(file, file.name).then(use, fail);
        }
    });
}

function storedScheme(): Scheme | null {
    try {
        const value = localStorage.getItem(SCHEME_KEY);

        return value === 'light' || value === 'dark' ? value : null;
    } catch {
        return null;
    }
}

function systemQuery(): MediaQueryList {
    return window.matchMedia('(prefers-color-scheme: dark)');
}

function currentScheme(): Scheme {
    const chosen = document.documentElement.dataset.theme;

    if (chosen === 'light' || chosen === 'dark') {
        return chosen;
    }

    return systemQuery().matches ? 'dark' : 'light';
}

/**
 * Fills in the version and wires the light/dark switch, which sets `data-theme` on the page and is
 * remembered for the next visit. `repaint` runs after every change, the system's included while the
 * page follows it.
 */
export function setupHeader(repaint: () => void): void {
    const root = document.documentElement;
    const stored = storedScheme();

    if (stored !== null) {
        root.dataset.theme = stored;
    }

    for (const element of document.querySelectorAll('[data-version]')) {
        element.textContent = `v${VERSION}`;
    }

    const toggle = document.querySelector<HTMLButtonElement>('#scheme');
    const show = (): void => {
        toggle?.setAttribute(
            'aria-pressed',
            String(currentScheme() === 'dark'),
        );
    };

    toggle?.addEventListener('click', () => {
        const next: Scheme = currentScheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;

        try {
            localStorage.setItem(SCHEME_KEY, next);
        } catch {
            // Storage can be off; the choice then lasts for this visit only.
        }

        show();
        repaint();
    });
    systemQuery().addEventListener('change', () => {
        show();
        repaint();
    });
    show();
}

/** Makes the button of a `.code` block copy the block's code, whatever it says at the time. */
export function copyButton(block: HTMLElement): void {
    const button = block.querySelector('button');
    const code = block.querySelector('code');

    if (button !== null && code !== null) {
        copyOnClick(button, () => code.textContent ?? '');
    }
}

/** Makes a button copy the text `text` gives at the time of the click, and say whether it did. */
export function copyOnClick(
    button: HTMLButtonElement,
    text: () => string,
): void {
    const label = button.textContent?.trim() ?? 'Copy';
    let timer = 0;
    const say = (message: string): void => {
        button.textContent = message;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            button.textContent = label;
        }, COPIED_FOR);
    };

    button.addEventListener('click', () => {
        navigator.clipboard.writeText(text()).then(
            () => say('Copied'),
            () => say('Copy failed'),
        );
    });
}

export function setupCopyButtons(): void {
    for (const block of document.querySelectorAll<HTMLElement>('.code')) {
        copyButton(block);
    }
}

export function byId<Element extends HTMLElement = HTMLElement>(
    id: string,
): Element {
    const element = document.getElementById(id);

    if (element === null) {
        throw new Error(`The page has no #${id}.`);
    }

    return element as Element;
}
