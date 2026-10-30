/**
 * What every docs page shares: the sound, the header, the sidebar of pages, "On this page" and the
 * copy buttons. The sound is fetched and decoded once, so every player gets the same peaks and
 * duration and plays the same bytes. The header shows the version and switches the page between
 * light and dark; canvas colors are read once, so the page repaints its players after every switch.
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
    setupSidebar();
    setupFooter();
}

/** The pages, in groups, as the sidebar lists them. */
const PAGES: { group: string; pages: { file: string; name: string }[] }[] = [
    {
        group: 'Getting started',
        pages: [{ file: 'index.html', name: 'Introduction' }],
    },
    {
        group: 'Look',
        pages: [
            { file: 'drawings.html', name: 'Drawings and themes' },
            { file: 'themes.html', name: 'Theme gallery' },
        ],
    },
    {
        group: 'Accessibility',
        pages: [{ file: 'words.html', name: 'The wave in words' }],
    },
    {
        group: 'Long sounds',
        pages: [{ file: 'zoom.html', name: 'Zoom and long sounds' }],
    },
    {
        group: 'Going further',
        pages: [
            { file: 'plugins.html', name: 'Plugins and controls' },
            { file: 'performance.html', name: 'Sixty at once' },
        ],
    },
];

/** The width at which the sidebar stops being a drawer and stays beside the page (60rem). */
const SIDE_QUERY = '(min-width: 60rem)';

/** The width at which "On this page" stays beside the text instead of folding above it (76rem). */
const TOC_QUERY = '(min-width: 76rem)';

/** The page file this is: `index.html` for the folder itself. */
function currentFile(): string {
    const last = location.pathname.split('/').pop() ?? '';

    return last === '' ? 'index.html' : last;
}

/**
 * The sidebar: every page, in groups, the current one marked. On narrow screens it is a drawer the
 * Menu button opens, closed by a link, the backdrop or Escape.
 */
function setupSidebar(): void {
    const side = document.querySelector<HTMLElement>('#side');
    const menu = document.querySelector<HTMLButtonElement>('#menu');
    const backdrop = document.querySelector<HTMLElement>('#side-backdrop');

    if (side === null || menu === null || backdrop === null) {
        return;
    }

    const here = currentFile();

    for (const { group, pages } of PAGES) {
        const name = document.createElement('p');
        const list = document.createElement('ul');
        name.className = 'side-group';
        name.textContent = group;

        for (const page of pages) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = `./${page.file}`;
            link.textContent = page.name;

            if (page.file === here) {
                link.setAttribute('aria-current', 'page');
            }

            item.append(link);
            list.append(item);
        }

        side.append(name, list);
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
}

/** The project's home on GitHub. */
const REPOSITORY = 'https://github.com/ediejohnny/sonicframe';

/** The first year of the copyright. */
const FIRST_YEAR = 2026;

/** A link, from its words and address. */
function linkTo(text: string, href: string): HTMLAnchorElement {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = text;

    return link;
}

/** A footer column: a name over a list of links. */
function footColumn(name: string, links: HTMLAnchorElement[]): HTMLElement {
    const column = document.createElement('nav');
    const title = document.createElement('p');
    const list = document.createElement('ul');
    title.className = 'foot-title';
    title.textContent = name;
    column.setAttribute('aria-label', name);

    for (const link of links) {
        const item = document.createElement('li');
        item.append(link);
        list.append(item);
    }

    column.append(title, list);

    return column;
}

/**
 * The footer, the same on every page: the name and what it does, the pages, the project's links,
 * the sound's credits, and a closing line with the copyright and the license.
 */
function setupFooter(): void {
    const foot = document.querySelector<HTMLElement>('#foot');

    if (foot === null) {
        return;
    }

    const wrap = document.createElement('div');
    const columns = document.createElement('div');
    const about = document.createElement('div');
    const name = document.createElement('p');
    const line = document.createElement('p');
    wrap.className = 'wrap';
    columns.className = 'foot-columns';
    about.className = 'foot-about';
    name.className = 'foot-name';
    const logo = document.createElement('img');
    logo.src = '../assets/logo.svg';
    logo.alt = '';
    name.append(logo, `SonicFrame v${VERSION}`);
    line.textContent =
        'Draws sound on the web: waveforms, ready-made players and plugins, with no dependencies.';
    about.append(name, line);

    const sound = document.createElement('div');
    const soundTitle = document.createElement('p');
    const credit = document.createElement('p');
    soundTitle.className = 'foot-title';
    soundTitle.textContent = 'The sound';
    credit.append(
        '“The Little Elf”, a poem by John Kendrick Bangs, read by ',
        linkTo('Avery', 'https://librivox.org/reader/1252'),
        ' for LibriVox’s ',
        linkTo(
            'Short Poetry Collection 026',
            'https://librivox.org/short-poetry-collection-026/',
        ),
        ' (',
        linkTo(
            'archive.org',
            'https://archive.org/details/shortpoetry_026_librivox',
        ),
        '). LibriVox recordings are in the ',
        linkTo('public domain', 'https://librivox.org/pages/public-domain/'),
        '. Thank you, Avery and LibriVox.',
    );
    sound.append(soundTitle, credit);

    columns.append(
        about,
        footColumn(
            'Docs',
            PAGES.flatMap(({ pages }) =>
                pages.map((page) => linkTo(page.name, `./${page.file}`)),
            ),
        ),
        footColumn('Project', [
            linkTo('GitHub', REPOSITORY),
            linkTo('npm', 'https://www.npmjs.com/package/sonicframe'),
            linkTo('Changelog', `${REPOSITORY}/blob/main/CHANGELOG.md`),
            linkTo('License', `${REPOSITORY}/blob/main/LICENSE`),
            linkTo('Report a problem', `${REPOSITORY}/issues`),
        ]),
        sound,
    );

    const bottom = document.createElement('div');
    const copyright = document.createElement('p');
    const year = new Date().getFullYear();
    const years = year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : `${FIRST_YEAR}`;
    bottom.className = 'foot-bottom';
    copyright.textContent = `© ${years} Edie Johnny. SonicFrame is free software under the MIT license.`;
    bottom.append(copyright, linkTo('Back to top', '#'));

    wrap.append(columns, bottom);
    foot.replaceChildren(wrap);
}

/** A heading's anchor: its section's id when it opens one, else its own (made from its words). */
function anchorOf(heading: HTMLElement): string {
    const section = heading.parentElement;

    if (
        section?.tagName === 'SECTION' &&
        section.id !== '' &&
        section.querySelector('h2, h3') === heading
    ) {
        return section.id;
    }

    if (heading.id === '') {
        heading.id = (heading.textContent ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    return heading.id;
}

/**
 * "On this page": the page's headings as a track, filled up to the one being read, with a playhead
 * on it. Beside the text on wide screens; above it, folded behind a button, on narrower ones.
 */
export function setupContents(): void {
    const toc = document.querySelector<HTMLElement>('#toc');
    const doc = document.querySelector<HTMLElement>('.doc');

    if (toc === null || doc === null) {
        return;
    }

    const headings = [...doc.querySelectorAll<HTMLElement>('h2, h3')].filter(
        (heading) => heading.closest('[hidden]') === null,
    );

    if (headings.length === 0) {
        toc.remove();

        return;
    }

    const title = document.createElement('p');
    const toggle = document.createElement('button');
    const list = document.createElement('ol');
    title.className = 'toc-title';
    title.id = 'toc-title';
    title.textContent = 'On this page';
    toggle.type = 'button';
    toggle.className = 'toc-toggle';
    toggle.textContent = 'On this page';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'toc-list');
    list.id = 'toc-list';
    list.className = 'toc-list';
    toc.setAttribute('aria-labelledby', 'toc-title');

    const links = headings.map((heading) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${anchorOf(heading)}`;
        link.textContent = heading.textContent?.trim() ?? '';
        item.className = heading.tagName === 'H3' ? 'toc-sub' : '';
        item.append(link);
        list.append(item);

        return link;
    });

    toc.append(title, toggle, list);

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
