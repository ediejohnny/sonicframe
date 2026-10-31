/**
 * The docs site's build step, for the dev server and the production build alike. Each page file holds
 * only its own `<main>`; this plugin draws around it, into the HTML itself, everything every page
 * shares: the header, the sidebar with the current page marked, "On this page" from the page's
 * headings (each heading gets its anchor), "Previous / Next", and the footer. Nothing is built after
 * the page paints, so nothing jumps. It also writes `search.json`, the index the search box reads,
 * and copies the sounds next to the built pages.
 */

import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite-plus';
import { PAGES, readingOrder, type DocsPage } from './pages';
import { SOUNDS } from './sounds';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYGROUND = resolve(HERE, '..');
const PROJECT = resolve(PLAYGROUND, '..');

const REPOSITORY = 'https://github.com/ediejohnny/sonicframe';
const NPM = 'https://www.npmjs.com/package/sonicframe';

/** The largest peaks file the dev server writes, in bytes. */
const MAX_PEAKS_FILE = 4_000_000;

/** The first year of the copyright. */
const FIRST_YEAR = 2026;

/** Where the page's choices are kept between visits (read before the page paints). */
const SCHEME_KEY = 'sonicframe-playground-scheme';
const FONT_KEY = 'sonicframe-docs-font';

/** The fonts the reader can pick, by the library's own stack names; the first is the default. */
export const FONTS: readonly { name: string; label: string }[] = [
    { name: 'industrial', label: 'Industrial' },
    { name: 'system', label: 'System' },
    { name: 'humanist', label: 'Humanist' },
    { name: 'geometric', label: 'Geometric' },
    { name: 'serif', label: 'Serif' },
    { name: 'rounded', label: 'Rounded' },
];

export type Heading = { level: 2 | 3; id: string; text: string };

export type SearchEntry = {
    file: string;
    name: string;
    group: string;
    lede: string;
    headings: { id: string; text: string }[];
};

function escape(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** The words of an HTML fragment: tags dropped, entities for quotes and ampersands read back. */
function words(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function slug(text: string): string {
    return (
        text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'section'
    );
}

/**
 * Gives every `h2`/`h3` of the page's `.doc` an id (its own when it has one, else one made from its
 * words, never repeated), and lists them.
 */
export function anchorHeadings(html: string): {
    html: string;
    headings: Heading[];
} {
    const start = html.indexOf('class="doc"');

    if (start < 0) {
        return { html, headings: [] };
    }

    const taken = new Set<string>();
    const headings: Heading[] = [];
    const body = html
        .slice(start)
        .replace(
            /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
            (
                whole,
                level: string,
                attributes: string | undefined,
                inner: string,
            ) => {
                const text = words(inner);
                const own = /\sid="([^"]+)"/.exec(attributes ?? '')?.[1];
                let id = own ?? slug(text);

                for (let n = 2; own === undefined && taken.has(id); n += 1) {
                    id = `${slug(text)}-${n}`;
                }

                taken.add(id);
                headings.push({ level: level === '2' ? 2 : 3, id, text });

                // The heading's link to itself is for the pointer only: the contents list and the
                // search already reach every heading, and its words stay out of the heading's name.
                const mark = `<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>`;

                return own !== undefined
                    ? whole.replace(/<\/h[23]>$/, `${mark}</h${level}>`)
                    : `<h${level} id="${id}"${attributes ?? ''}>${inner}${mark}</h${level}>`;
            },
        );

    return { html: html.slice(0, start) + body, headings };
}

function version(): string {
    const pkg = JSON.parse(
        readFileSync(join(PROJECT, 'package.json'), 'utf8'),
    ) as { version: string };

    return pkg.version;
}

/** Applies the stored scheme and font before the first paint, so the page never flashes. */
function early(): string {
    return `<script>try{var r=document.documentElement,s=localStorage.getItem('${SCHEME_KEY}'),f=localStorage.getItem('${FONT_KEY}');if(s==='light'||s==='dark')r.dataset.theme=s;if(f)r.dataset.font=f}catch(e){}</script>`;
}

/**
 * The fade between pages is all CSS (`@view-transition` in site.css). The browser skips it when a
 * second click cuts the first page's way short, or the window changes size on the way, and rejects
 * the transition's promises; nothing waits on them, so they are marked as handled instead of being
 * reported as uncaught errors. Listening before the first paint catches the arriving page's too.
 */
export function quietTransitions(): string {
    return `<script>(function(){function q(e){var t=e.viewTransition;if(t){t.ready.catch(function(){});t.finished.catch(function(){})}}addEventListener('pageswap',q);addEventListener('pagereveal',q)})()</script>`;
}

/*
 * The header's icons, drawn on a 24-unit grid. site.css strokes them 2 units wide with round ends,
 * or fills the marks of other sites (`solid`).
 */

/** Three bars, 16 wide. */
const BARS_ICON = '<path d="M4 6.5h16M4 12h16M4 17.5h16" />';

/** A magnifying glass: a ring 13 wide and its handle, down to the right. */
const SEARCH_ICON =
    '<circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.25 15.25 20 20" />';

/** A capital A and a small a, side by side on one baseline. */
const FONT_ICON =
    '<path d="M1.5 20 6.75 4 12 20M3.47 14h6.56M21 12.5V20" /><circle cx="17.5" cy="16" r="3.5" />';

/** A moon: a circle 16 wide, cut by one 14 wide, up and to the right. */
const MOON_ICON =
    '<path d="M19.77 13.9A8 8 0 1 1 10.1 4.23A7 7 0 0 0 19.77 13.9Z" />';

/** A sun: a ring 8 wide and eight rays, 7 to 9.5 from its middle, every 45 degrees. */
const SUN_ICON =
    '<circle cx="12" cy="12" r="4" /><path d="M19 12h2.5M16.95 16.95l1.77 1.77M12 19v2.5M7.05 16.95l-1.77 1.77M5 12H2.5M7.05 7.05 5.28 5.28M12 5V2.5M16.95 7.05l1.77-1.77" />';

/** GitHub's mark, drawn on its own 16-unit grid and laid over 2 to 22. */
const GITHUB_ICON =
    '<path transform="translate(2 2) scale(1.25)" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />';

/** npm's mark in its colors (site.css): a square 18 wide, and its n with a wide stem on the left. */
const NPM_ICON =
    '<path class="npm-box" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path class="npm-n" d="M6.5 6.5v11H12V9.25h2.75v8.25h2.75v-11Z" />';

/** An icon from the shapes above, hidden from screen readers: its control is named by words. */
function icon(shapes: string, kind = 'icon'): string {
    return `<svg class="${kind}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shapes}</svg>`;
}

/**
 * The font picker: a button with the font icon, named by the font in use, and the panel it opens, a
 * group of radio buttons named Font, each name written in its own font by site.css. The site's
 * script (font-picker.ts) checks the font in use and wires it.
 */
export function fontPicker(): string {
    const options = FONTS.map(
        (font) =>
            `<label class="font-option" data-font="${font.name}"><input type="radio" name="site-font" value="${font.name}" />${escape(font.label)}</label>`,
    ).join('');

    return `<div class="font-pick"><button id="font-open" class="icon-button font-open" type="button" aria-expanded="false" aria-controls="font-panel">${icon(FONT_ICON)}<span class="font-name visually-hidden">Font: ${escape(FONTS[0].label)}</span></button><div class="font-panel" id="font-panel" hidden><fieldset><legend>Font</legend>${options}</fieldset></div></div>`;
}

/**
 * The scheme switch: a moon on the light page and a sun on the dark one, the scheme a press brings
 * (site.css shows the right one before the first paint). For screen readers it is the toggle "Dark",
 * pressed while the page is dark.
 */
export function schemeButton(): string {
    return `<button id="scheme" class="icon-button scheme" type="button" aria-pressed="false">${icon(MOON_ICON, 'icon moon')}${icon(SUN_ICON, 'icon sun')}<span class="visually-hidden">Dark</span></button>`;
}

function header(): string {
    return `<a class="skip" href="#main">Skip to the content</a>
<header class="top"><div class="wrap">
<button id="menu" class="icon-button menu" type="button" aria-expanded="false" aria-controls="side">${icon(BARS_ICON)}<span class="visually-hidden">Menu</span></button>
<a class="brand" href="./"><img src="../assets/logo.svg" alt="" width="32" height="32" /><span class="brand-name">SonicFrame</span> <span class="version">v${escape(version())}</span></a>
<button id="search-open" class="search-open" type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">${icon(SEARCH_ICON)}<span class="search-word">Search the docs</span><kbd aria-hidden="true">Ctrl K</kbd></button>
<nav class="nav" aria-label="Elsewhere">
<a class="icon-button" href="${REPOSITORY}">${icon(GITHUB_ICON, 'icon solid')}<span class="visually-hidden">GitHub</span></a>
<a class="icon-button" href="${NPM}">${icon(NPM_ICON, 'icon solid npm')}<span class="visually-hidden">npm</span></a>
${fontPicker()}
${schemeButton()}
</nav>
</div></header>`;
}

function sidebar(here: string): string {
    const groups = PAGES.map(({ group, pages }) => {
        const items = pages
            .map(
                (page) =>
                    `<li><a href="./${page.file}"${page.file === here ? ' aria-current="page"' : ''}>${escape(page.name)}</a></li>`,
            )
            .join('');

        return `<p class="side-group">${escape(group)}</p><ul>${items}</ul>`;
    }).join('');

    return `<nav class="side" id="side" aria-label="Pages">${groups}</nav><div class="side-backdrop" id="side-backdrop" hidden></div>`;
}

function contents(headings: Heading[]): string {
    if (headings.length === 0) {
        return '';
    }

    const items = headings
        .map(
            (heading) =>
                `<li${heading.level === 3 ? ' class="toc-sub"' : ''}><a href="#${heading.id}">${escape(heading.text)}</a></li>`,
        )
        .join('');

    return `<aside class="toc" id="toc" aria-labelledby="toc-title"><p class="toc-title" id="toc-title">On this page</p><button class="toc-toggle" type="button" aria-expanded="false" aria-controls="toc-list">On this page</button><ol class="toc-list" id="toc-list">${items}</ol></aside>`;
}

function pager(here: string): string {
    const order = readingOrder();
    const at = order.findIndex((page) => page.file === here);

    if (at < 0) {
        return '';
    }

    const link = (page: DocsPage | undefined, rel: 'prev' | 'next'): string =>
        page === undefined
            ? '<span></span>'
            : `<a class="pager-${rel}" href="./${page.file}" rel="${rel}"><span>${rel === 'prev' ? 'Previous' : 'Next'}</span>${escape(page.name)}</a>`;

    return `<nav class="pager" aria-label="Previous and next page">${link(order[at - 1], 'prev')}${link(order[at + 1], 'next')}</nav>`;
}

function link(text: string, href: string): string {
    return `<a href="${href}">${escape(text)}</a>`;
}

function footer(): string {
    const year = new Date().getFullYear();
    const years = year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : `${FIRST_YEAR}`;
    const docs = PAGES.map(
        ({ group, pages }) => `<li>${link(group, `./${pages[0].file}`)}</li>`,
    ).join('');

    return `<footer class="foot" id="foot"><div class="wrap">
<div class="foot-columns">
<div class="foot-about"><p class="foot-name"><img src="../assets/logo.svg" alt="" width="24" height="24" />SonicFrame v${escape(version())}</p><p>Draws sound on the web: waveforms, ready-made players and plugins, with no dependencies.</p></div>
<nav aria-label="Docs"><p class="foot-title">Docs</p><ul>${docs}</ul></nav>
<nav aria-label="Project"><p class="foot-title">Project</p><ul>
<li>${link('GitHub', REPOSITORY)}</li>
<li>${link('npm', NPM)}</li>
<li>${link('Changelog', `${REPOSITORY}/blob/main/CHANGELOG.md`)}</li>
<li>${link('License', `${REPOSITORY}/blob/main/LICENSE`)}</li>
<li>${link('Report a problem', `${REPOSITORY}/issues`)}</li>
</ul></nav>
<div class="foot-sound"><p class="foot-title">The sounds</p>
<p>“The Little Elf”, a poem by John Kendrick Bangs, read by ${link('Avery', 'https://librivox.org/reader/1252')} for LibriVox’s ${link('Short Poetry Collection 026', 'https://librivox.org/short-poetry-collection-026/')}, ${link('public domain', 'https://librivox.org/pages/public-domain/')}.</p>
<p>Music: “Chill lofi inspired” by ${link('omfgdude', 'https://opengameart.org/content/chill-lofi-inspired')} and “November Snow” by ${link('cynicmusic', 'https://opengameart.org/content/november-snow')}, both ${link('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/')}; “Glory Hotel (lofi)” by ${link('migfus20', 'https://opengameart.org/content/glory-hotel-lofi')}, ${link('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/')}. Thank you all.</p></div>
</div>
<div class="foot-bottom"><p>© ${years} Edie Johnny. SonicFrame is free software under the MIT license.</p><a href="#main">Back to top</a></div>
</div></footer>`;
}

/** Draws the shared parts around a page's own `<main>`. */
export function dressPage(html: string, file: string, base = ''): string {
    const { html: anchored, headings } = anchorHeadings(html);
    // The "not found" page is served at any depth, so its relative links start from the site's base.
    const anchor = base === '' ? '' : `<base href="${escape(base)}" />\n`;
    const head = `${anchor}<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="../assets/logo.svg" />
<link rel="stylesheet" href="./site.css" />
${early()}
${quietTransitions()}`;

    return anchored
        .replace('</title>', `</title>\n${head}`)
        .replace(
            /<main class="content( [^"]*)?">/,
            (_whole, extra: string | undefined) =>
                `${header()}\n<div class="wrap layout">${sidebar(file)}<main class="content${extra ?? ''}" id="main">`,
        )
        .replace('<div class="doc">', `${contents(headings)}<div class="doc">`)
        .replace('</main>', `${pager(file)}</main></div>\n${footer()}`);
}

/**
 * Puts a page's stylesheets ahead of every script in its head, in their order. The build moves the
 * bundled stylesheet to the end of the head, after the early script; Chrome then reads the page as
 * opting out of the fade between pages (`@view-transition` lives in site.css) before the sheet is
 * known, skips the fade and reports an uncaught InvalidStateError.
 */
export function stylesFirst(html: string): string {
    const end = html.indexOf('</head>');
    const script = html.indexOf('<script');

    // Past the head, the slice below is empty and nothing moves.
    if (end < 0 || script < 0) {
        return html;
    }

    const sheets: string[] = [];
    const rest = html
        .slice(script, end)
        .replace(/<link rel="stylesheet"[^>]*>\s*/g, (link) => {
            sheets.push(link.trim());

            return '';
        });

    return sheets.length === 0
        ? html
        : `${html.slice(0, script)}${sheets.join('\n')}\n${rest}${html.slice(end)}`;
}

function pageHtml(file: string): string {
    return readFileSync(join(PLAYGROUND, file), 'utf8');
}

/** The search index: each page's name, group, first sentence and headings. */
export function searchIndex(): SearchEntry[] {
    return readingOrder().flatMap((page) => {
        let html: string;

        try {
            html = pageHtml(page.file);
        } catch {
            return [];
        }

        const lede = /<p class="lede">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';

        return [
            {
                file: page.file,
                name: page.name,
                group: page.group,
                lede: words(lede),
                headings: anchorHeadings(html).headings.map(({ id, text }) => ({
                    id,
                    text,
                })),
            },
        ];
    });
}

/** Every page the build makes: the listed pages and the "not found" page, those that exist. */
export function docsInputs(): Record<string, string> {
    const files = new Set([
        ...readingOrder().map((page) => page.file),
        '404.html',
    ]);

    return Object.fromEntries(
        [...files]
            .filter((file) => existsSync(join(PLAYGROUND, file)))
            .map((file) => [
                file.replace(/\.html$/, ''),
                join(PLAYGROUND, file),
            ]),
    );
}

/**
 * The docs site's steps: the pages, dressed before Vite reads them, with the dev server's extras and
 * the files the build adds; then, once Vite has written a page, its stylesheets ahead of every script.
 */
export function docsSite(): Plugin[] {
    return [
        docsPages(),
        {
            name: 'sonicframe-docs-styles-first',
            transformIndexHtml: { order: 'post', handler: stylesFirst },
        },
    ];
}

function docsPages(): Plugin {
    let outDir = '';
    let base = '';

    return {
        name: 'sonicframe-docs',
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
            base = config.command === 'build' ? config.base : '';
        },
        transformIndexHtml: {
            order: 'pre',
            handler(html, context) {
                const file = basename(context.filename);

                // A page whose name starts with an underscore is a tool for us, not a docs page.
                return dirname(resolve(context.filename)) === PLAYGROUND &&
                    !file.startsWith('_')
                    ? dressPage(html, file, file === '404.html' ? base : '')
                    : html;
            },
        },
        configureServer(server) {
            // _peaks.html posts each sound's peaks here; only a listed sound's own file is written.
            server.middlewares.use(
                '/playground/__peaks',
                (request, response) => {
                    const id = new URL(
                        request.url ?? '',
                        'http://dev',
                    ).searchParams.get('id');
                    const sound = SOUNDS.find((each) => each.id === id);

                    if (request.method !== 'POST' || sound === undefined) {
                        response.statusCode = 400;
                        response.end();

                        return;
                    }

                    const chunks: Buffer[] = [];
                    let size = 0;

                    request.on('data', (chunk: Buffer) => {
                        size += chunk.length;

                        if (size > MAX_PEAKS_FILE) {
                            response.statusCode = 413;
                            response.end();
                            request.destroy();

                            return;
                        }

                        chunks.push(chunk);
                    });
                    request.on('end', () => {
                        if (response.writableEnded) {
                            return;
                        }

                        writeFileSync(
                            join(PLAYGROUND, sound.peaks),
                            Buffer.concat(chunks),
                        );
                        response.end(String(size));
                    });
                },
            );
            server.middlewares.use((request, response, next) => {
                if (
                    request.url
                        ?.split('?')[0]
                        .endsWith('/playground/search.json')
                ) {
                    response.setHeader('Content-Type', 'application/json');
                    response.end(JSON.stringify(searchIndex()));

                    return;
                }

                next();
            });
        },
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'search.json',
                source: JSON.stringify(searchIndex()),
            });
        },
        closeBundle() {
            if (outDir !== '') {
                cpSync(join(PLAYGROUND, 'sounds'), join(outDir, 'sounds'), {
                    recursive: true,
                });
            }
        },
    };
}
