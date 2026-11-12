/**
 * Guards that adding SonicFrame to a page never opens a hole in it: no outside text ever reaches the
 * page as HTML or as code, no listener or style is written as text, nothing navigates, and every
 * address the code puts on an element is one checked before. Each guard reads all of src/, so a
 * careless line anywhere fails here before it ships.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const root = join(import.meta.dirname, '..');

/** Every TypeScript file of src/, as a path from the package's root with forward slashes. */
function sources(): string[] {
    return readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.ts'))
        .map((file) =>
            relative(root, join(root, 'src', file))
                .split(sep)
                .join('/'),
        );
}

/**
 * A file's lines with the comments blanked and the strings kept, so prose that names a sink does not
 * count while `setAttribute('onclick', …)` still does. A `//` after a colon or a quote (an address
 * in a string) or after a backslash (in a regular expression) is not a comment.
 */
function lines(file: string): string[] {
    return readFileSync(join(root, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
            comment.replace(/[^\n]/g, ' '),
        )
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
        .split('\n');
}

type Sink = { readonly name: string; readonly pattern: RegExp };

/** Every line of src/ where one of `sinks` appears, as `file:line: name`. */
function found(sinks: readonly Sink[]): string[] {
    const hits: string[] = [];

    for (const file of sources()) {
        lines(file).forEach((line, index) => {
            for (const sink of sinks) {
                if (sink.pattern.test(line)) {
                    hits.push(`${file}:${index + 1}: ${sink.name}`);
                }
            }
        });
    }

    return hits;
}

/** Ways to put text into the page as markup. */
const HTML_SINKS: readonly Sink[] = [
    { name: 'innerHTML', pattern: /\binnerHTML\b/ },
    { name: 'outerHTML', pattern: /\bouterHTML\b/ },
    { name: 'insertAdjacentHTML', pattern: /\binsertAdjacentHTML\b/ },
    { name: 'document.write', pattern: /\bdocument\s*\.\s*write(ln)?\b/ },
    {
        name: 'createContextualFragment',
        pattern: /\bcreateContextualFragment\b/,
    },
    { name: 'srcdoc', pattern: /\bsrcdoc\b/ },
    { name: 'parseFromString as HTML', pattern: /text\/html/ },
    { name: 'setHTMLUnsafe', pattern: /\bsetHTMLUnsafe\b|\bparseHTMLUnsafe\b/ },
];

/** Ways to run text as code. */
const CODE_SINKS: readonly Sink[] = [
    { name: 'eval', pattern: /\beval\s*\(/ },
    { name: 'new Function', pattern: /\bnew\s+Function\b|\bFunction\s*\(/ },
    {
        name: 'a timer given text',
        pattern: /\bset(Timeout|Interval)\s*\(\s*['"`]/,
    },
    { name: 'dynamic import', pattern: /\bimport\s*\(/ },
    { name: 'importScripts', pattern: /\bimportScripts\b/ },
    { name: 'a javascript: address', pattern: /javascript:/i },
];

/** Ways to write a listener or a style as text, which a strict Content-Security-Policy refuses. */
const TEXT_ATTRIBUTE_SINKS: readonly Sink[] = [
    {
        name: 'a listener attribute',
        pattern: /setAttribute(NS)?\s*\(\s*(['"`])on/i,
    },
    {
        name: 'a listener property given text',
        pattern: /\.on[a-z]+\s*=\s*['"`]/,
    },
    {
        name: 'a style attribute',
        pattern: /setAttribute(NS)?\s*\(\s*['"`]style['"`]/,
    },
    { name: 'cssText', pattern: /\bcssText\b/ },
];

/** Ways to leave the page or open another one. */
const NAVIGATION_SINKS: readonly Sink[] = [
    {
        name: 'location',
        pattern: /\blocation\s*\.\s*(href|assign|replace)\b|\blocation\s*=[^=]/,
    },
    { name: 'window.open', pattern: /\bwindow\s*\.\s*open\s*\(/ },
    { name: 'postMessage', pattern: /\bpostMessage\s*\(/ },
];

/** Regular expressions built while the code runs, which outside text could turn into ReDoS. */
const RUNTIME_PATTERNS: readonly Sink[] = [
    { name: 'RegExp built at run time', pattern: /\bRegExp\s*\(/ },
];

/** Every place that puts an address on an element. */
const ADDRESS_SINKS: readonly Sink[] = [
    {
        name: 'an address property',
        // `data` (an `<object>`'s address) only as an attribute: `.data` is a common field name.
        pattern: /\.(href|src|poster|action|formAction)\s*=[^=]/,
    },
    {
        name: 'an address attribute',
        pattern:
            /setAttribute(NS)?\s*\([^,]*['"`](href|src|poster|action|formaction|xlink:href|data)['"`]/,
    },
];

/**
 * The files that put an address on an element today, how many times, and why each address is safe. A
 * new place, in a new file or one more in the same file, fails the guard until it is checked and
 * written here, with its reason.
 */
const CHECKED_ADDRESSES: Readonly<
    Record<string, { readonly places: number; readonly why: string }>
> = {
    'src/dom/shared/fonts.ts': {
        places: 1,
        why: '`resolveFont` takes a stylesheet only through `safeFontUrl` (core/player/fonts.ts)',
    },
    'src/plugins/chapters/chapter-item.ts': {
        places: 1,
        why: "`readChapters` keeps a chapter's picture only through `safeUrl` (core/chapters/chapters.ts)",
    },
    'src/plugins/chapters/chapter-list.ts': {
        places: 1,
        why: "`readChapters` keeps a chapter's link only through `safeUrl`",
    },
    'src/player/player/player-media.ts': {
        places: 1,
        why: "the app's own `src` on its own `<audio>`: a media element fetches, it never runs script",
    },
};

describe('security guards', () => {
    it('reads every source file', () => {
        // A guard that reads nothing would pass for nothing.
        expect(sources().length).toBeGreaterThan(100);
        expect(sources()).toContain('src/player/player/player.ts');
    });

    it('never puts text into the page as HTML', () => {
        expect(found(HTML_SINKS)).toEqual([]);
    });

    it('never runs text as code', () => {
        expect(found(CODE_SINKS)).toEqual([]);
    });

    it('never writes a listener or a style as text', () => {
        expect(found(TEXT_ATTRIBUTE_SINKS)).toEqual([]);
    });

    it('never leaves the page nor opens or messages another one', () => {
        expect(found(NAVIGATION_SINKS)).toEqual([]);
    });

    it('never builds a regular expression while it runs', () => {
        expect(found(RUNTIME_PATTERNS)).toEqual([]);
    });

    it('puts an address on an element only where it was checked first', () => {
        const places: Record<string, number> = {};

        for (const hit of found(ADDRESS_SINKS)) {
            const file = hit.slice(0, hit.indexOf(':'));
            places[file] = (places[file] ?? 0) + 1;
        }

        const checked = Object.fromEntries(
            Object.entries(CHECKED_ADDRESSES).map(([file, { places }]) => [
                file,
                places,
            ]),
        );

        expect(places).toEqual(checked);
    });
});
