/**
 * What every docs page shares: the sound, the header, the sidebar of pages, "On this page" and the
 * copy buttons. The sound's peaks and length come from a ready-made file, so every player gets the
 * same ones at once and nothing is decoded; a sound the reader picks is decoded once. The header
 * switches the page between light and dark and picks its font; canvas colors are read once, so the
 * page repaints its players after every switch.
 */

import { loadWaveform, peaksFromChannel } from '../src/index';
import { POEM } from './docs/sounds';

export type Sound = {
    /** The sound's address (or an object URL for a file the reader picked); each player's own `<audio>` plays it. */
    url: string;
    /** Whether `url` is an object URL this page made, to give back with `forget`. */
    own: boolean;
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
const FONT_KEY = 'sonicframe-docs-font';

type Scheme = 'light' | 'dark';

/** Decodes a sound once; the object URL lives until `forget` is called with it. */
export async function soundFrom(blob: Blob, name: string): Promise<Sound> {
    const context = new AudioContext();

    try {
        const buffer = await context.decodeAudioData(await blob.arrayBuffer());

        return {
            url: URL.createObjectURL(blob),
            own: true,
            peaks: peaksFromChannel(buffer.getChannelData(0), PEAKS),
            duration: buffer.duration,
            name,
        };
    } finally {
        void context.close();
    }
}

/**
 * The page's own sound (see playground/sounds/CREDITS.md): its ready-made peaks and length come
 * from a small file, and the audio itself loads only when a player plays.
 */
export async function bundledSound(): Promise<Sound> {
    const waveform = await loadWaveform(`./${POEM.peaks}`);

    return {
        url: `./${POEM.audio}`,
        own: false,
        peaks: [...waveform.peaks],
        duration: waveform.duration ?? 0,
        name: `${POEM.title}, ${POEM.artist}`,
    };
}

export function forget(sound: Sound): void {
    if (sound.own) {
        URL.revokeObjectURL(sound.url);
    }
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

function store(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage can be off; the choice then lasts for this visit only.
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
 * Wires what the header and the sidebar carry (the build drew them into the page): the light/dark
 * switch and the font, both remembered for the next visit; the drawer of pages on narrow screens;
 * the search; and the early fetch of a page the pointer rests on. `repaint` runs after every change
 * of scheme or font, the system's included while the page follows it.
 */
export function setupHeader(repaint: () => void): void {
    const root = document.documentElement;
    const stored = storedScheme();

    if (stored !== null) {
        root.dataset.theme = stored;
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
        store(SCHEME_KEY, next);
        show();
        repaint();
    });
    systemQuery().addEventListener('change', () => {
        show();
        repaint();
    });
    show();
    setupFont(repaint);
    setupSidebar();
    setupSearch();
    prefetchOnHover();
}

/** The font picker: the page's font from the library's own stacks, remembered for the next visit. */
function setupFont(repaint: () => void): void {
    const root = document.documentElement;
    const select = document.querySelector<HTMLSelectElement>('#site-font');

    if (select === null) {
        return;
    }

    const known = [...select.options].map((option) => option.value);

    if (!known.includes(root.dataset.font ?? '')) {
        delete root.dataset.font;
    }

    select.value = root.dataset.font ?? known[0];
    select.addEventListener('change', () => {
        root.dataset.font = select.value;
        store(FONT_KEY, select.value);
        repaint();
    });
}

/** The width at which the sidebar stops being a drawer and stays beside the page (60rem). */
const SIDE_QUERY = '(min-width: 60rem)';

/** The width at which "On this page" stays beside the text instead of folding above it (76rem). */
const TOC_QUERY = '(min-width: 76rem)';

/**
 * The sidebar of pages: on narrow screens a drawer the Menu button opens, closed by a link, the
 * backdrop or Escape.
 */
function setupSidebar(): void {
    const side = document.querySelector<HTMLElement>('#side');
    const menu = document.querySelector<HTMLButtonElement>('#menu');
    const backdrop = document.querySelector<HTMLElement>('#side-backdrop');

    if (side === null || menu === null || backdrop === null) {
        return;
    }

    const setOpen = (open: boolean, restoreFocus = false): void => {
        side.classList.toggle('open', open);
        backdrop.hidden = !open;
        menu.setAttribute('aria-expanded', String(open));

        if (open) {
            (
                side.querySelector<HTMLElement>('[aria-current]') ??
                side.querySelector<HTMLElement>('a')
            )?.focus();
        } else if (restoreFocus) {
            menu.focus();
        }
    };

    menu.addEventListener('click', () =>
        setOpen(!side.classList.contains('open')),
    );
    backdrop.addEventListener('click', () => setOpen(false, true));
    side.addEventListener('click', (event) => {
        if ((event.target as Element).closest('a') !== null) {
            setOpen(false);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && side.classList.contains('open')) {
            setOpen(false, true);
        }
    });
    window.matchMedia(SIDE_QUERY).addEventListener('change', () => {
        setOpen(false);
    });

    // The current page in sight, without moving the page itself.
    const current = side.querySelector<HTMLElement>('[aria-current="page"]');

    if (current !== null) {
        keepInSight(side, current);
    }
}

/** Fetches a docs page early once the pointer rests on (or focus reaches) a link to it. */
function prefetchOnHover(): void {
    const fetched = new Set<string>([location.href.split('#')[0]]);
    const ahead = (event: Event): void => {
        const link = (event.target as Element | null)?.closest?.('a');

        if (
            !(link instanceof HTMLAnchorElement) ||
            link.origin !== location.origin ||
            !link.pathname.endsWith('.html')
        ) {
            return;
        }

        const address = link.href.split('#')[0];

        if (fetched.has(address)) {
            return;
        }

        fetched.add(address);
        const hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.href = address;
        document.head.append(hint);
    };

    document.addEventListener('pointerover', ahead, { passive: true });
    document.addEventListener('focusin', ahead);
}

type SearchEntry = {
    file: string;
    name: string;
    group: string;
    lede: string;
    headings: { id: string; text: string }[];
};

type Hit = { href: string; title: string; where: string; score: number };

/** The most results the search shows. */
const MAX_HITS = 12;

/** Every place in the docs the words lead to, best first. */
function findIn(index: SearchEntry[], query: string): Hit[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (terms.length === 0) {
        return [];
    }

    const score = (text: string, weight: number): number => {
        const lower = text.toLowerCase();

        return terms.every((term) => lower.includes(term))
            ? weight + (lower.startsWith(terms[0]) ? 1 : 0)
            : 0;
    };
    const hits: Hit[] = [];

    for (const page of index) {
        const pageScore = Math.max(
            score(page.name, 6),
            score(`${page.name} ${page.lede}`, 3),
        );

        if (pageScore > 0) {
            hits.push({
                href: `./${page.file}`,
                title: page.name,
                where: page.group,
                score: pageScore,
            });
        }

        for (const heading of page.headings) {
            const headingScore = score(heading.text, 4);

            if (headingScore > 0) {
                hits.push({
                    href: `./${page.file}#${heading.id}`,
                    title: heading.text,
                    where: `${page.group} › ${page.name}`,
                    score: headingScore,
                });
            }
        }
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, MAX_HITS);
}

/**
 * The search: Ctrl+K or ⌘K (or the header's button) opens a dialog over the page; typing lists the
 * pages and sections that hold every word, the arrows move through them and Enter opens one. The
 * index is fetched the first time the dialog opens.
 */
function setupSearch(): void {
    const opener = document.querySelector<HTMLButtonElement>('#search-open');

    if (opener === null) {
        return;
    }

    let dialog: HTMLDialogElement | null = null;
    let index: Promise<SearchEntry[]> | null = null;

    const build = (): HTMLDialogElement => {
        const box = document.createElement('dialog');
        const label = document.createElement('label');
        const input = document.createElement('input');
        const list = document.createElement('ul');
        const status = document.createElement('p');
        const close = document.createElement('button');
        box.className = 'search';
        box.setAttribute('aria-label', 'Search the docs');
        label.className = 'search-label';
        label.textContent = 'Search the docs';
        input.type = 'search';
        input.className = 'search-input';
        input.placeholder = 'Zoom, regions, keyboard…';
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', 'search-results');
        input.setAttribute('aria-autocomplete', 'list');
        list.id = 'search-results';
        list.className = 'search-results';
        list.setAttribute('role', 'listbox');
        status.className = 'search-status';
        status.setAttribute('aria-live', 'polite');
        close.type = 'button';
        close.className = 'button small';
        close.textContent = 'Close';
        close.addEventListener('click', () => box.close());
        label.append(input);
        box.append(label, status, list, close);
        document.body.append(box);

        let active = -1;
        let links: HTMLAnchorElement[] = [];
        const mark = (at: number): void => {
            links.forEach((link, i) =>
                link.setAttribute('aria-selected', String(i === at)),
            );
            active = at;

            if (at >= 0) {
                input.setAttribute('aria-activedescendant', links[at].id);
                links[at].scrollIntoView({ block: 'nearest' });
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        };
        const run = async (): Promise<void> => {
            const query = input.value.trim();
            index ??= fetch('./search.json').then(
                (response) => response.json() as Promise<SearchEntry[]>,
            );
            const hits = query === '' ? [] : findIn(await index, query);

            if (input.value.trim() !== query) {
                return;
            }

            links = hits.map((hit, i) => {
                const link = document.createElement('a');
                const where = document.createElement('span');
                link.id = `search-hit-${i}`;
                link.href = hit.href;
                link.setAttribute('role', 'option');
                link.textContent = hit.title;
                where.textContent = hit.where;
                link.append(where);

                return link;
            });
            list.replaceChildren(
                ...links.map((link) => {
                    const item = document.createElement('li');
                    item.append(link);

                    return item;
                }),
            );
            input.setAttribute('aria-expanded', String(links.length > 0));
            status.textContent =
                query === ''
                    ? ''
                    : links.length === 0
                      ? 'Nothing found.'
                      : `${links.length} found.`;
            mark(links.length > 0 ? 0 : -1);
        };

        input.addEventListener('input', () => void run());
        input.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' && links.length > 0) {
                event.preventDefault();
                mark((active + 1) % links.length);
            } else if (event.key === 'ArrowUp' && links.length > 0) {
                event.preventDefault();
                mark((active - 1 + links.length) % links.length);
            } else if (event.key === 'Enter' && active >= 0) {
                event.preventDefault();
                links[active].click();
            }
        });
        list.addEventListener('click', (event) => {
            if ((event.target as Element).closest('a') !== null) {
                box.close();
            }
        });
        // A click on the backdrop (the dialog itself, outside its box) closes it.
        box.addEventListener('click', (event) => {
            if (event.target === box) {
                box.close();
            }
        });
        box.addEventListener('close', () => opener.focus());

        return box;
    };

    const open = (): void => {
        dialog ??= build();

        if (!dialog.open) {
            dialog.showModal();
            dialog.querySelector('input')?.select();
        }
    };

    opener.addEventListener('click', open);
    document.addEventListener('keydown', (event) => {
        if (
            event.key.toLowerCase() === 'k' &&
            (event.ctrlKey || event.metaKey) &&
            !event.altKey
        ) {
            event.preventDefault();
            open();
        }
    });
}

/**
 * "On this page" (the build drew it from the page's headings): a track filled up to the heading being
 * read, with a playhead on it. Beside the text on wide screens; above it, folded behind a button, on
 * narrower ones.
 */
export function setupContents(): void {
    const toc = document.querySelector<HTMLElement>('#toc');
    const toggle = toc?.querySelector<HTMLButtonElement>('.toc-toggle');
    const list = toc?.querySelector<HTMLElement>('.toc-list');

    if (!toc || !toggle || !list) {
        return;
    }

    const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    const wide = window.matchMedia(TOC_QUERY);
    const fold = (open: boolean): void => {
        toggle.setAttribute('aria-expanded', String(open));
        list.classList.toggle('open', open);
    };

    toggle.addEventListener('click', () =>
        fold(toggle.getAttribute('aria-expanded') !== 'true'),
    );
    list.addEventListener('click', (event) => {
        if (!wide.matches && (event.target as Element).closest('a') !== null) {
            fold(false);
        }
    });
    wide.addEventListener('change', () => fold(false));

    followReading(list, links);
}

/**
 * Marks the link of the heading being read, fills the track up to it (`--played`, in CSS pixels)
 * and keeps it in sight inside the list.
 */
function followReading(list: HTMLElement, links: HTMLAnchorElement[]): void {
    const targets = links.map((link) =>
        document.getElementById(link.hash.slice(1)),
    );
    let current: HTMLAnchorElement | null = null;
    let queued = false;

    const mark = (): void => {
        queued = false;
        // A heading is being read once its top passes a fifth of the way down the screen.
        const line = window.innerHeight / 5;
        const atBottom =
            window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - 2;
        let reading = 0;

        targets.forEach((target, index) => {
            if (target !== null && target.getBoundingClientRect().top <= line) {
                reading = index;
            }
        });

        if (atBottom) {
            reading = links.length - 1;
        }

        const link = links[reading];
        const item = link.parentElement as HTMLElement;
        list.style.setProperty(
            '--played',
            `${item.offsetTop + item.offsetHeight / 2}px`,
        );

        if (link === current) {
            return;
        }

        current?.removeAttribute('aria-current');
        link.setAttribute('aria-current', 'location');
        current = link;
        keepInSight(list, link);
    };

    const queue = (): void => {
        if (!queued) {
            queued = true;
            requestAnimationFrame(mark);
        }
    };

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    mark();
}

/** Room kept around the current link when its list scrolls to it, in CSS pixels. */
const SIDE_ROOM = 16;

/** Scrolls a list (never the page) so that `link` is inside it. */
function keepInSight(list: HTMLElement, link: HTMLElement): void {
    const scroller = list.closest<HTMLElement>('.toc') ?? list;
    const box = scroller.getBoundingClientRect();
    const item = link.getBoundingClientRect();

    if (item.top < box.top) {
        scroller.scrollTop -= box.top - item.top + SIDE_ROOM;
    } else if (item.bottom > box.bottom) {
        scroller.scrollTop += item.bottom - box.bottom + SIDE_ROOM;
    }
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
