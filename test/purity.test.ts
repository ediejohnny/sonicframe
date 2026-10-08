/**
 * Guards for how the package is built: the core never touches the page (so it runs anywhere and is
 * tested here, in Node), and nothing is imported from outside the package (no runtime dependency).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { VERSION } from '../src/index';

const root = join(import.meta.dirname, '..');

function sources(folder: string): string[] {
    return readdirSync(join(root, folder), {
        recursive: true,
        encoding: 'utf8',
    })
        .filter((file) => file.endsWith('.ts'))
        .map((file) => join(root, folder, file));
}

/** The code without comments and strings, so prose that mentions "the page" does not count. */
function code(file: string): string {
    return readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "''");
}

function imports(file: string): string[] {
    return [
        ...readFileSync(file, 'utf8').matchAll(
            /^\s*(?:import|export)\b[^;]*?\bfrom\s+'([^']+)'/gm,
        ),
    ].map((match) => match[1]);
}

const DOM_NAMES =
    /\b(window|document|navigator|globalThis|HTMLElement|HTMLMediaElement|HTMLCanvasElement|CanvasRenderingContext2D|Path2D|requestAnimationFrame|cancelAnimationFrame|ResizeObserver|IntersectionObserver|matchMedia|getComputedStyle|devicePixelRatio|addEventListener|Event)\b/;

describe('package boundaries', () => {
    it('keeps the core free of the page', () => {
        const files = sources('src/core');
        expect(files.length).toBeGreaterThan(5);

        for (const file of files) {
            expect(code(file), relative(root, file)).not.toMatch(DOM_NAMES);
        }
    });

    it('lets the core import only the core and shared types', () => {
        for (const file of sources('src/core')) {
            for (const target of imports(file)) {
                expect(target, relative(root, file)).toMatch(
                    /^(\.\/[\w-]+|\.\.\/types)$/,
                );
            }
        }
    });

    it('imports nothing from outside the package', () => {
        for (const file of sources('src')) {
            for (const target of imports(file)) {
                expect(target, relative(root, file)).toMatch(/^\.\.?\//);
            }
        }

        const manifest = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
        );
        expect(manifest.dependencies ?? {}).toEqual({});
    });

    it('reports the version of the package', () => {
        const manifest = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
        );

        expect(VERSION).toBe(manifest.version);
    });
});
