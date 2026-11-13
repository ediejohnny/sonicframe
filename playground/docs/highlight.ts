/**
 * Colors for the docs' code blocks, written into the page when it is built, by Prism (MIT, a
 * development dependency only): each `<pre><code>` block's text becomes Prism's `<span class="token
 * …">` parts. The language is told by the text itself: markup, a shell command, JSON, CSS or
 * TypeScript (which reads JavaScript too). The words stay the same, so copying a block copies its code.
 */

import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

loadLanguages(['typescript', 'bash', 'json']);

export type CodeLanguage = 'html' | 'sh' | 'json' | 'css' | 'js';

/** Prism's grammar for each language. */
const GRAMMARS: Record<CodeLanguage, string> = {
    html: 'markup',
    sh: 'bash',
    json: 'json',
    css: 'css',
    js: 'typescript',
};

const SHELL = /^\s*(npm|npx|node|git|ffmpeg|audiowaveform|curl)\b/;

function unescape(html: string): string {
    return html
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

/** Whether `text` is JSON as it is. */
function isJson(text: string): boolean {
    try {
        JSON.parse(text);

        return true;
    } catch {
        return false;
    }
}

/** The language of a block, told by its text. */
export function languageOf(code: string): CodeLanguage {
    const text = code.trim();

    if (text.startsWith('<')) {
        return 'html';
    }

    if (SHELL.test(text)) {
        return 'sh';
    }

    // A whole document, or one per line (a list and an object shown together).
    if (
        /^[[{]/.test(text) &&
        (isJson(text) || text.split('\n').every(isJson))
    ) {
        return 'json';
    }

    if (
        /^[^\n{]*\{\s*\n?\s*[-a-z]+\s*:/m.test(text) &&
        !/\b(import|const|let|function|=>|new)\b/.test(text)
    ) {
        return 'css';
    }

    return 'js';
}

/** The code's text as HTML, its parts in Prism's colored spans. */
export function highlight(
    code: string,
    language: CodeLanguage = languageOf(code),
): string {
    const grammar = GRAMMARS[language];

    return Prism.highlight(code, Prism.languages[grammar], grammar);
}

/** Colors every plain `<pre><code>` block of a page. */
export function highlightBlocks(html: string): string {
    return html.replace(
        /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
        (_whole, inner: string) => {
            const code = unescape(inner);
            const language = languageOf(code);

            return `<pre><code class="language-${GRAMMARS[language]}">${highlight(code, language)}</code></pre>`;
        },
    );
}
