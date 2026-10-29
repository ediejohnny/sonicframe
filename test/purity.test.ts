/**
 * Guards for how the package is built: the core never touches the page (so it runs anywhere and is
 * tested here, in Node), and nothing is imported from outside the package (no runtime dependency).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

// The core must not reach for anything only the page has. This grew in 0.2.0 with the Web Audio,
// media-recording, worker, timer and blob names the new features use in the DOM layer only.
// `URL`, `Intl` and `queueMicrotask` stay allowed: they are standard in Node as well.
const DOM_NAMES =
    /\b(window|document|navigator|globalThis|location|HTMLElement|HTMLMediaElement|HTMLCanvasElement|CanvasRenderingContext2D|OffscreenCanvas|Path2D|ImageData|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|ResizeObserver|IntersectionObserver|matchMedia|getComputedStyle|devicePixelRatio|addEventListener|Event|AudioContext|OfflineAudioContext|AnalyserNode|MediaRecorder|MediaStream|Worker|Blob)\b/;

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
        expect(manifest.peerDependencies ?? {}).toEqual({});
        expect(manifest.optionalDependencies ?? {}).toEqual({});
    });

    it('keeps the analysis entry importing only the core', () => {
        // src/analysis.ts is the `sonicframe/analysis` subpath: pure functions, safe in Node and in a
        // worker, so its import graph must stay inside the core. It arrives in a later phase.
        const file = join(root, 'src/analysis.ts');

        if (!existsSync(file)) {
            return;
        }

        for (const target of imports(file)) {
            expect(target, 'src/analysis.ts').toMatch(/^\.\/core\/[\w-]+$/);
        }
    });

    it('keeps the player entry to the player and the core', () => {
        // src/player.ts is the `sonicframe/player` subpath: it re-exports the player and the pure pieces
        // it is described by (looks, palettes, fonts), so the main entry never has to carry them.
        for (const target of imports(join(root, 'src/player.ts'))) {
            expect(target, 'src/player.ts').toMatch(
                /^\.\/(player|core)\/[\w-]+$/,
            );
        }
    });

    it('reports the version of the package', () => {
        const manifest = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
        );

        expect(VERSION).toBe(manifest.version);
    });
});
