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

function header(): string {
    const fonts = FONTS.map(
        (font) => `<option value="${font.name}">${escape(font.label)}</option>`,
    ).join('');

    return `<a class="skip" href="#main">Skip to the content</a>
<header class="top"><div class="wrap">
<button id="menu" class="button small menu" type="button" aria-expanded="false" aria-controls="side"><span>Menu</span></button>
<a class="brand" href="./"><img src="../assets/logo.svg" alt="" width="32" height="32" /><span class="brand-name">SonicFrame</span> <span class="version">v${escape(version())}</span></a>
<button id="search-open" class="search-open" type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K"><span>Search the docs</span><kbd>Ctrl K</kbd></button>
<nav class="nav" aria-label="Elsewhere">
<a class="far" href="${REPOSITORY}">GitHub</a>
<a class="far" href="${NPM}">npm</a>
<label class="font-pick"><span>Font</span><select id="site-font">${fonts}</select></label>
<button id="scheme" class="button small" type="button" aria-pressed="false">Dark</button>
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
${early()}`;

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

export function docsSite(): Plugin {
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
