/**
 * The docs' code blocks: their parts colored when the page is built, the language told by the text,
 * the words left as they were (so copying a block copies its code), and the examples written into the
 * page from their own files, the code on top and the box it draws in right under it.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
    highlight,
    highlightBlocks,
    languageOf,
} from '../../playground/docs/highlight';
import { inlineExamples } from '../../playground/docs/plugin';

/** The text of a highlighted fragment, the way a copy button reads it. */
function textOf(html: string): string {
    const box = document.createElement('div');
    box.innerHTML = html;

    return box.textContent ?? '';
}

/** The text of each part of a highlighted fragment that has this token kind. */
function partsOf(html: string, kind: string): string[] {
    const box = document.createElement('div');
    box.innerHTML = html;

    return [...box.querySelectorAll(`.token.${kind}`)].map(
        (span) => span.textContent ?? '',
    );
}

describe('the docs code colors', () => {
    it('tells the language from the text', () => {
        expect(languageOf('<sonic-player src="a.mp3"></sonic-player>')).toBe(
            'html',
        );
        expect(languageOf('npm install sonicframe')).toBe('sh');
        expect(languageOf('[0.02, 0.31]\n{ "peaks": [0.02] }')).toBe('json');
        expect(languageOf(':root {\n    --sonicframe-wave: red;\n}')).toBe(
            'css',
        );
        expect(languageOf("import { x } from 'y';")).toBe('js');
    });

    it('colors the parts of JavaScript and keeps every word', () => {
        const code =
            "// The player\nconst player = createPlayer({ src: '/a.mp3', speed: 1.5 });";
        const html = highlight(code);

        expect(textOf(html)).toBe(code);
        expect(partsOf(html, 'comment')).toEqual(['// The player']);
        expect(partsOf(html, 'keyword')).toEqual(['const']);
        expect(partsOf(html, 'string')).toEqual(["'/a.mp3'"]);
        expect(partsOf(html, 'number')).toEqual(['1.5']);
    });

    it('colors tags, attributes and their values in markup', () => {
        const html = highlight(
            '<sonic-player src="/a.mp3" decode-stream></sonic-player>',
        );

        expect(partsOf(html, 'attr-name')).toEqual(['src', 'decode-stream']);
        expect(partsOf(html, 'attr-value').join('')).toContain('/a.mp3');
        expect(partsOf(html, 'tag').length).toBeGreaterThan(0);
    });

    it('colors the keys and values of JSON', () => {
        const html = highlight('{ "peaks": [0.02, 1] }');

        expect(partsOf(html, 'property')).toEqual(['"peaks"']);
        expect(partsOf(html, 'number')).toEqual(['0.02', '1']);
    });

    it('writes markup in the code as text, never as tags', () => {
        const html = highlight('const x = "<img src=x onerror=alert(1)>";');

        expect(html).not.toContain('<img');
        expect(textOf(html)).toBe('const x = "<img src=x onerror=alert(1)>";');
    });

    it('colors every plain block of a page and leaves the rest', () => {
        const page =
            '<p>a &lt;b&gt;</p><pre><code>const a = &quot;x&quot;;</code></pre>';
        const html = highlightBlocks(page);

        expect(html.startsWith('<p>a &lt;b&gt;</p>')).toBe(true);
        expect(html).toContain('<code class="language-typescript">');
        expect(textOf(html)).toBe('a <b>const a = "x";');
    });
});

describe('the docs examples', () => {
    it('puts an example’s own file on the page, code on top and its box under it', () => {
        const read = (file: string): string =>
            file.replace(/\\/g, '/').endsWith('/examples/stream-player.js')
                ? "createPlayer({ container: document.querySelector('#stream-player') });\n"
                : '';
        const html = inlineExamples(
            '<div class="example" data-example="stream-player.js"></div>',
            read,
        );
        const box = document.createElement('div');
        box.innerHTML = html;
        const example = box.querySelector('.example') as HTMLElement;

        expect(example.querySelector('code')?.textContent).toBe(
            "createPlayer({ container: document.querySelector('#stream-player') });",
        );
        expect(example.lastElementChild?.className).toBe('example-result');
        expect(example.lastElementChild?.id).toBe('stream-player');
    });

    it('shows the markup of an HTML example and puts the same markup in its box', () => {
        const markup =
            '<sonic-player src="./sounds/little-elf.mp3"></sonic-player>';
        const box = document.createElement('div');
        box.innerHTML = inlineExamples(
            '<div class="example" data-example="tag.html"></div>',
            () => `${markup}\n`,
        );

        expect(box.querySelector('code')?.textContent).toBe(markup);
        expect(box.querySelector('.example-result')?.innerHTML).toBe(markup);
    });

    it('refuses an example whose box would take an id the page already has', () => {
        expect(() =>
            inlineExamples(
                '<div id="zoom-player"></div><div class="example" data-example="zoom-player.js"></div>',
                () => '',
            ),
        ).toThrow('which the page already has');
    });

    it('refuses a name that is not an example file', () => {
        for (const name of ['../secrets.js', 'player', 'a.ts']) {
            expect(() =>
                inlineExamples(
                    `<div class="example" data-example="${name}"></div>`,
                    () => '',
                ),
            ).toThrow('is not an example file');
        }
    });
});
