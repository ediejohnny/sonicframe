/**
 * What every docs page shares: the sound, the header, the sidebar of pages and "On this page" (the
 * code blocks are in code-blocks.ts). The sound's peaks and length come from a ready-made file, so every player gets the
 * same ones at once and nothing is decoded; a sound the reader picks is read once, in pieces when
 * its format allows (so hours fit in the tab), else decoded whole. The header
 * switches the page between light and dark and picks its font; canvas colors are read once, so the
 * page repaints its players after every switch.
 */

import {
    NotStreamable,
    STREAM_BYTES,
    STREAM_SECONDS,
    streamPeaks,
} from '../src/dom/audio/stream-peaks';
import { loadWaveform, peaksFromChannel } from '../src/index';
import { POEM } from './docs/sounds';
import { setupFontPicker } from './font-picker';
import { store, stored } from './storage';

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

/** The largest file read in pieces: decode.stream's lock, 4 GiB. */
const MOST_STREAMED = STREAM_BYTES.most;

/** The largest file decoded whole (a format not read in pieces): 256 MiB, decode.maxBytes' lock. */
const MOST_WHOLE = 268_435_456;

const SCHEME_KEY = 'sonicframe-playground-scheme';

type Scheme = 'light' | 'dark';

/** A file's size in words: KB under a megabyte, MB under a gigabyte, then GB, to one decimal. */
export function sizeText(bytes: number): string {
    const tenth = (value: number): string => String(Number(value.toFixed(1)));

    if (bytes < 1_048_576) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return bytes < 1_073_741_824
        ? `${tenth(bytes / 1_048_576)} MB`
        : `${tenth(bytes / 1_073_741_824)} GB`;
}

/** A file too large for the way it would be read; its message is said as it is. */
class TooLarge extends Error {}

/** `body` passed on unchanged, telling the share of the file read once each piece is through. */
function counted(
    body: ReadableStream<Uint8Array>,
    from: number,
    size: number,
    progress: (share: number) => void,
): ReadableStream<Uint8Array> {
    let read = from;

    return body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(piece, controller): void {
                read += piece.length;
                progress(size > 0 ? read / size : 1);
                controller.enqueue(piece);
            },
        }),
    );
}

/** Decodes a sound whole, once; the object URL `url` lives until `forget` is called with it. */
async function decodedWhole(
    bytes: ArrayBuffer,
    url: string,
    name: string,
): Promise<Sound> {
    const context = new AudioContext();

    try {
        const buffer = await context.decodeAudioData(bytes);

        return {
            url,
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
 * A picked file as the page's sound. Its peaks are read in pieces as the bytes go through, the bar
 * filling with the share read; a format that cannot be read so is read and decoded whole, up to
 * 256 MiB, with the seconds of decoding on the bar. `tell` says each step.
 */
async function soundFromFile(
    file: File,
    bar: FileProgress,
    tell: (text: string) => void,
): Promise<Sound> {
    const url = URL.createObjectURL(file);
    const size = sizeText(file.size);

    try {
        const streamed = await streamPeaks(url, {
            count: PEAKS,
            maxBytes: MOST_STREAMED,
            maxSeconds: STREAM_SECONDS.most,
            open: (from = 0) =>
                Promise.resolve(
                    new Response(
                        counted(
                            file.slice(from).stream(),
                            from,
                            file.size,
                            (share) => bar.reading(share),
                        ),
                    ),
                ),
        });

        return {
            url,
            own: true,
            peaks: streamed.peaks,
            duration: streamed.duration,
            name: file.name,
        };
    } catch (error) {
        if (!(error instanceof NotStreamable)) {
            URL.revokeObjectURL(url);
            throw error;
        }
    }

    if (file.size > MOST_WHOLE) {
        URL.revokeObjectURL(url);
        throw new TooLarge(
            `${file.name} is ${size}: in this format the page reads files up to ${sizeText(MOST_WHOLE)}. MP3, AAC, WAV, M4A, MP4, Ogg, FLAC and WebM go up to ${sizeText(MOST_STREAMED)}.`,
        );
    }

    try {
        const bytes = await readFile(file, (share) => bar.reading(share));
        tell(`Decoding ${file.name}… A long sound can take a while.`);
        const start = Date.now();
        const seconds = (): number => Math.round((Date.now() - start) / 1000);
        bar.decoding(0);
        const timer = setInterval(() => bar.decoding(seconds()), 1000);

        try {
            return await decodedWhole(bytes, url, file.name);
        } finally {
            clearInterval(timer);
        }
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
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

/** Reads a file, telling the share read so far (0 to 1). */
function readFile(
    file: Blob,
    progress: (share: number) => void,
): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('progress', (event) => {
            if (event.lengthComputable && event.total > 0) {
                progress(event.loaded / event.total);
            }
        });
        reader.addEventListener('load', () =>
            resolve(reader.result as ArrayBuffer),
        );
        reader.addEventListener('error', () => reject(reader.error));
        reader.readAsArrayBuffer(file);
    });
}

type FileProgress = {
    /** The share of the file read, from 0 to 1. */
    reading(share: number): void;
    /** Decoding, which tells no share: a moving stripe and the seconds so far. */
    decoding(seconds: number): void;
    done(): void;
};

/** A bar after `anchor` for a picked file while it loads. */
function fileProgress(anchor: Element): FileProgress {
    const box = document.createElement('span');
    box.className = 'file-progress';
    box.hidden = true;
    const track = document.createElement('span');
    track.className = 'file-progress-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Loading your sound');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    const fill = document.createElement('span');
    fill.className = 'file-progress-fill';
    const note = document.createElement('span');
    note.className = 'file-progress-note';
    note.setAttribute('aria-hidden', 'true');
    track.append(fill);
    box.append(track, note);
    anchor.after(box);

    return {
        reading(share: number): void {
            const percent = Math.round(Math.min(1, Math.max(0, share)) * 100);
            box.hidden = false;
            delete track.dataset.busy;
            fill.style.setProperty('width', `${percent}%`);
            track.setAttribute('aria-valuenow', String(percent));
            track.removeAttribute('aria-valuetext');
            note.textContent = `${percent}%`;
        },
        decoding(seconds: number): void {
            box.hidden = false;
            track.dataset.busy = '';
            fill.style.removeProperty('width');
            track.removeAttribute('aria-valuenow');
            track.setAttribute('aria-valuetext', 'Decoding');
            note.textContent = `${seconds} s`;
        },
        done(): void {
            box.hidden = true;
        },
    };
}

/**
 * A button that opens a hidden file input, and the file chosen becomes the page's sound. A note
 * after the button tells the largest file taken, and a larger one is refused before it is read.
 * While a file loads, `tell` says each step and a bar shows the share read (or the seconds spent
 * decoding a format read whole); the button ignores presses until the file is in or refused.
 */
export function pickSound(
    button: HTMLButtonElement,
    input: HTMLInputElement,
    use: (sound: Sound) => void,
    fail: (error: unknown) => void,
    tell: (text: string) => void,
): void {
    const limit = document.createElement('span');
    limit.className = 'file-limit';
    limit.textContent = `Up to ${sizeText(MOST_STREAMED)}.`;
    button.after(limit);
    const bar = fileProgress(limit);
    let busy = false;

    button.addEventListener('click', () => {
        if (!busy) {
            input.click();
        }
    });
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';

        if (!file || busy) {
            return;
        }

        if (file.size > MOST_STREAMED) {
            tell(
                `${file.name} is ${sizeText(file.size)}: the page reads files up to ${sizeText(MOST_STREAMED)}.`,
            );

            return;
        }

        busy = true;
        button.setAttribute('aria-disabled', 'true');
        tell(`Reading ${file.name} (${sizeText(file.size)})…`);
        bar.reading(0);
        soundFromFile(file, bar, tell)
            .then(use, (error: unknown) =>
                error instanceof TooLarge ? tell(error.message) : fail(error),
            )
            .finally(() => {
                busy = false;
                button.removeAttribute('aria-disabled');
                bar.done();
            });
    });
}

function storedScheme(): Scheme | null {
    const value = stored(SCHEME_KEY);

    return value === 'light' || value === 'dark' ? value : null;
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
    setupFontPicker(repaint);
    setupSidebar();
    setupSearch();
    prefetchOnHover();
}

/** The width at which the sidebar stops being a drawer and stays beside the page (60rem). */
const SIDE_QUERY = '(min-width: 60rem)';

/** The width at which "On this page" stays beside the text instead of folding above it (76rem). */
const TOC_QUERY = '(min-width: 76rem)';

/**
 * The sidebar of pages: on narrow screens a drawer the Menu button opens, closed by a link, the
 * backdrop or Escape. While it is open, the page under the backdrop (the content and the footer) is
 * inert, so neither Tab nor a screen reader wanders behind it; the header stays in reach.
 */
function setupSidebar(): void {
    const side = document.querySelector<HTMLElement>('#side');
    const menu = document.querySelector<HTMLButtonElement>('#menu');
    const backdrop = document.querySelector<HTMLElement>('#side-backdrop');

    if (side === null || menu === null || backdrop === null) {
        return;
    }

    const behind = [...document.querySelectorAll<HTMLElement>('main, #foot')];
    const setOpen = (open: boolean, restoreFocus = false): void => {
        side.classList.toggle('open', open);
        backdrop.hidden = !open;
        menu.setAttribute('aria-expanded', String(open));

        for (const part of behind) {
            part.toggleAttribute('inert', open);
        }

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
                // The comma, heard only, keeps the title and the place apart in the option's name.
                const pause = document.createElement('span');
                link.id = `search-hit-${i}`;
                link.href = hit.href;
                link.setAttribute('role', 'option');
                link.textContent = hit.title;
                pause.className = 'visually-hidden';
                pause.textContent = ', ';
                where.textContent = hit.where;
                link.append(pause, where);

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
            } else if (event.key === 'Escape') {
                // A search field's own Escape only clears it; here it closes the search at once.
                event.preventDefault();
                box.close();
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

export function byId<Element extends HTMLElement = HTMLElement>(
    id: string,
): Element {
    const element = document.getElementById(id);

    if (element === null) {
        throw new Error(`The page has no #${id}.`);
    }

    return element as Element;
}
